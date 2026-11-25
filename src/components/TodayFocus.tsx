import React, { useState } from 'react';
import { Play, CheckCircle2, Clock, ListChecks, ArrowRight, Sparkles } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { STATE_METADATA } from '../utils/stateMachine';
import type { Task } from '../types/task';

interface TodayFocusProps {
  onOpenTaskDetail: (taskId: string) => void;
  onOpenQuickCapture: () => void;
  onStartFocus?: () => void;
}

export const TodayFocus: React.FC<TodayFocusProps> = ({ onOpenTaskDetail, onOpenQuickCapture, onStartFocus }) => {
  const { tasks, startFocusSession, transitionTask } = useTaskContext();
  const [filter, setFilter] = useState<'all' | 'ready' | 'planned' | 'captured'>('all');

  // Filter tasks belonging to today (strictly capped at 3 tasks to prevent cognitive overwhelm)
  const allTodayTasks = tasks.filter(t => t.isToday && t.state !== 'COMPLETED');
  const todayTasks = allTodayTasks.slice(0, 3);

  // Identify the singular "Next Action" task
  // Priority: 1. READY_TO_START 2. PLANNED 3. CAPTURED
  const nextActionTask: Task | undefined =
    todayTasks.find(t => t.state === 'READY_TO_START') ||
    todayTasks.find(t => t.state === 'PLANNED') ||
    todayTasks.find(t => t.state === 'CAPTURED') ||
    todayTasks[0];

  const filteredTasks = todayTasks.filter(t => {
    if (filter === 'ready') return t.state === 'READY_TO_START';
    if (filter === 'planned') return t.state === 'PLANNED';
    if (filter === 'captured') return t.state === 'CAPTURED';
    return true;
  });

  return (
    <div className="page-shell animate-fade-in">
      {/* US-001: Singular Dominant "Next Action" Hero Card */}
      {nextActionTask ? (
        <section
          id="hero-next-action-card"
          className="card"
          style={{
            padding: 'var(--space-6)',
            borderLeft: '4px solid var(--color-accent)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span className="badge badge-planned">
                <Sparkles size={12} /> Next Action
              </span>
              <span className={`badge ${STATE_METADATA[nextActionTask.state].badgeClass}`}>
                {STATE_METADATA[nextActionTask.state].label}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Clock size={14} /> {nextActionTask.plannedMinutes} min block
              </span>
              {nextActionTask.steps.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <ListChecks size={14} />
                  {nextActionTask.steps.filter(s => s.isCompleted).length}/{nextActionTask.steps.length} steps
                </span>
              )}
            </div>
          </div>

          <h2
            id="hero-task-title"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)', cursor: 'pointer', color: 'var(--text-primary)' }}
            onClick={() => onOpenTaskDetail(nextActionTask.id)}
            title="Click to view details"
          >
            {nextActionTask.title}
          </h2>

          {nextActionTask.notes && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              {nextActionTask.notes}
            </p>
          )}

          {/* Active micro-step preview */}
          {nextActionTask.steps.length > 0 && (
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                border: '1px solid var(--border-subtle)',
                borderLeft: '3px solid var(--color-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>First step:</span>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {nextActionTask.steps.find(s => !s.isCompleted)?.title || 'All steps ready'}
              </strong>
            </div>
          )}

          {/* Hero Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {nextActionTask.state === 'READY_TO_START' ? (
              <button
                id="hero-start-focus-btn"
                className="btn btn-primary"
                onClick={() => {
                  startFocusSession(nextActionTask.id);
                  onStartFocus?.();
                }}
              >
                <Play size={16} /> Start Focus Session
              </button>
            ) : nextActionTask.state === 'PLANNED' ? (
              <button
                id="hero-mark-ready-btn"
                className="btn btn-primary"
                onClick={() => transitionTask(nextActionTask.id, 'READY_TO_START')}
              >
                <CheckCircle2 size={16} /> Mark Ready to Start
              </button>
            ) : (
              <button
                id="hero-plan-task-btn"
                className="btn btn-primary"
                onClick={() => onOpenTaskDetail(nextActionTask.id)}
              >
                Plan This Task <ArrowRight size={16} />
              </button>
            )}

            <button
              id="hero-open-details-btn"
              className="btn btn-secondary"
              onClick={() => onOpenTaskDetail(nextActionTask.id)}
            >
              View Details & Steps
            </button>
          </div>
        </section>
      ) : (
        <div
          className="card"
          style={{ padding: 'var(--space-8)', textAlign: 'center' }}
        >
          <Sparkles size={28} color="var(--color-primary)" style={{ marginBottom: 'var(--space-3)' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Your plate is completely clear</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 auto var(--space-4)' }}>
            No immediate tasks scheduled for today. Capture something quick when inspiration strikes.
          </p>
          <button id="empty-state-capture-btn" className="btn btn-primary" onClick={onOpenQuickCapture}>
            + Quick Task Capture
          </button>
        </div>
      )}

      {/* Section 2: Today's Focused Task List */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              Today's Intentional Queue
              <span className="badge badge-captured">
                {todayTasks.length} active
              </span>
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              Kept purposefully short to protect your executive function.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            {(['all', 'ready', 'planned', 'captured'] as const).map(tab => (
              <button
                key={tab}
                id={`filter-tab-${tab}`}
                className={filter === tab ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
                onClick={() => setFilter(tab)}
                style={{
                  borderColor: filter === tab ? 'var(--color-primary)' : 'transparent',
                  color: filter === tab ? 'var(--primary-text)' : 'var(--text-muted)',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredTasks.length === 0 ? (
            <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              No tasks match this filter.
            </div>
          ) : (
            filteredTasks.map(task => {
              const meta = STATE_METADATA[task.state];
              const isNext = nextActionTask?.id === task.id;

              return (
                <div
                  key={task.id}
                  id={`today-task-card-${task.id}`}
                  className="card card-interactive"
                  onClick={() => onOpenTaskDetail(task.id)}
                  style={{
                    padding: 'var(--space-4) var(--space-5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-4)',
                    cursor: 'pointer',
                    borderLeft: isNext ? '4px solid var(--color-accent)' : '1px solid var(--border-card)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span className={`badge ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      {isNext && (
                        <span className="badge badge-planned">
                          Up Next
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {task.plannedMinutes}m
                      </span>
                    </div>

                    <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{task.title}</h4>

                    {task.steps.length > 0 && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {task.steps.filter(s => s.isCompleted).length} of {task.steps.length} steps completed
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                    {task.state === 'READY_TO_START' && (
                      <button
                        id={`card-start-btn-${task.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          startFocusSession(task.id);
                          onStartFocus?.();
                        }}
                      >
                        <Play size={14} /> Start
                      </button>
                    )}
                    {task.state === 'PLANNED' && (
                      <button
                        id={`card-mark-ready-btn-${task.id}`}
                        className="btn btn-secondary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          transitionTask(task.id, 'READY_TO_START');
                        }}
                      >
                        <CheckCircle2 size={14} /> Ready
                      </button>
                    )}
                    <button
                      id={`open-task-drawer-btn-${task.id}`}
                      className="btn btn-ghost btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        onOpenTaskDetail(task.id);
                      }}
                      aria-label={`Open details for ${task.title}`}
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
