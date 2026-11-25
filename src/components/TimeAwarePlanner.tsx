import React from 'react';
import { Clock, History } from 'lucide-react';
import type { Task } from '../types/task';
import { useTaskContext } from '../context/TaskContext';

interface TimeAwarePlannerProps {
  task: Task;
  onUpdatePlannedMinutes: (mins: number) => void;
}

export const TimeAwarePlanner: React.FC<TimeAwarePlannerProps> = ({ task, onUpdatePlannedMinutes }) => {
  const { tasks } = useTaskContext();

  // Find completed tasks to provide historical productivity context
  const completedHistory = tasks.filter(t => t.state === 'COMPLETED' && t.actualMinutes > 0);
  const avgHistoricalMinutes = completedHistory.length > 0
    ? Math.round(completedHistory.reduce((acc, t) => acc + t.actualMinutes, 0) / completedHistory.length)
    : 25;

  const durationOptions = [15, 25, 45, 60];
  const delta = task.actualMinutes > 0 ? task.actualMinutes - task.plannedMinutes : 0;

  return (
    <div
      className="time-aware-planner"
      style={{
        marginTop: '16px',
        padding: '16px',
        background: 'var(--bg-surface-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} color="var(--accent-cyan)" /> Time-Aware Productivity Planning
        </h4>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Productivity Metrics Only
        </span>
      </div>

      {/* Planned Duration Picker */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Planned Focus Duration:
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {durationOptions.map(mins => (
            <button
              key={mins}
              id={`planned-duration-btn-${mins}`}
              type="button"
              className="btn"
              onClick={() => onUpdatePlannedMinutes(mins)}
              style={{
                flex: 1,
                minWidth: '60px',
                padding: '8px',
                fontSize: '0.85rem',
                background: task.plannedMinutes === mins ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                color: task.plannedMinutes === mins ? 'var(--primary-text)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: task.plannedMinutes === mins ? 'var(--color-primary)' : 'var(--border-subtle)',
              }}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Display (if completed or has actual duration) */}
      {task.actualMinutes > 0 && (
        <div
          id="time-comparison-box"
          style={{
            padding: '12px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Planned: <strong>{task.plannedMinutes}m</strong>
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Actual: <strong>{task.actualMinutes}m</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Variance:</span>
            {delta === 0 ? (
              <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>Exact match (0m diff)</span>
            ) : delta > 0 ? (
              <span id="time-delta-display" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                +{delta}m (Took {delta} minutes longer than estimated)
              </span>
            ) : (
              <span id="time-delta-display" style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                {delta}m (Finished {Math.abs(delta)} minutes faster than planned)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Historical Timing Support */}
      <div
        id="historical-timing-hint"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          background: 'var(--primary-subtle)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--primary-border)',
        }}
      >
        <History size={15} color="var(--color-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <span>Historical planning calibration: </span>
          <strong style={{ color: 'var(--primary-text)' }}>
            Past completed tasks averaged ~{avgHistoricalMinutes} minutes.
          </strong>{' '}
          Use this historical baseline to plan realistic, stress-free time blocks.
        </div>
      </div>
    </div>
  );
};
