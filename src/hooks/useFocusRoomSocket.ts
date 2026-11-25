import { useState, useEffect, useRef, useCallback } from 'react';
import type { SharedParticipant } from '../types/task';

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface FocusRoomIdentity {
  participantId: string;
  name: string;
  avatar: string;
  status: 'focusing' | 'paused' | 'break';
  taskDisplay: string;
  isPrivate: boolean;
}

interface RoomStateServerMsg {
  type: 'ROOM_STATE';
  roomCode: string;
  participants: SharedParticipant[];
}

interface ErrorServerMsg {
  type: 'ERROR';
  message: string;
}

interface PongServerMsg {
  type: 'PONG';
}

type ServerMsg = RoomStateServerMsg | ErrorServerMsg | PongServerMsg;

const HEARTBEAT_INTERVAL_MS = 25_000;
const BASE_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 10_000;

function buildWebSocketUrl(): string {
  const customUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (customUrl) return customUrl;
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (apiUrl) {
    const wsBase = apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBase}/ws/focus-room`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/focus-room`;
}

export function useFocusRoomSocket(
  roomCode: string | null,
  identity: FocusRoomIdentity
) {
  const [rawParticipants, setRawParticipants] = useState<SharedParticipant[]>([]);
  const [rawConnectionState, setRawConnectionState] = useState<SocketConnectionState>('disconnected');
  const [rawError, setRawError] = useState<string | null>(null);
  const [connectedRoomCode, setConnectedRoomCode] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const identityRef = useRef<FocusRoomIdentity>(identity);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  const sendPayload = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const sendStatus = useCallback(
    (status: 'focusing' | 'paused' | 'break') => {
      sendPayload({ type: 'UPDATE_STATUS', status });
    },
    [sendPayload]
  );

  const sendTaskUpdate = useCallback(
    (taskDisplay: string, isPrivate: boolean) => {
      sendPayload({ type: 'UPDATE_TASK', taskDisplay, isPrivate });
    },
    [sendPayload]
  );

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'LEAVE' }));
      }
      ws.close(1000, 'Left room');
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    let cancelled = false;
    let attempt = 0;
    intentionalCloseRef.current = false;

    const clearTimers = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const connect = () => {
      if (cancelled) return;

      const ws = new WebSocket(buildWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close(1000, 'Cancelled');
          return;
        }
        attempt = 0;
        setRawConnectionState('connected');
        setRawError(null);
        setConnectedRoomCode(roomCode);

        const current = identityRef.current;
        ws.send(
          JSON.stringify({
            type: 'JOIN',
            roomCode,
            participantId: current.participantId,
            name: current.name,
            avatar: current.avatar,
            status: current.status,
            taskDisplay: current.taskDisplay,
            isPrivate: current.isPrivate,
          })
        );

        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data) as ServerMsg;
          if (msg.type === 'ROOM_STATE') {
            setRawParticipants(msg.participants);
            setConnectedRoomCode(msg.roomCode);
          } else if (msg.type === 'ERROR') {
            setRawError(msg.message);
          }
        } catch {
          // Ignore malformed server frames
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        setRawError('Unable to reach focus room server. Retrying…');
      };

      ws.onclose = () => {
        clearTimers();
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (cancelled || intentionalCloseRef.current) {
          setRawConnectionState('disconnected');
          return;
        }

        attempt += 1;
        setRawConnectionState('reconnecting');
        const delay = Math.min(BASE_RECONNECT_DELAY_MS * attempt, MAX_RECONNECT_DELAY_MS);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      intentionalCloseRef.current = true;
      clearTimers();
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'LEAVE' }));
        }
        ws.close(1000, 'Cleanup');
        wsRef.current = null;
      }
    };
  }, [roomCode]);

  const isSameRoom = roomCode !== null && connectedRoomCode === roomCode;
  const participants = isSameRoom ? rawParticipants : [];
  const connectionState: SocketConnectionState = !roomCode
    ? 'disconnected'
    : !isSameRoom && rawConnectionState !== 'reconnecting'
      ? 'connecting'
      : rawConnectionState === 'disconnected'
        ? 'connecting'
        : rawConnectionState;
  const error = roomCode ? rawError : null;

  return {
    participants,
    connectionState,
    error,
    sendStatus,
    sendTaskUpdate,
    disconnect,
  };
}
