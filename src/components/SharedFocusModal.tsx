import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  LogOut,
  Shield,
  ShieldOff,
  Circle,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  Plus,
  ArrowRight,
  Coffee,
  Pause,
  Play,
} from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const AVATAR_OPTIONS = ['🌟', '🎯', '⚡', '🧠', '🌿', '🚀'];
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ActiveRoom {
  roomCode: string;
  participantCount: number;
  maxParticipants: number;
  focusingCount: number;
}

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

export const SharedFocusModal: React.FC = () => {
  const { user } = useAuth();
  const {
    activeTask,
    sharedParticipants,
    isSharedSessionActive,
    sharedRoomCode,
    sharedParticipantId,
    sharedConnectionState,
    sharedConnectionError,
    sharedIsPrivate,
    sharedStatus,
    joinSharedSession,
    leaveSharedSession,
    toggleSharedPrivacy,
    updateSharedStatus,
    updateSharedTaskDisplay,
  } = useTaskContext();

  // Lobby form state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState(user?.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState('🌟');
  const [joinPrivate, setJoinPrivate] = useState(false);

  // Active room UI state
  const [copiedCode, setCopiedCode] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Live rooms list from backend
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const fetchActiveRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const res = await api.focusRooms.list();
      const rooms = Array.isArray(res) ? res : ((res as any)?.data && Array.isArray((res as any).data) ? (res as any).data : []);
      setActiveRooms(rooms);
      setRoomsError(null);
    } catch {
      setRoomsError('Could not load live rooms. Make sure the backend server is running.');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  // Poll active rooms while in the lobby
  useEffect(() => {
    if (isSharedSessionActive) return;
    let active = true;

    const load = async () => {
      try {
        const res = await api.focusRooms.list();
        if (active) {
          const rooms = Array.isArray(res) ? res : ((res as any)?.data && Array.isArray((res as any).data) ? (res as any).data : []);
          setActiveRooms(rooms);
          setRoomsError(null);
        }
      } catch {
        if (active) {
          setRoomsError('Could not load live rooms. Make sure the backend server is running.');
        }
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 15_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isSharedSessionActive]);

  // Update elapsed minute display smoothly while in a room
  useEffect(() => {
    if (!isSharedSessionActive) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, [isSharedSessionActive]);

  const effectiveName = displayNameInput.trim() || user?.name || 'Focus Guest';

  const handleCreateRoom = () => {
    const newCode = generateRoomCode();
    joinSharedSession(newCode, joinPrivate, {
      displayName: effectiveName,
      avatar: selectedAvatar,
    });
  };

  const handleJoinRoom = (codeToJoin?: string) => {
    const target = (codeToJoin ?? joinCodeInput).trim().toUpperCase();
    if (!target) return;
    joinSharedSession(target, joinPrivate, {
      displayName: effectiveName,
      avatar: selectedAvatar,
    });
  };

  const handleCopyCode = async () => {
    if (!sharedRoomCode) return;
    try {
      await navigator.clipboard.writeText(sharedRoomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleTaskDraftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSharedTaskDisplay(taskDraft);
  };

  const getElapsedMinutes = (elapsedMinutes: number, joinedAt?: number): number => {
    if (!joinedAt) return elapsedMinutes;
    return Math.max(0, Math.floor((nowMs - joinedAt) / 60_000));
  };

  const connectionBadge = (() => {
    switch (sharedConnectionState) {
      case 'connected':
        return {
          label: 'Live · Connected',
          color: 'var(--success-text)',
          bg: 'var(--success-subtle)',
          icon: <Wifi size={13} color="var(--color-success)" />,
        };
      case 'connecting':
        return {
          label: 'Connecting…',
          color: 'var(--accent-text)',
          bg: 'var(--accent-subtle)',
          icon: <Loader2 size={13} className="animate-spin" />,
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting…',
          color: 'var(--accent-text)',
          bg: 'var(--accent-subtle)',
          icon: <Loader2 size={13} className="animate-spin" />,
        };
      default:
        return {
          label: 'Offline',
          color: 'var(--text-muted)',
          bg: 'var(--bg-surface-elevated)',
          icon: <WifiOff size={13} />,
        };
    }
  })();

  const statusMeta = (status: 'focusing' | 'paused' | 'break') => {
    if (status === 'focusing') return { label: 'Focusing', color: 'var(--primary-text)' };
    if (status === 'paused') return { label: 'Paused', color: 'var(--accent-text)' };
    return { label: 'On Break', color: 'var(--success-text)' };
  };

  const roomsList = Array.isArray(activeRooms) ? activeRooms : [];
  const participantsList = Array.isArray(sharedParticipants) ? sharedParticipants : [];

  return (
    <div className="page-shell animate-fade-in">
      {!isSharedSessionActive ? (
        <>
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Shared Focus</h1>
              <p className="page-subtitle">
                Real-time silent body doubling. Work side by side with live presence.
              </p>
            </div>
            <button
              id="create-shared-room-header-btn"
              onClick={handleCreateRoom}
              className="btn btn-primary"
            >
              <Plus size={16} /> Create Room
            </button>
          </div>

          {/* Main Setup & Join Card */}
          <div className="white-card" style={{ padding: '36px 28px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: 'var(--primary-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <Users size={30} color="var(--color-primary)" />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Focus Together in Real Time
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '520px', margin: 0 }}>
                Start a silent body-doubling room and share the 4-character room code, or join an existing session below. Up to 8 co-workers per room.
              </p>
            </div>

            {/* Identity & Privacy Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                maxWidth: '720px',
                margin: '0 auto 24px',
                padding: '18px',
                borderRadius: '12px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <label
                  htmlFor="shared-display-name-input"
                  style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}
                >
                  Display Name
                </label>
                <input
                  id="shared-display-name-input"
                  type="text"
                  value={displayNameInput}
                  onChange={e => setDisplayNameInput(e.target.value)}
                  placeholder={user?.name || 'Focus Guest'}
                  maxLength={40}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Avatar
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {AVATAR_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      aria-label={`Select avatar ${emoji}`}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: selectedAvatar === emoji ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                        background: selectedAvatar === emoji ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    id="shared-join-private-checkbox"
                    type="checkbox"
                    checked={joinPrivate}
                    onChange={e => setJoinPrivate(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                  />
                  <span>Stealth Mode</span>
                </label>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hide your task title from others in the room
                </span>
              </div>
            </div>

            {/* Create or Join Controls */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <button
                id="create-shared-room-btn"
                onClick={handleCreateRoom}
                className="btn btn-primary"
                style={{
                  padding: '11px 24px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> Create New Room
              </button>

              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>or</span>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleJoinRoom();
                }}
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <input
                  id="shared-room-code-input"
                  type="text"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16))}
                  placeholder="Enter code (e.g. A7K9)"
                  style={{
                    width: '185px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                />
                <button
                  id="join-shared-room-btn"
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="btn btn-secondary"
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Join <ArrowRight size={15} />
                </button>
              </form>
            </div>
          </div>

          {/* Live Active Rooms List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 4px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                Live Active Rooms
                {roomsList.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'var(--success-subtle)',
                      color: 'var(--success-text)',
                      border: '1px solid var(--color-success)',
                    }}
                  >
                    {roomsList.length} Live
                  </span>
                )}
              </h3>
              <button
                id="refresh-active-rooms-btn"
                onClick={() => void fetchActiveRooms()}
                disabled={isLoadingRooms}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} className={isLoadingRooms ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {roomsError && (
              <div
                className="white-card"
                style={{
                  padding: '16px 20px',
                  marginBottom: '14px',
                  borderColor: 'var(--color-alert)',
                  background: 'var(--alert-subtle)',
                  color: 'var(--alert-text)',
                  fontSize: '0.85rem',
                }}
              >
                {roomsError}
              </div>
            )}

            {roomsList.length === 0 ? (
              <div className="white-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem', margin: 0 }}>
                  No live rooms active right now. Create a room and share the code to start focusing together!
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                {roomsList.map(room => {
                  const isFull = room.participantCount >= room.maxParticipants;
                  return (
                    <div
                      key={room.roomCode}
                      className="white-card"
                      style={{
                        padding: '18px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {room.roomCode}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--primary-text)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Circle size={7} fill="var(--color-primary)" color="var(--color-primary)" /> {room.focusingCount} focusing
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {room.participantCount} / {room.maxParticipants} co-workers
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinRoom(room.roomCode)}
                        disabled={isFull}
                        className={isFull ? 'btn btn-secondary' : 'btn btn-primary'}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: isFull ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isFull ? 'Full' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Active Live WebSocket Room View */
        <div className="white-card" style={{ padding: '28px' }}>
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '18px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: connectionBadge.bg,
                    color: connectionBadge.color,
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  {connectionBadge.icon}
                  {connectionBadge.label}
                </span>

                <button
                  id="copy-room-code-btn"
                  onClick={() => void handleCopyCode()}
                  title="Copy room code to invite co-workers"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                  }}
                >
                  ROOM: {sharedRoomCode}
                  {copiedCode ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                </button>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {participantsList.length} / 8 Co-Workers Active
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Silent Body Doubling Room
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                id="toggle-shared-privacy-btn"
                className="btn btn-secondary"
                onClick={toggleSharedPrivacy}
                style={{ fontSize: '0.82rem', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {sharedIsPrivate ? <Shield size={14} color="var(--color-success)" /> : <ShieldOff size={14} />}
                {sharedIsPrivate ? 'Stealth: ON' : 'Stealth: OFF'}
              </button>
              <button
                id="leave-shared-room-btn"
                className="btn btn-danger"
                onClick={leaveSharedSession}
                style={{ fontSize: '0.82rem', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={14} /> Leave Room
              </button>
            </div>
          </div>

          {/* Connection Error Alert */}
          {sharedConnectionError && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--alert-subtle)',
                border: '1px solid var(--color-alert)',
                color: 'var(--alert-text)',
                fontSize: '0.84rem',
                fontWeight: 500,
                marginBottom: '18px',
              }}
            >
              {sharedConnectionError}
            </div>
          )}

          {/* Your Presence Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
                Your Status:
              </span>
              {(
                [
                  { id: 'focusing', label: 'Focusing', icon: <Play size={12} /> },
                  { id: 'paused', label: 'Paused', icon: <Pause size={12} /> },
                  { id: 'break', label: 'Break', icon: <Coffee size={12} /> },
                ] as const
              ).map(opt => {
                const isActive = sharedStatus === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`shared-status-${opt.id}-btn`}
                    type="button"
                    onClick={() => updateSharedStatus(opt.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      background: isActive ? 'var(--color-primary)' : 'var(--bg-surface)',
                      color: isActive ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleTaskDraftSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 260px', maxWidth: '420px' }}>
              <input
                id="shared-task-display-input"
                type="text"
                value={taskDraft}
                onChange={e => setTaskDraft(e.target.value)}
                placeholder={
                  sharedIsPrivate
                    ? 'Hidden (Stealth Mode active)'
                    : activeTask?.title || 'Share what you are working on…'
                }
                disabled={sharedIsPrivate}
                maxLength={100}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  opacity: sharedIsPrivate ? 0.6 : 1,
                }}
              />
              <button
                id="update-shared-task-btn"
                type="submit"
                disabled={sharedIsPrivate}
                className="btn btn-secondary"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Update
              </button>
            </form>
          </div>

          {/* Live Participants Grid */}
          {participantsList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ marginBottom: '10px', opacity: 0.7 }} />
              <p style={{ fontSize: '0.88rem', margin: 0 }}>
                {sharedConnectionState === 'connected'
                  ? 'Syncing room roster…'
                  : 'Connecting to live focus room…'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {participantsList.map(participant => {
                const isSelf = participant.id === sharedParticipantId;
                const sMeta = statusMeta(participant.status);
                const mins = getElapsedMinutes(participant.elapsedMinutes, participant.joinedAt);

                return (
                  <div
                    key={participant.id}
                    style={{
                      padding: '16px',
                      background: isSelf ? 'var(--primary-subtle)' : 'var(--bg-surface-elevated)',
                      border: isSelf ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{participant.avatar}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                        <strong
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {participant.name}
                          {isSelf && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary-text)', marginLeft: '6px' }}>
                              (You)
                            </span>
                          )}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: sMeta.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                          }}
                        >
                          <Circle size={8} fill="currentColor" /> {sMeta.label}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: participant.isPrivate ? 'var(--text-muted)' : 'var(--text-secondary)',
                          fontStyle: participant.isPrivate ? 'italic' : 'normal',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {participant.taskDisplay}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {mins === 0 ? 'Just joined' : `In room for ${mins}m`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Subtle tip */}
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '20px', marginBottom: 0 }}>
            Tip: Your room connection stays live if you switch tabs to your Focus Timer, and your active task &amp; pause state sync automatically.
          </p>
        </div>
      )}
    </div>
  );
};
