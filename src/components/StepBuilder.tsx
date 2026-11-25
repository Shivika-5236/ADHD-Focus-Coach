import React, { useState } from 'react';
import { Sparkles, Plus, CheckSquare, Square, AlertTriangle, Clock } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { ProcessingFailedBanner } from './ProcessingFailedBanner';

interface StepBuilderProps {
  taskId: string;
}

export const StepBuilder: React.FC<StepBuilderProps> = ({ taskId }) => {
  const { tasks, toggleStepCompletion, addCustomStep, requestStepBreakdown } = useTaskContext();
  const [newStepTitle, setNewStepTitle] = useState('');
  const [estimatedMins, setEstimatedMins] = useState(10);

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  const completedCount = task.steps.filter(s => s.isCompleted).length;
  const progressPercent = task.steps.length > 0 ? Math.round((completedCount / task.steps.length) * 100) : 0;

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim()) return;
    addCustomStep(taskId, newStepTitle.trim(), estimatedMins);
    setNewStepTitle('');
  };

  return (
    <div className="step-builder" style={{ marginTop: '16px' }}>
      {/* Header & Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Actionable Steps ({completedCount}/{task.steps.length})
        </h4>
        {task.steps.length > 0 && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>
            {progressPercent}% Complete
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {task.steps.length > 0 && (
        <div
          style={{
            height: '6px',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'var(--color-success)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Failure Banner if in PROCESSING_FAILED */}
      <ProcessingFailedBanner taskId={taskId} />

      {/* AI Breakdown Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          id="request-ai-breakdown-btn"
          className="btn btn-secondary"
          onClick={() => requestStepBreakdown(taskId, false)}
          disabled={task.isProcessing}
          style={{
            fontSize: '0.82rem',
            padding: '8px 14px',
          }}
        >
          <Sparkles size={15} />
          {task.isProcessing ? 'Generating micro-steps...' : 'Break Down with AI'}
        </button>

        {/* Demo Failure simulation button for PRD Verification */}
        <button
          id="simulate-failure-btn"
          className="btn btn-ghost"
          onClick={() => requestStepBreakdown(taskId, true)}
          disabled={task.isProcessing}
          title="Simulate processing failure to test recovery"
          style={{
            fontSize: '0.75rem',
            padding: '6px 10px',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <AlertTriangle size={13} /> Test Failure Flow
        </button>
      </div>

      {/* Step List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {task.steps.length === 0 ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            No micro-steps yet. Use <strong>Break Down with AI</strong> or add one below to make starting effortless.
          </div>
        ) : (
          task.steps.map((step, idx) => (
            <div
              key={step.id}
              id={`step-item-${step.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: step.isCompleted ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)',
                border: '1px solid',
                borderColor: step.isCompleted ? 'transparent' : 'var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                transition: 'all 0.2s',
              }}
            >
              <button
                id={`toggle-step-${step.id}`}
                onClick={() => toggleStepCompletion(taskId, step.id)}
                style={{
                  color: step.isCompleted ? 'var(--color-success)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {step.isCompleted ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>

              <span
                style={{
                  flex: 1,
                  fontSize: '0.88rem',
                  textDecoration: step.isCompleted ? 'line-through' : 'none',
                  color: step.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                }}
              >
                <span style={{ color: 'var(--text-muted)', marginRight: '6px', fontSize: '0.8rem' }}>
                  {idx + 1}.
                </span>
                {step.title}
              </span>

              {step.estimatedMinutes && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Clock size={12} /> {step.estimatedMinutes}m
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Custom Step Form */}
      <form onSubmit={handleAddStep} style={{ display: 'flex', gap: '8px' }}>
        <input
          id="custom-step-title-input"
          className="input-text"
          type="text"
          placeholder="Add a tiny micro-action..."
          value={newStepTitle}
          onChange={e => setNewStepTitle(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '8px 12px' }}
        />
        <select
          className="input-text"
          value={estimatedMins}
          onChange={e => setEstimatedMins(Number(e.target.value))}
          style={{ width: '85px', fontSize: '0.85rem', padding: '8px' }}
        >
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
          <option value={15}>15 min</option>
        </select>
        <button
          id="add-custom-step-btn"
          type="submit"
          className="btn btn-secondary"
          disabled={!newStepTitle.trim()}
          style={{ padding: '8px 12px', fontSize: '0.85rem' }}
        >
          <Plus size={16} /> Add
        </button>
      </form>
    </div>
  );
};
