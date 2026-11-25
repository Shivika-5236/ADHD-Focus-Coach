import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Target, Plus, Trash2 } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';

interface AddFocusSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddFocusSessionModal: React.FC<AddFocusSessionModalProps> = ({ isOpen, onClose }) => {
  const { tasks, startFocusSession, createFocusSession } = useTaskContext();
  
  const [sessionName, setSessionName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [currentStepInput, setCurrentStepInput] = useState('');
  const [durationPreset, setDurationPreset] = useState<number>(25);
  const [customDuration, setCustomDuration] = useState<number>(30);
  const [sessionMode, setSessionMode] = useState<'focus' | 'focus_break'>('focus');
  const [breakDuration, setBreakDuration] = useState<number>(5);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSessionName('');
      setSelectedTaskId('');
      setTaskNotes('');
      setSteps([]);
      setCurrentStepInput('');
      setDurationPreset(25);
      setSessionMode('focus');
      setBreakDuration(5);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter out completed tasks for the dropdown
  const availableTasks = tasks.filter(t => t.state !== 'COMPLETED');

  const handleAddStep = () => {
    if (!currentStepInput.trim()) return;
    setSteps(prev => [...prev, currentStepInput.trim()]);
    setCurrentStepInput('');
  };

  const handleRemoveStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalDuration = durationPreset === 0 ? customDuration : durationPreset;
    if (finalDuration <= 0) return;

    // Combine notes
    const parts: string[] = [];
    if (taskNotes.trim()) parts.push(taskNotes.trim());
    if (sessionMode === 'focus_break') parts.push(`Break configured: ${breakDuration} min`);
    const combinedNotes = parts.join('\n\n');

    // Include any pending step in currentStepInput
    const finalSteps = [...steps];
    if (currentStepInput.trim()) {
      finalSteps.push(currentStepInput.trim());
    }

    if (!selectedTaskId) {
      // Create and start ad-hoc focus session directly with custom steps
      createFocusSession(
        sessionName.trim() || 'Make focus session',
        finalDuration,
        combinedNotes,
        finalSteps
      );
    } else {
      // Start existing task focus session
      startFocusSession(selectedTaskId, finalDuration, combinedNotes);
    }

    onClose();
  };

  const presetOptions = [15, 25, 45, 60, 0];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '500px', width: '100%', background: 'var(--bg-surface)', borderRadius: '16px', boxShadow: 'var(--shadow-elevation)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={18} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>Make Focus Session</h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 1. Session Name / Task Title */}
          <div>
            <label htmlFor="session-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              What are you working on? (Optional)
            </label>
            <input
              id="session-name"
              ref={inputRef}
              type="text"
              className="input-text"
              placeholder="e.g. Complete DBMS assignment"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              disabled={!!selectedTaskId}
              style={{ opacity: selectedTaskId ? 0.6 : 1 }}
            />
          </div>

          {/* 2. Select Existing Task */}
          <div>
            <label htmlFor="task-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Associate with Existing Task (Optional)
            </label>
            <select
              id="task-select"
              className="input-text"
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
            >
              <option value="">No task (Create as new task / session)</option>
              {availableTasks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* 3. Sub-steps / Checklist (Only for new session/task) */}
          {!selectedTaskId && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Task Steps & Breakdown (Optional)
              </label>
              
              {/* Existing steps list */}
              {steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {steps.map((step, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{idx + 1}.</span>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{step}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-alert)')}
                        onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Step input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="Add a step (e.g. Draft chapter outline)..."
                  value={currentStepInput}
                  onChange={e => setCurrentStepInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStep();
                    }
                  }}
                  style={{ flex: 1, fontSize: '0.9rem' }}
                />
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
          )}

          {/* 4. Optional Task Notes */}
          {!selectedTaskId && (
            <div>
              <label htmlFor="task-notes" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Task Notes / Details (Optional)
              </label>
              <textarea
                id="task-notes"
                className="input-text"
                rows={2}
                placeholder="Key points, links, or context..."
                value={taskNotes}
                onChange={e => setTaskNotes(e.target.value)}
                style={{ resize: 'vertical', fontSize: '0.9rem' }}
              />
            </div>
          )}

          {/* 5. Focus Duration */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Focus Duration
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {presetOptions.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationPreset(preset)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${durationPreset === preset ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    background: durationPreset === preset ? 'var(--color-primary)' : 'var(--bg-surface-elevated)',
                    color: durationPreset === preset ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset === 0 ? 'Custom' : `${preset} min`}
                </button>
              ))}
            </div>
            
            {durationPreset === 0 && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  max="480"
                  className="input-text"
                  value={customDuration}
                  onChange={e => setCustomDuration(Number(e.target.value))}
                  style={{ width: '100px' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>minutes</span>
              </div>
            )}
          </div>

          {/* 4. Session Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Session Mode
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="sessionMode" 
                  checked={sessionMode === 'focus'} 
                  onChange={() => setSessionMode('focus')} 
                  style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                />
                Focus only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="sessionMode" 
                  checked={sessionMode === 'focus_break'} 
                  onChange={() => setSessionMode('focus_break')} 
                  style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                />
                Focus + break
              </label>
            </div>

            {sessionMode === 'focus_break' && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Break duration:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  className="input-text"
                  value={breakDuration}
                  onChange={e => setBreakDuration(Number(e.target.value))}
                  style={{ width: '80px', padding: '6px 10px' }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>min</span>
              </div>
            )}
          </div>

          {/* Submit / Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '10px 16px' }}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ 
                padding: '10px 20px', 
              }}
            >
              Make focus session <Play size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
