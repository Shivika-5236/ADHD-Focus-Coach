import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import FocusRoom from '../models/FocusRoom';
import { isDatabaseConnected } from '../utils/db';

// ─── Types ───────────────────────────────────────────────────────────────────

type ParticipantStatus = 'focusing' | 'paused' | 'break';

interface RoomClient {
  ws: WebSocket;
  participantId: string;
  roomCode: string;
  name: string;
  avatar: string;
  status: ParticipantStatus;
  taskDisplay: string;
  isPrivate: boolean;
  joinedAt: number;
}

// Inbound message types (client → server)
type InboundMsgType = 'JOIN' | 'LEAVE' | 'UPDATE_STATUS' | 'UPDATE_TASK' | 'PING';

interface InboundMessage {
  type: InboundMsgType;
  roomCode?: string;
  participantId?: string;
  name?: string;
  avatar?: string;
  status?: ParticipantStatus;
  taskDisplay?: string;
  isPrivate?: boolean;
}

// Outbound message types (server → client)
export interface ParticipantSnapshot {
  id: string;
  name: string;
  avatar: string;
  status: ParticipantStatus;
  taskDisplay: string;
  isPrivate: boolean;
  elapsedMinutes: number;
  joinedAt: number;
}

export interface ActiveRoomSummary {
  roomCode: string;
  participantCount: number;
  maxParticipants: number;
  focusingCount: number;
}

interface RoomStateMsg {
  type: 'ROOM_STATE';
  roomCode: string;
  participants: ParticipantSnapshot[];
}

interface ErrorMsg {
  type: 'ERROR';
  message: string;
}

interface PongMsg {
  type: 'PONG';
}

type OutboundMsg = RoomStateMsg | ErrorMsg | PongMsg;

// ─── In-memory room registry ──────────────────────────────────────────────────

const MAX_ROOM_SIZE = 8;

/** roomCode → Set<RoomClient> */
const rooms = new Map<string, Set<RoomClient>>();

function getOrCreateRoom(roomCode: string): Set<RoomClient> {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, new Set());
  }
  return rooms.get(roomCode)!;
}

function pruneRoom(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (room && room.size === 0) {
    rooms.delete(roomCode);
  }
}

function calcElapsedMinutes(joinedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - joinedAt) / 60000));
}

function toSnapshot(client: RoomClient): ParticipantSnapshot {
  return {
    id: client.participantId,
    name: client.name,
    avatar: client.avatar,
    status: client.status,
    taskDisplay: client.isPrivate ? 'Focusing in stealth mode' : client.taskDisplay,
    isPrivate: client.isPrivate,
    elapsedMinutes: calcElapsedMinutes(client.joinedAt),
    joinedAt: client.joinedAt,
  };
}

function syncRoomToMongo(roomCode: string): void {
  if (!isDatabaseConnected()) return;
  const room = rooms.get(roomCode);
  const participants = room
    ? Array.from(room).map(c => ({
        participantId: c.participantId,
        name: c.name,
        avatar: c.avatar,
        status: c.status,
        taskDisplay: c.isPrivate ? 'Focusing in stealth mode' : c.taskDisplay,
        isPrivate: c.isPrivate,
        joinedAt: new Date(c.joinedAt),
      }))
    : [];

  FocusRoom.findOneAndUpdate(
    { roomCode },
    {
      $set: {
        participants,
        isActive: participants.length > 0,
        lastActiveAt: new Date(),
      },
    },
    { upsert: true }
  ).catch(err => {
    console.warn('[WS] FocusRoom MongoDB sync warning:', err instanceof Error ? err.message : err);
  });
}

function broadcastRoomState(roomCode: string): void {
  syncRoomToMongo(roomCode);
  const room = rooms.get(roomCode);
  if (!room || room.size === 0) return;

  const participants = Array.from(room).map(toSnapshot);
  const msg: RoomStateMsg = { type: 'ROOM_STATE', roomCode, participants };
  const payload = JSON.stringify(msg);

  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function send(ws: WebSocket, msg: OutboundMsg): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function getActiveRooms(): ActiveRoomSummary[] {
  const result: ActiveRoomSummary[] = [];
  for (const [roomCode, clients] of rooms.entries()) {
    if (clients.size === 0) continue;
    let focusingCount = 0;
    for (const c of clients) {
      if (c.status === 'focusing') focusingCount += 1;
    }
    result.push({
      roomCode,
      participantCount: clients.size,
      maxParticipants: MAX_ROOM_SIZE,
      focusingCount,
    });
  }
  return result.sort((a, b) => b.participantCount - a.participantCount);
}

// ─── WebSocket server factory ─────────────────────────────────────────────────

export function createWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/focus-room' });

  wss.on('connection', (ws: WebSocket) => {
    let boundClient: RoomClient | null = null;

    ws.on('message', (raw) => {
      let msg: InboundMessage;
      try {
        msg = JSON.parse(raw.toString()) as InboundMessage;
      } catch {
        send(ws, { type: 'ERROR', message: 'Invalid JSON payload' });
        return;
      }

      switch (msg.type) {
        case 'JOIN': {
          const roomCode = (msg.roomCode ?? '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, '')
            .slice(0, 16);

          if (!roomCode) {
            send(ws, { type: 'ERROR', message: 'A valid room code is required' });
            return;
          }

          const room = getOrCreateRoom(roomCode);
          const participantId =
            (msg.participantId ?? '').trim() ||
            `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

          // Remove stale connection with same participantId (e.g., on reconnect)
          let preservedJoinedAt: number | null = null;
          for (const existing of room) {
            if (existing.participantId === participantId) {
              preservedJoinedAt = existing.joinedAt;
              room.delete(existing);
            }
          }

          if (room.size >= MAX_ROOM_SIZE) {
            send(ws, { type: 'ERROR', message: `Room is full (max ${MAX_ROOM_SIZE} participants)` });
            return;
          }

          // If already bound to a different room, leave it first
          if (boundClient && boundClient.roomCode !== roomCode) {
            const prevRoom = rooms.get(boundClient.roomCode);
            if (prevRoom) {
              prevRoom.delete(boundClient);
              pruneRoom(boundClient.roomCode);
              broadcastRoomState(boundClient.roomCode);
            }
          }

          const validStatus: ParticipantStatus =
            msg.status === 'paused' || msg.status === 'break' ? msg.status : 'focusing';

          const client: RoomClient = {
            ws,
            participantId,
            roomCode,
            name: (msg.name ?? 'Anonymous Focuser').trim().slice(0, 40) || 'Anonymous Focuser',
            avatar: (msg.avatar ?? '🎯').slice(0, 4) || '🎯',
            status: validStatus,
            taskDisplay: (msg.taskDisplay ?? 'Focused Deep Work').trim().slice(0, 100) || 'Focused Deep Work',
            isPrivate: Boolean(msg.isPrivate),
            joinedAt: preservedJoinedAt ?? Date.now(),
          };

          room.add(client);
          boundClient = client;
          broadcastRoomState(roomCode);
          break;
        }

        case 'UPDATE_STATUS': {
          if (!boundClient) return;
          if (msg.status === 'focusing' || msg.status === 'paused' || msg.status === 'break') {
            boundClient.status = msg.status;
            broadcastRoomState(boundClient.roomCode);
          }
          break;
        }

        case 'UPDATE_TASK': {
          if (!boundClient) return;
          if (typeof msg.taskDisplay === 'string') {
            boundClient.taskDisplay = msg.taskDisplay.trim().slice(0, 100) || 'Focused Deep Work';
          }
          if (typeof msg.isPrivate === 'boolean') {
            boundClient.isPrivate = msg.isPrivate;
          }
          broadcastRoomState(boundClient.roomCode);
          break;
        }

        case 'LEAVE': {
          if (!boundClient) return;
          const room = rooms.get(boundClient.roomCode);
          if (room) {
            room.delete(boundClient);
            const leftCode = boundClient.roomCode;
            boundClient = null;
            pruneRoom(leftCode);
            broadcastRoomState(leftCode);
          }
          break;
        }

        case 'PING': {
          send(ws, { type: 'PONG' });
          break;
        }

        default:
          send(ws, { type: 'ERROR', message: 'Unknown message type' });
      }
    });

    ws.on('close', () => {
      if (boundClient) {
        const room = rooms.get(boundClient.roomCode);
        if (room) {
          room.delete(boundClient);
          const leftCode = boundClient.roomCode;
          pruneRoom(leftCode);
          broadcastRoomState(leftCode);
        }
        boundClient = null;
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] socket error:', err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[WS] server error:', err.message);
  });

  console.log('🔌 WebSocket focus-room server attached at /ws/focus-room');
  return wss;
}
