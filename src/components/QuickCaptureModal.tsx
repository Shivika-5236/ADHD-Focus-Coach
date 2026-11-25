import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, ArrowRight, Sparkles, Loader2, Clock, Flag, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { api } from '../services/api';
import type { TaskStep } from '../types/task';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (taskId: string) => void;
}

interface ScaffoldedStepDraft {
  id: string;
  title: string;
  estimatedMinutes: number;
  isCurrent: boolean;
}

const PRIORITY_OPTIONS: { value: 'low' | 'medium' | 'high'; label: string; activeBg: string; activeColor: string; activeBorder: string }[] = [
  { value: 'low', label: 'Low', activeBg: 'var(--bg-surface)', activeColor: 'var(--text-primary)', activeBorder: 'var(--border-subtle)' },
  { value: 'medium', label: 'Medium', activeBg: 'var(--accent-subtle)', activeColor: 'var(--accent-text)', activeBorder: 'var(--color-accent)' },
  { value: 'high', label: 'High', activeBg: 'var(--alert-subtle)', activeColor: 'var(--alert-text)', activeBorder: 'var(--color-alert)' },
];

const MINUTE_PRESETS = [10, 20, 30, 45, 60];

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({ isOpen, onClose, onTaskCreated }) => {
  if (!isOpen) return null;
  return <QuickCaptureModalBody onClose={onClose} onTaskCreated={onTaskCreated} />;
};

const QuickCaptureModalBody: React.FC<{ onClose: () => void; onTaskCreated?: (taskId: string) => void }> = ({
  onClose,
  onTaskCreated,
}) => {
  const { createTask, projects } = useTaskContext();
  const [brainDump, setBrainDump] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [plannedMinutes, setPlannedMinutes] = useState<number>(20);
  const [projectId, setProjectId] = useState<string>('');
  const [isToday, setIsToday] = useState(true);
  const [scaffoldedSteps, setScaffoldedSteps] = useState<ScaffoldedStepDraft[]>([]);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wasParsed, setWasParsed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brainDumpRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => brainDumpRef.current?.focus(), 50);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const parseSource = brainDump.trim() || [title.trim(), notes.trim()].filter(Boolean).join('\n');

  const handleAIParse = async () => {
    if (!parseSource || isParsing) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const parsed = await api.ai.parseBrainDump({
        rawText: parseSource,
        projects: projects.map(p => ({ id: p.id, name: p.name })),
      });

      setTitle(parsed.title);
      setNotes(parsed.notes);
      setPriority(parsed.priority);
      setPlannedMinutes(parsed.plannedMinutes);
      setIsToday(parsed.isToday);
      if (parsed.suggestedProjectId) {
        setProjectId(parsed.suggestedProjectId);
      }

      const now = Date.now();
      setScaffoldedSteps(
        (parsed.steps || []).map((s, idx) => ({
          id: `draft-step-${now}-${idx + 1}`,
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          isCurrent: idx === 0,
        }))
      );
      setWasParsed(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not parse your brain dump. Please try again.';
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleBrainDumpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAIParse();
    }
  };

  const handleRemoveStep = (stepId: string) => {
    setScaffoldedSteps(prev =>
      prev
        .filter(s => s.id !== stepId)
        .map((s, idx) => ({ ...s, isCurrent: idx === 0 }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const clampedMinutes = Math.min(180, Math.max(5, Math.round(Number(plannedMinutes) || 20)));
      const stepsToCreate: TaskStep[] = scaffoldedSteps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx + 1}`,
        title: s.title,
        isCompleted: false,
        isCurrent: idx === 0,
        estimatedMinutes: s.estimatedMinutes,
      }));

      // US-002: Creates task in CAPTURED state with minimal friction (with optional AI auto-scaffolding)
      const newTask = await createTask(
        title.trim(),
        notes.trim() || undefined,
        isToday,
        projectId || undefined,
        {
          priority,
          plannedMinutes: clampedMinutes,
          steps: stepsToCreate,
        }
      );
      onClose();
      if (onTaskCreated) {
        onTaskCreated(newTask.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-panel"
        onClick={e => e.stopPropagation()}
        style={{
          padding: '24px',
          position: 'relative',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'var(--primary-subtle)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Quick Task Capture</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Dump raw thoughts and let AI organize, or fill in fields directly.
              </p>
            </div>
          </div>
          <button
            id="close-quick-capture-btn"
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '6px' }}
            aria-label="Close quick capture modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Brain-Dump & Auto-Scaffolding Panel */}
        <div
          style={{
            background: 'var(--primary-subtle)',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
            <label
              htmlFor="brain-dump-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--primary-text)',
              }}
            >
              <Sparkles size={14} />
              AI Brain-Dump
            </label>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary-text)' }}>
              Unorganized thought → clean task
            </span>
          </div>

          <textarea
            id="brain-dump-input"
            ref={brainDumpRef}
            className="input-text"
            rows={2}
            placeholder="Ramble freely... e.g. 'ugh gotta finish Q3 budget slides before 5pm, need Sarah's CSV numbers, probably 45 mins, super urgent'"
            value={brainDump}
            onChange={e => {
              setBrainDump(e.target.value);
              if (parseError) setParseError(null);
            }}
            onKeyDown={handleBrainDumpKeyDown}
            disabled={isParsing}
            style={{
              resize: 'vertical',
              fontSize: '0.86rem',
              padding: '9px 12px',
              background: 'var(--bg-input)',
              borderColor: 'var(--primary-border)',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {wasParsed ? (
                <span style={{ color: 'var(--success-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} color="var(--color-success)" />
                  Auto-scaffolded! Review or tweak below.
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>Tip: Press ⌘↵ / Ctrl↵ to parse</span>
              )}
            </div>

            <button
              id="ai-parse-brain-dump-btn"
              type="button"
              className="btn"
              onClick={handleAIParse}
              disabled={!parseSource || isParsing}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                borderRadius: 'var(--radius-sm)',
                background: !parseSource || isParsing ? 'var(--border-subtle)' : 'var(--color-primary)',
                color: !parseSource || isParsing ? 'var(--text-muted)' : 'var(--text-on-primary)',
                cursor: !parseSource || isParsing ? 'not-allowed' : 'pointer',
              }}
            >
              {isParsing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  AI Parse
                </>
              )}
            </button>
          </div>

          {parseError && (
            <div
              role="alert"
              style={{
                marginTop: '8px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--alert-subtle)',
                border: '1px solid var(--color-alert)',
                color: 'var(--alert-text)',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {parseError}
              </span>
              <button
                type="button"
                onClick={handleAIParse}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--alert-text)',
                  textDecoration: 'underline',
                  flexShrink: 0,
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Structured Task Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="quick-task-title-input"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}
            >
              Task Title (Required)
            </label>
            <input
              id="quick-task-title-input"
              className="input-text"
              type="text"
              placeholder="e.g. Write executive summary draft"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="quick-task-notes-input"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}
            >
              Notes / Context (Optional)
            </label>
            <textarea
              id="quick-task-notes-input"
              className="input-text"
              rows={2}
              placeholder="Any quick thoughts, links, or details..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Priority & Focus Minutes Row */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {/* Priority */}
            <div style={{ flex: '1 1 190px' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                <Flag size={12} /> Priority
              </span>
              <div
                id="quick-task-priority-group"
                role="radiogroup"
                aria-label="Task priority"
                style={{ display: 'flex', gap: '6px' }}
              >
                {PRIORITY_OPTIONS.map(opt => {
                  const isActive = priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      id={`quick-task-priority-${opt.value}`}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setPriority(opt.value)}
                      style={{
                        flex: 1,
                        padding: '7px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 600 : 500,
                        background: isActive ? opt.activeBg : 'var(--bg-surface-elevated)',
                        color: isActive ? opt.activeColor : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? opt.activeBorder : 'var(--border-subtle)'}`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estimated Focus Minutes */}
            <div style={{ flex: '1.2 1 220px' }}>
              <label
                htmlFor="quick-task-minutes-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                <Clock size={12} /> Estimated Minutes
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <input
                  id="quick-task-minutes-input"
                  className="input-text"
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={plannedMinutes}
                  onChange={e => setPlannedMinutes(Math.max(1, Number(e.target.value) || 0))}
                  style={{ width: '68px', padding: '6px 8px', fontSize: '0.84rem', textAlign: 'center' }}
                />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {MINUTE_PRESETS.map(mins => {
                    const isSelected = plannedMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setPlannedMinutes(mins)}
                        style={{
                          padding: '5px 7px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.74rem',
                          fontWeight: isSelected ? 600 : 500,
                          background: isSelected ? 'var(--primary-subtle)' : 'var(--bg-surface-elevated)',
                          color: isSelected ? 'var(--primary-text)' : 'var(--text-secondary)',
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        {mins}m
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Project & Today Row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label
                htmlFor="quick-task-project-select"
                style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}
              >
                Link Project (Optional)
              </label>
              <select
                id="quick-task-project-select"
                className="input-text"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="">No Project (Standalone)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px', gap: '8px' }}>
              <input
                id="quick-task-today-checkbox"
                type="checkbox"
                checked={isToday}
                onChange={e => setIsToday(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
              />
              <label htmlFor="quick-task-today-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Add to Today's Focus
              </label>
            </div>
          </div>

          {/* Auto-Scaffolded Starter Steps Preview */}
          {scaffoldedSteps.length > 0 && (
            <div
              id="scaffolded-steps-preview"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} color="var(--color-primary)" />
                  Auto-Scaffolded Starter Steps ({scaffoldedSteps.length})
                </span>
                <button
                  type="button"
                  onClick={() => setScaffoldedSteps([])}
                  style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                >
                  Clear steps
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {scaffoldedSteps.map((step, idx) => (
                  <div
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>
                      {idx + 1}.
                    </span>
                    <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                      {step.title}
                    </span>
                    {idx === 0 && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--accent-subtle)',
                          color: 'var(--accent-text)',
                          border: '1px solid var(--color-accent)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Starter
                      </span>
                    )}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {step.estimatedMinutes}m
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(step.id)}
                      aria-label={`Remove step ${idx + 1}`}
                      style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Helper hint */}
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Captured tasks start in <strong>CAPTURED</strong> state. You can adjust steps or duration anytime.
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              id="cancel-quick-capture-btn"
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              id="submit-quick-capture-btn"
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || isSubmitting}
              style={{ opacity: !title.trim() || isSubmitting ? 0.5 : 1 }}
            >
              Capture Task <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
