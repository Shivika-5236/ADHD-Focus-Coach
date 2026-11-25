import React, { useState } from 'react';
import { Play, Pause, AlertCircle, CheckCircle2, ArrowRight, Minimize2, Sparkles } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { soundEngine } from '../utils/audioSynthesizer';
import type { SoundscapeType } from '../utils/audioSynthesizer';
import { StuckRecoveryModal } from './StuckRecoveryModal';
import { TransitionModal } from './TransitionModal';

export const FocusSessionView: React.FC = () => {
  const {
    activeTask,
    activeSession,
    isFocusModeActive,
    pauseFocusSession,
    resumeFocusSession,
    completeActiveTask,
    endFocusSessionWithoutCompleting,
    triggerStalled,
    triggerTransitionFlow,
    toggleStepCompletion,
  } = useTaskContext();

  const [sound, setSound] = useState<SoundscapeType>('none');

  if (!isFocusModeActive || !activeTask || !activeSession) return null;

  const isPaused = activeTask.state === 'PAUSED';
  const elapsed = activeSession.elapsedSeconds;
  const plannedSecs = activeSession.plannedSeconds || 1500;
  const remainingSecs = Math.max(0, plannedSecs - elapsed);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, Math.round((elapsed / plannedSecs) * 100));

  const handleSoundToggle = (type: SoundscapeType) => {
    setSound(type);
    soundEngine.playSoundscape(type);
  };

  const activeStep = activeTask.steps.find(s => !s.isCompleted);

  return (
    <div
      id="focus-session-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        background: '#0B1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-6)',
        color: '#F1F5F9',
        animation: 'fadeIn 180ms ease-out',
      }}
    >
      {/* Modals inside focus view */}
      <StuckRecoveryModal />
      <TransitionModal />

      {/* Top Header Controls */}
      <header style={{ width: '100%', maxWidth: '850px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            id="focus-state-badge"
            className={`badge ${isPaused ? 'badge-paused' : 'badge-focusing'}`}
          >
            {isPaused ? 'Session Paused' : 'Active Focus Block'}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#E1EEFF', opacity: 0.85 }}>
            Single Task Mode
          </span>
        </div>

        {/* Ambient Sound & Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(225, 238, 255, 0.1)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            {(['none', 'rain', 'binaural40hz', 'cafe'] as const).map(type => (
              <button
                key={type}
                id={`focus-sound-btn-${type}`}
                className="btn btn-ghost"
                onClick={() => handleSoundToggle(type)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  background: sound === type ? 'var(--color-primary)' : 'transparent',
                  color: sound === type ? '#FFFFFF' : '#E1EEFF',
                }}
              >
                {type === 'none' ? 'Mute' : type === 'binaural40hz' ? '40Hz' : type}
              </button>
            ))}
          </div>

          <button
            id="minimize-focus-btn"
            className="btn btn-ghost"
            onClick={() => endFocusSessionWithoutCompleting()}
            title="Return to dashboard (session stays ready)"
            style={{ padding: '8px', color: '#E1EEFF' }}
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </header>

      {/* Dominant Center: Single Task & Focus Timer */}
      <main
        style={{
          width: '100%',
          maxWidth: '700px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px',
        }}
      >
        {/* Subtle breathing glow */}
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: isPaused
              ? 'radial-gradient(circle, rgba(255, 201, 60, 0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />

        {/* Task Title (Dominant Element) */}
        <div>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)', fontWeight: 600 }}>
            Current Focus Task
          </span>
          <h1
            id="focus-active-task-title"
            style={{
              fontSize: '2.2rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginTop: '6px',
              maxWidth: '650px',
              lineHeight: 1.25,
              color: '#F4F9FF',
            }}
          >
            {activeTask.title}
          </h1>
        </div>

        {/* Micro-Step in focus */}
        {activeStep ? (
          <div
            id="focus-current-step-box"
            style={{
              background: 'rgba(225, 238, 255, 0.08)',
              border: '1px solid rgba(225, 238, 255, 0.18)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '520px',
              width: '100%',
            }}
          >
            <div style={{ color: 'var(--color-accent)' }}>
              <Sparkles size={18} />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: '#E1EEFF', opacity: 0.8, textTransform: 'uppercase' }}>
                Current Sub-Step
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F4F9FF' }}>{activeStep.title}</div>
            </div>
            <button
              id="complete-current-step-btn"
              className="btn btn-secondary"
              onClick={() => toggleStepCompletion(activeTask.id, activeStep.id)}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              Done <CheckCircle2 size={14} color="var(--color-success)" />
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.88rem', color: '#E1EEFF', opacity: 0.85 }}>
            All planned sub-steps complete! Finish the task or continue deep work.
          </div>
        )}

        {/* Timer Display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            id="focus-timer-display"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-timer)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
              color: isPaused ? 'var(--color-accent)' : '#F1F5F9',
              lineHeight: 1,
            }}
          >
            {formatTime(remainingSecs)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#E1EEFF', opacity: 0.8, marginTop: '8px' }}>
            Elapsed: {formatTime(elapsed)} · Planned: {activeTask.plannedMinutes}m
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            height: '8px',
            background: 'rgba(225, 238, 255, 0.16)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: isPaused
                ? 'var(--color-accent)'
                : 'var(--color-primary)',
              transition: 'width 1s linear',
            }}
          />
        </div>

        {/* Primary Controls (US-005: Pause, Resume, I'm Stuck, Complete) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isPaused ? (
            <button
              id="resume-focus-session-btn"
              className="btn btn-primary"
              onClick={resumeFocusSession}
              style={{ padding: '14px 28px', fontSize: '1.05rem', minWidth: '170px' }}
            >
              <Play size={20} /> Resume Focus
            </button>
          ) : (
            <button
              id="pause-focus-session-btn"
              className="btn btn-secondary"
              onClick={pauseFocusSession}
              style={{ padding: '14px 28px', fontSize: '1.05rem', minWidth: '170px' }}
            >
              <Pause size={20} /> Pause Session
            </button>
          )}

          {/* US-006: "I'm Stuck" Button */}
          <button
            id="im-stuck-btn"
            className="btn btn-outline-amber"
            onClick={() => triggerStalled()}
            style={{ padding: '14px 24px', fontSize: '0.98rem' }}
          >
            <AlertCircle size={18} /> I'm Stuck
          </button>

          {/* Task Completion Button */}
          <button
            id="complete-task-btn"
            className="btn btn-success"
            onClick={completeActiveTask}
            style={{
              padding: '14px 26px',
              fontSize: '0.98rem',
            }}
          >
            <CheckCircle2 size={18} /> Complete Task
          </button>
        </div>
      </main>

      {/* Bottom Footer Controls */}
      <footer style={{ width: '100%', maxWidth: '850px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#E1EEFF', opacity: 0.85 }}>
        <div>
          ADHD Focus Coach · Distraction-Free Flow
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="transition-flow-btn"
            className="btn btn-ghost"
            onClick={() => triggerTransitionFlow()}
            style={{ fontSize: '0.8rem', color: '#E1EEFF' }}
          >
            Finish Block / Transition <ArrowRight size={14} />
          </button>
          <button
            id="exit-focus-session-btn"
            className="btn btn-ghost"
            onClick={() => endFocusSessionWithoutCompleting()}
            style={{ fontSize: '0.8rem', color: '#E1EEFF' }}
          >
            End Session
          </button>
        </div>
      </footer>
    </div>
  );
};
