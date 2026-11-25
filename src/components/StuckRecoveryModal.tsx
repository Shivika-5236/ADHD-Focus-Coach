import React, { useState } from 'react';
import { Sparkles, HeartHandshake, AlertTriangle, Play, Layers, HelpCircle, BatteryLow } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { ProcessingFailedBanner } from './ProcessingFailedBanner';

const STUCK_REASONS = [
  { label: 'Too big', icon: <Layers size={14} />, value: 'Task feels too big or overwhelming' },
  { label: 'Unclear', icon: <HelpCircle size={14} />, value: 'I am not sure what to do next' },
  { label: 'Perfectionism', icon: <Sparkles size={14} />, value: 'Perfectionism is stopping me from starting' },
  { label: 'Low energy', icon: <BatteryLow size={14} />, value: 'I have low energy or feel drained' },
];

export const StuckRecoveryModal: React.FC = () => {
  const {
    activeTask,
    isStuckModalOpen,
    closeStuckModal,
    requestNextStepHelp,
    startRecoveredStep,
  } = useTaskContext();

  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  if (!isStuckModalOpen || !activeTask) return null;

  const isStalled = activeTask.state === 'STALLED';
  const isRecovery = activeTask.state === 'RECOVERY';
  const isFailed = activeTask.state === 'PROCESSING_FAILED';

  const handleGetHelp = () => {
    requestNextStepHelp(false, selectedReason ?? undefined);
  };

  return (
    <div className="modal-overlay" onClick={closeStuckModal}>
      <div
        id="stuck-recovery-modal"
        className="modal-content glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ padding: '28px', maxWidth: '540px' }}
      >
        {/* STALLED State: Non-punitive, supportive reassurance + why-stuck chips */}
        {isStalled && (
          <div id="stalled-state-view" className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--alert-subtle)',
                  color: 'var(--alert-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HeartHandshake size={20} color="var(--color-alert)" />
              </div>
              <div>
                <span className="badge badge-stalled">State: Stalled</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '2px' }}>
                  Feeling Stuck Is Completely Normal
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
              ADHD resistance happens when the brain feels executive friction or uncertainty. You haven't failed — let's find a microscopic 2-minute way forward together.
            </p>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                borderLeft: '3px solid var(--color-alert)',
                fontSize: '0.85rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Current Task: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{activeTask.title}</strong>
            </div>

            {/* Why I'm stuck chip selector */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
                What's blocking you? <span style={{ fontWeight: 400, opacity: 0.8 }}>(optional — helps AI personalise the micromove)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {STUCK_REASONS.map(reason => {
                  const isSelected = selectedReason === reason.value;
                  return (
                    <button
                      key={reason.value}
                      onClick={() => setSelectedReason(isSelected ? null : reason.value)}
                      className={isSelected ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
                      style={{
                        borderRadius: 'var(--radius-full)',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'var(--primary-subtle)' : 'var(--bg-surface-elevated)',
                        color: isSelected ? 'var(--primary-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {reason.icon}
                      {reason.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                id="get-next-step-help-btn"
                className="btn btn-primary"
                onClick={handleGetHelp}
                disabled={activeTask.isProcessing}
                style={{
                  padding: '12px 18px',
                  fontSize: '0.95rem',
                  background: activeTask.isProcessing
                    ? 'var(--border-subtle)'
                    : 'var(--color-primary)',
                  transition: 'background 0.2s',
                }}
              >
                <Sparkles size={18} />
                {activeTask.isProcessing
                  ? 'Finding your 2-minute micromove…'
                  : selectedReason
                  ? 'Get Personalised Micromove'
                  : 'Get Next Step Help'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <button
                  id="cancel-stuck-modal-btn"
                  className="btn btn-ghost"
                  onClick={closeStuckModal}
                  style={{ fontSize: '0.82rem' }}
                >
                  Close & Return to Timer
                </button>

                {/* Verification helper to test failure transition */}
                <button
                  id="simulate-recovery-failure-btn"
                  className="btn btn-ghost"
                  onClick={() => requestNextStepHelp(true)}
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  title="Test failure state transition"
                >
                  <AlertTriangle size={12} /> Test Error Flow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROCESSING_FAILED inside recovery */}
        {isFailed && (
          <div id="recovery-failed-view" className="animate-fade-in">
            <span className="badge badge-failed" style={{ marginBottom: '10px' }}>
              State: Processing Paused
            </span>
            <ProcessingFailedBanner taskId={activeTask.id} />
            <button
              id="back-to-stalled-btn"
              className="btn btn-secondary"
              onClick={() => closeStuckModal()}
              style={{ marginTop: '12px', width: '100%' }}
            >
              Close
            </button>
          </div>
        )}

        {/* RECOVERY State: AI-generated tailored micromove */}
        {isRecovery && (
          <div id="recovery-state-view" className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--primary-subtle)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <span className="badge badge-recovery">State: Recovery</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '2px' }}>
                  Your 2-Minute Micro-Action
                </h3>
              </div>
            </div>

            <div
              id="suggested-action-box"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary-text)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={12} color="var(--color-primary)" /> AI Micromove — just 2 minutes
              </div>
              <p style={{ fontSize: '1.02rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.55, margin: 0 }}>
                {activeTask.suggestedNextAction || 'Take 2 minutes to write just one sentence about where you are on this task.'}
              </p>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
              Don't think about the whole task. Just commit to this 2-minute step. Momentum will follow.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="start-next-step-btn"
                className="btn btn-primary pulse-action"
                onClick={() => { setSelectedReason(null); startRecoveredStep(); }}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  fontSize: '0.95rem',
                }}
              >
                <Play size={16} /> Start Next Step (Return to Focus)
              </button>
              <button
                id="dismiss-recovery-btn"
                className="btn btn-ghost"
                onClick={() => { setSelectedReason(null); closeStuckModal(); }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
