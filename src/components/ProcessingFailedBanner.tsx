import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';

interface ProcessingFailedBannerProps {
  taskId: string;
  onRetrying?: () => void;
}

export const ProcessingFailedBanner: React.FC<ProcessingFailedBannerProps> = ({ taskId, onRetrying }) => {
  const { tasks, retryFailedOperation } = useTaskContext();
  const task = tasks.find(t => t.id === taskId);

  if (!task || task.state !== 'PROCESSING_FAILED') return null;

  const handleRetry = async () => {
    if (onRetrying) onRetrying();
    await retryFailedOperation(taskId);
  };

  return (
    <div
      id="processing-failed-banner"
      style={{
        background: 'var(--alert-subtle)',
        border: '1px solid var(--color-alert)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        margin: '12px 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <div style={{ color: 'var(--color-alert)', marginTop: '2px' }}>
        <AlertCircle size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--alert-text)', marginBottom: '2px' }}>
          Step Breakdown Paused
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {task.processingError || 'A brief hiccup occurred while processing. Your task and notes are completely safe.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            id="retry-processing-btn"
            className="btn btn-warning"
            onClick={handleRetry}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
            }}
          >
            <RotateCw size={14} className={task.isProcessing ? 'spin' : ''} /> Retry Action
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Data preserved safe & sound
          </span>
        </div>
      </div>
    </div>
  );
};
