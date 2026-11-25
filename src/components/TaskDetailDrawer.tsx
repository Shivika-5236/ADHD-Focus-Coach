import React, { useState } from 'react';
import { ArrowLeft, Edit2, Folder, Clock, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { STATE_METADATA } from '../utils/stateMachine';

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onStartFocus?: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({ taskId, onClose, onStartFocus }) => {
  const { tasks, updateTask, startFocusSession, projects } = useTaskContext();
  const [activeTab, setActiveTab] = useState('Steps');

  const task = taskId ? tasks.find(t => t.id === taskId) : null;
  if (!taskId || !task) return null;

  const meta = STATE_METADATA[task.state];
  const project = projects.find(p => p.id === task.projectId);

  const handleStartFocus = () => {
    startFocusSession(task.id);
    onClose();
    if (onStartFocus) {
      onStartFocus();
    }
  };

  const states = ['CAPTURED', 'PLANNED', 'READY_TO_START', 'FOCUSING', 'COMPLETED'];
  
  const handleToggleStep = (stepId: string) => {
    const updatedSteps = task.steps.map(s => 
      s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    updateTask({ id: task.id, steps: updatedSteps });
  };

  return (
    <div className="task-drawer-backdrop">
      <div className="task-drawer-inner">
        
        {/* Back Button */}
        <button 
          onClick={onClose} 
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Header Area */}
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ marginBottom: 'var(--space-2)' }}>
              {task.title}
            </h1>
            {task.notes && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>
                {task.notes}
              </p>
            )}
            
            {/* Metadata Row */}
            <div style={{ display: 'flex', gap: 'var(--space-5)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 500, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Folder size={15} /> Project: {project ? project.name : 'None'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} /> {task.plannedMinutes} min
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} /> {task.isToday ? 'Today' : 'Upcoming'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary btn-sm">
              <Edit2 size={14} /> Edit
            </button>
            <span className={`badge ${meta.badgeClass}`}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="task-drawer-grid">
          
          {/* Left Column: Tabs & Steps */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            
            {/* Tabs */}
            <div className="tabs-bar" style={{ marginBottom: 'var(--space-5)' }}>
              {['Steps', 'Details', 'Time', 'History'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Steps List */}
            {activeTab === 'Steps' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {task.steps.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', padding: 'var(--space-5) 0', fontSize: 'var(--text-sm)' }}>No steps defined.</div>
                ) : (
                  task.steps.map((step, index) => (
                    <div 
                      key={step.id} 
                      onClick={() => handleToggleStep(step.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-3)', 
                        padding: 'var(--space-3) var(--space-4)', 
                        background: index === 0 && !step.isCompleted ? 'var(--bg-surface-elevated)' : 'transparent',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        borderBottom: index < task.steps.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                      }}
                    >
                      {step.isCompleted ? (
                        <CheckCircle2 size={18} color="var(--color-success)" />
                      ) : (
                        <Circle size={18} color="var(--border-strong)" />
                      )}
                      <span style={{ fontSize: 'var(--text-sm)', color: step.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: step.isCompleted ? 'line-through' : 'none' }}>
                        {step.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Column: State & Actions */}
          <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-6)' }}>State</h3>
            
            {/* Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1, paddingLeft: '10px' }}>
              <div style={{ position: 'absolute', left: '16px', top: '12px', bottom: '24px', width: '2px', background: 'var(--border-subtle)', zIndex: 0 }} />
              
              {states.map((st, index) => {
                const isActive = task.state === st;
                const isPast = states.indexOf(task.state) > index;
                const stMeta = STATE_METADATA[st as keyof typeof STATE_METADATA];
                
                return (
                  <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', position: 'relative', zIndex: 1, marginBottom: 'var(--space-6)' }}>
                    <div style={{ 
                      width: '14px', height: '14px', borderRadius: 'var(--radius-full)', 
                      background: isActive ? 'var(--color-primary)' : (isPast ? 'var(--color-success)' : 'var(--bg-surface-elevated)'),
                      border: `2px solid ${isActive ? 'var(--color-primary)' : (isPast ? 'var(--color-success)' : 'var(--border-strong)')}`,
                      boxShadow: isActive ? '0 0 0 4px var(--primary-subtle)' : 'none'
                    }} />
                    {isActive ? (
                      <div className="badge badge-ready">
                        {stMeta.label}
                      </div>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: isPast ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {stMeta.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              onClick={handleStartFocus}
              style={{ width: '100%', marginTop: 'auto' }}
            >
              Start Focus
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

