import React, { useState } from 'react';
import { Pause, Square, CheckCircle2, Circle, Clock, ListTodo, Play, Target, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { AddFocusSessionModal } from './AddFocusSessionModal';

export const FocusSessionDashboard: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStepText, setNewStepText] = useState('');

  const {
    tasks,
    activeTask,
    activeSession,
    sessionHistory,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeTransition,
    endFocusSessionWithoutCompleting,
    deleteSessionHistoryItem,
    triggerStalled,
    requestNextStepHelp,
    toggleStepCompletion,
    addCustomStep,
    deleteCustomStep,
    createFocusSession,
  } = useTaskContext();

  const handleStartAnotherSession = () => {
    completeTransition(); // Safely clear active state without reverting task
    setIsAddModalOpen(true);
  };

  const handleAddStepInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTask || !newStepText.trim()) return;
    addCustomStep(activeTask.id, newStepText.trim());
    setNewStepText('');
  };

  const handleFocusAgain = (title: string, durationMinutes: number) => {
    createFocusSession(title, durationMinutes || 25);
  };

  const formatSessionTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Today at ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return 'Recently';
    }
  };

  const existingSessions = tasks.filter(t => t.state !== 'COMPLETED');

  // Existing Sessions Component
  const renderExistingSessions = () => (
    <div className="white-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Existing Sessions
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {existingSessions.length} {existingSessions.length === 1 ? 'session' : 'sessions'}
          </span>
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              background: 'var(--primary-subtle)',
              border: '1px solid var(--color-primary)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'var(--primary-text)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Create a new focus session"
          >
            <Plus size={13} /> New
          </button>
        </div>
      </div>

      {existingSessions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>No existing sessions. Click "+ New" to create a focus session.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
          {existingSessions.map(task => {
            const isCurrentActive = activeTask?.id === task.id && (task.state === 'FOCUSING' || task.state === 'PAUSED');
            const completedSteps = task.steps.filter(s => s.isCompleted).length;
            return (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: isCurrentActive ? 'var(--primary-subtle)' : 'var(--bg-surface-elevated)',
                  border: isCurrentActive ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {task.title}
                    </span>
                    {isCurrentActive && (
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: task.state === 'PAUSED' ? 'var(--accent-subtle)' : 'var(--color-primary)',
                        color: task.state === 'PAUSED' ? 'var(--accent-text)' : 'var(--text-on-primary)',
                        border: task.state === 'PAUSED' ? '1px solid var(--color-accent)' : 'none',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        {task.state === 'PAUSED' ? 'Paused' : 'Active'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>{task.plannedMinutes || 25} min</span>
                    {task.steps.length > 0 && (
                      <span>• {completedSteps}/{task.steps.length} steps</span>
                    )}
                    {task.priority && (
                      <span style={{ textTransform: 'capitalize' }}>• {task.priority}</span>
                    )}
                  </div>
                </div>

                <div style={{ marginLeft: '10px', flexShrink: 0 }}>
                  {isCurrentActive ? (
                    <span style={{ fontSize: '0.78rem', color: 'var(--primary-text)', fontWeight: 600 }}>
                      Focusing
                    </span>
                  ) : (
                    <button
                      onClick={() => startFocusSession(task.id, task.plannedMinutes)}
                      className="btn btn-secondary"
                      style={{
                        padding: '5px 11px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}
                      title="Start focusing on this session"
                    >
                      <Play size={12} fill="currentColor" /> Start
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Recent Sessions Component to reuse in active and idle screens
  const renderRecentSessions = () => (
    <div className="white-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Ended & Completed Sessions
          </h3>
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {sessionHistory.length} {sessionHistory.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {sessionHistory.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>No ended sessions yet. Completed or ended focus blocks will appear here automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
          {sessionHistory.map(session => (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: session.completed ? 'var(--success-subtle)' : 'var(--bg-surface)',
                  color: session.completed ? 'var(--color-success)' : 'var(--text-secondary)',
                  flexShrink: 0
                }}>
                  {session.completed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {session.taskTitle}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: session.completed ? 'var(--success-subtle)' : 'var(--bg-surface)',
                      color: session.completed ? 'var(--success-text)' : 'var(--text-secondary)',
                      border: session.completed ? '1px solid var(--color-success)' : '1px solid var(--border-subtle)',
                      textTransform: 'uppercase'
                    }}>
                      {session.completed ? 'Completed' : 'Ended'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>{session.durationMinutes}m spent ({session.plannedMinutes}m planned)</span>
                    {session.totalStepsCount > 0 && (
                      <span>• {session.completedStepsCount}/{session.totalStepsCount} steps done</span>
                    )}
                    <span>• {formatSessionTime(session.endedAt)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px', flexShrink: 0 }}>
                <button
                  onClick={() => handleFocusAgain(session.taskTitle, session.plannedMinutes)}
                  className="btn btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Start another focus session for this task"
                >
                  <RotateCcw size={12} /> Focus Again
                </button>
                <button
                  onClick={() => deleteSessionHistoryItem(session.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Remove from history"
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-alert)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (activeTask && activeTask.state === 'COMPLETED') {
    return (
      <div className="page-shell animate-fade-in">
        <AddFocusSessionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Focus Session</h1>
            <p className="page-subtitle">Focus on one thing at a time.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-secondary"
          >
            <Plus size={16} /> Make Another Session
          </button>
        </div>

        <div className="two-col-grid-balanced">
          {/* Left Column: Completed Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12) var(--space-6)', gap: 'var(--space-4)' }}>
            <CheckCircle2 size={56} color="var(--color-success)" />
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Session Completed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', textAlign: 'center', margin: 0 }}>
              Great job focusing on "{activeTask.title}".
            </p>
            <div className="badge badge-completed" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
              {activeTask.actualMinutes} minutes completed
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleStartAnotherSession}
              style={{ marginTop: 'var(--space-2)' }}
            >
              <Plus size={16} /> Make Another Session
            </button>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {renderExistingSessions()}
            {renderRecentSessions()}
          </div>
        </div>
      </div>
    );
  }

  if (!activeTask || !activeSession || activeTask.state === 'READY_TO_START') {
    return (
      <div className="page-shell animate-fade-in">
        <AddFocusSessionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Focus Session</h1>
            <p className="page-subtitle">Focus on one thing at a time.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-secondary"
          >
            <Plus size={16} /> Make Focus Session
          </button>
        </div>

        <div className="two-col-grid-balanced">
          {/* Left Column: Ready to Focus */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12) var(--space-6)', color: 'var(--text-secondary)', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-5)', background: 'var(--primary-subtle)', borderRadius: 'var(--radius-full)' }}>
              <Target size={48} color="var(--color-primary)" />
            </div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Ready to focus?</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
              Start a focused work session to concentrate on a single task without distractions, or pick an existing session on the side.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => setIsAddModalOpen(true)}
              style={{ marginTop: 'var(--space-2)' }}
            >
              <Plus size={16} /> Make Focus Session
            </button>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {renderExistingSessions()}
            {renderRecentSessions()}
          </div>
        </div>
      </div>
    );
  }

  const isPaused = activeTask.state === 'PAUSED';
  const elapsed = activeSession.elapsedSeconds;
  const plannedSecs = (activeTask.plannedMinutes || 25) * 60;
  const remainingSecs = Math.max(0, plannedSecs - elapsed);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, (elapsed / plannedSecs) * 100);
  const strokeDashoffset = ((100 - progressPercent) / 100) * 534;
  const completedStepsCount = activeTask.steps.filter(s => s.isCompleted).length;

  return (
    <div className="page-shell animate-fade-in">
      <AddFocusSessionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Focus Session</h1>
          <p className="page-subtitle">Focus on one thing at a time.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-secondary"
            title="Make another focus session"
          >
            <Plus size={16} /> Make Another Session
          </button>

          <span className={`badge ${isPaused ? 'badge-paused' : 'badge-focusing'}`} style={{ padding: '6px 12px' }}>
            {isPaused ? 'Paused' : 'Focusing'}
          </span>
        </div>
      </div>

      {/* Two Column Responsive Layout */}
      <div className="two-col-grid-balanced">
        
        {/* Left Column: Focus Session (Timer & Steps) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Task / Timer Card */}
          <div className="white-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {activeTask.title}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '16px' }}>
                {activeTask.notes || 'No description provided.'}
              </p>
              <div style={{ display: 'flex', gap: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ListTodo size={16} />
                  <span>Step {completedStepsCount} of {activeTask.steps.length || 1}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} />
                  <span>{activeTask.plannedMinutes} min (planned)</span>
                </div>
              </div>
            </div>

            {/* Circular Timer */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background Ring */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="var(--color-surface)"
                    strokeWidth="16"
                  />
                  {/* Progress Ring */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke={isPaused ? 'var(--color-accent)' : 'var(--color-primary)'}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="534"
                    strokeDashoffset={strokeDashoffset} 
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                {/* Timer Text */}
                <div style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {formatTime(remainingSecs)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Focus time
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              <button 
                onClick={isPaused ? resumeFocusSession : pauseFocusSession}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '999px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button 
                onClick={endFocusSessionWithoutCompleting}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '999px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                <Square size={18} fill="currentColor" />
                End Session
              </button>
            </div>
          </div>

          {/* Current Step & Breakdown Card */}
          <div className="white-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Current Step
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {completedStepsCount}/{activeTask.steps.length} completed
              </span>
            </div>
            
            {/* Steps list */}
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '280px', overflowY: 'auto' }}>
              {activeTask.steps.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', background: 'var(--bg-surface-elevated)', borderRadius: '8px' }}>
                  No steps defined yet. Add your first step below to stay on track!
                </div>
              ) : (
                activeTask.steps.map((step, index) => (
                  <div key={step.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: step.isCompleted ? 'var(--bg-surface-elevated)' : 'transparent',
                        borderRadius: '8px',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseOver={(e) => { if (!step.isCompleted) e.currentTarget.style.background = 'var(--bg-surface-elevated)' }}
                      onMouseOut={(e) => { if (!step.isCompleted) e.currentTarget.style.background = 'transparent' }}
                    >
                      <button
                        onClick={() => toggleStepCompletion(activeTask.id, step.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          flex: 1,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {step.isCompleted ? (
                          <CheckCircle2 size={20} color="var(--color-success)" fill="var(--success-subtle)" />
                        ) : (
                          <Circle size={20} color="var(--border-subtle)" />
                        )}
                        <span style={{ 
                          fontSize: '0.92rem', 
                          color: step.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: step.isCompleted ? 'line-through' : 'none',
                          fontWeight: 500
                        }}>
                          {step.title}
                        </span>
                      </button>

                      <button
                        onClick={() => deleteCustomStep(activeTask.id, step.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete step"
                        onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-alert)')}
                        onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {index < activeTask.steps.length - 1 && (
                      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 8px' }} />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Step Input with '+' button */}
            <form onSubmit={handleAddStepInline} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Add a step (e.g. Read docs)..."
                value={newStepText}
                onChange={e => setNewStepText(e.target.value)}
                style={{ fontSize: '0.88rem', padding: '8px 12px' }}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!newStepText.trim()}
                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                title="Add step"
              >
                <Plus size={16} />
              </button>
            </form>

            {/* Support Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button 
                onClick={() => triggerStalled()}
                className="btn btn-warning"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                I'm Stuck
              </button>
              <button 
                onClick={() => requestNextStepHelp()}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Get Next Step Help
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Existing sessions on one side, and ended & completed sessions below it */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {renderExistingSessions()}
          {renderRecentSessions()}
        </div>

      </div>
    </div>
  );
};
