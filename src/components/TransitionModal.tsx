import React from 'react';
import { ArrowRight, Coffee, Lightbulb } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';

export const TransitionModal: React.FC = () => {
  const { isTransitionModalOpen, tasks, completeTransition } = useTaskContext();

  if (!isTransitionModalOpen) return null;

  // Up next available tasks
  const candidateTasks = tasks.filter(t => t.state !== 'COMPLETED');

  const handleSelectNext = (taskId: string) => {
    completeTransition(taskId);
  };

  const handleTakeBreak = () => {
    completeTransition(undefined);
  };

  return (
    <div className="modal-overlay" onClick={() => completeTransition(undefined)}>
      <div
        id="transition-modal"
        className="modal-content glass-panel"
        onClick={e => e.stopPropagation()}
        style={{ padding: '28px', maxWidth: '520px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span className="badge badge-transitioning" style={{ marginBottom: '8px' }}>
            State: Transitioning
          </span>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '6px' }}>
            Mindful Transition Moment
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Take a deep breath. Pausing intentionally between focus blocks reduces task-switching friction.
          </p>
        </div>

        <div
          style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-5)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
          }}
        >
          <Lightbulb size={16} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>ADHD Pacing Tip:</strong> Select your next task now while your mind is still oriented, or step away for water.
          </div>
        </div>

        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Choose What to Prime Next:
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '18px' }}>
          {candidateTasks.slice(0, 4).map(task => (
            <div
              key={task.id}
              id={`transition-task-option-${task.id}`}
              className="glass-panel"
              onClick={() => handleSelectNext(task.id)}
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.2s',
              }}
            >
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{task.title}</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {task.plannedMinutes}m block · Current state: {task.state}
                </div>
              </div>
              <button
                id={`queue-next-btn-${task.id}`}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
              >
                Queue Ready <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <button
            id="transition-take-break-btn"
            className="btn btn-ghost"
            onClick={handleTakeBreak}
            style={{ fontSize: '0.85rem' }}
          >
            <Coffee size={16} /> Take a Rest / Wind Down
          </button>
          <button
            id="transition-close-btn"
            className="btn btn-primary"
            onClick={() => completeTransition(undefined)}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
