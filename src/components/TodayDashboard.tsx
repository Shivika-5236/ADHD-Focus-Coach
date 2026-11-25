import React from 'react';
import { Clock, Play, FileText, Check, Sparkles, Quote } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import type { Task } from '../types/task';

const FOCUS_QUOTES = [
  "Small steps make big progress.",
  "Done is better than perfect.",
  "One task at a time is a superpower.",
  "Start before you're ready.",
  "Progress, not perfection.",
  "The best time to start is now.",
  "Momentum starts with one tiny action.",
];

function getDailyQuote() {
  const dayIndex = new Date().getDay();
  return FOCUS_QUOTES[dayIndex % FOCUS_QUOTES.length];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface TodayDashboardProps {
  onOpenTaskDetail: (taskId: string) => void;
  onOpenQuickCapture: () => void;
  onStartFocus?: () => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({ onOpenTaskDetail, onOpenQuickCapture, onStartFocus }) => {
  const { tasks, projects, startFocusSession } = useTaskContext();
  const { user } = useAuth();

  // Active today tasks strictly capped to at most 3 tasks
  const allTodayActive = tasks.filter(t => t.isToday && t.state !== 'COMPLETED');
  const todayActiveTasks = allTodayActive.slice(0, 3);
  const completedTodayTasks = tasks.filter(t => t.isToday && t.state === 'COMPLETED');

  // Next focus task (priority: READY_TO_START, then PLANNED, then first active)
  const nextFocusTask: Task | undefined =
    todayActiveTasks.find(t => t.state === 'READY_TO_START') ||
    todayActiveTasks.find(t => t.state === 'PLANNED') ||
    todayActiveTasks[0];

  const totalTasksCount = Math.min(3, todayActiveTasks.length + completedTodayTasks.length) || todayActiveTasks.length + completedTodayTasks.length;
  const completedCount = completedTodayTasks.length;
  const remainingCount = todayActiveTasks.length;

  // Calculate total estimated hours/minutes from remaining tasks
  const totalMinutes = todayActiveTasks.reduce((acc, t) => acc + (t.plannedMinutes || 0), 0);
  const estimatedHoursStr = totalMinutes >= 60
    ? `${(totalMinutes / 60).toFixed(1).replace('.0', '')}h estimated`
    : `${totalMinutes}m estimated`;

  // Circular gauge calculations (r=44 -> circumference = 2 * PI * 44 ≈ 276.46)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalTasksCount > 0 ? (completedCount / totalTasksCount) : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  // Linked project for next focus task
  const nextProject = nextFocusTask?.projectId
    ? projects.find(p => p.id === nextFocusTask.projectId)
    : null;

  return (
    <div id="dashboard-content" className="page-shell animate-fade-in">
      {/* Top Welcome Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="page-subtitle">
            Let's focus on what matters today.
          </p>
        </div>

        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500, paddingTop: 'var(--space-1)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Two Column Responsive Grid */}
      <div className="two-col-grid">
        {/* Left Column: Your next focus + Today's Focus list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Your next focus Card */}
          {nextFocusTask ? (
            <div
              id="your-next-focus-card"
              className="card"
              style={{
                borderLeft: '4px solid var(--color-accent)',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-text)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: 'var(--radius-full)', background: 'var(--color-accent)', display: 'inline-block' }} />
                Your next focus
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-text)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <FileText size={20} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2
                    id="next-focus-title"
                    onClick={() => onOpenTaskDetail(nextFocusTask.id)}
                    style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    {nextFocusTask.title}
                  </h2>

                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {nextFocusTask.notes || 'Write the first slide and outline the structure.'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <Clock size={14} /> {nextFocusTask.plannedMinutes || 45} min
                    </span>
                    {nextProject && (
                      <>
                        <span>·</span>
                        <span>Project: {nextProject.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-1)' }}>
                <button
                  id="start-focus-btn"
                  className="btn btn-primary"
                  onClick={() => {
                    startFocusSession(nextFocusTask.id);
                    onStartFocus?.();
                  }}
                >
                  <Play size={15} /> Start Focus
                </button>
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
              }}
            >
              <Sparkles size={28} color="var(--color-primary)" style={{ marginBottom: 'var(--space-3)' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>All caught up</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 auto var(--space-4)' }}>
                No active tasks scheduled for today. Capture a new priority to get started.
              </p>
              <button className="btn btn-primary" onClick={onOpenQuickCapture}>
                + Quick Capture
              </button>
            </div>
          )}

          {/* Today's Focus Task List */}
          <div>
            <h3 className="section-heading">
              Today's Focus
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {todayActiveTasks.length === 0 ? (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  No remaining tasks for today.
                </div>
              ) : (
                todayActiveTasks.map(task => (
                  <div
                    key={task.id}
                    id={`task-row-${task.id}`}
                    className="card card-interactive"
                    onClick={() => onOpenTaskDetail(task.id)}
                    style={{
                      padding: 'var(--space-4) var(--space-5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                      <FileText size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <span className="text-truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {task.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        <Clock size={14} />
                        <span>{task.plannedMinutes} min</span>
                      </div>

                      <button
                        id={`play-task-${task.id}`}
                        onClick={e => {
                          e.stopPropagation();
                          startFocusSession(task.id);
                          onStartFocus?.();
                        }}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-primary)',
                          color: 'var(--text-on-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'var(--shadow-subtle)',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        title="Start Focus"
                        aria-label={`Start focus on ${task.title}`}
                      >
                        <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Daily Progress & Today's Quote */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Daily Progress Card */}
          <div
            id="daily-progress-widget"
            className="card"
            style={{ padding: 'var(--space-6)' }}
          >
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-5)' }}>
              Daily Progress
            </h3>

            {/* Circular Gauge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
              <div style={{ position: 'relative', width: '110px', height: '110px' }}>
                <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="var(--border-subtle)"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="var(--color-primary)"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    style={{ transition: 'stroke-dashoffset 300ms ease' }}
                  />
                </svg>

                <div
                  id="progress-ratio-display"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-xl)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-primary)',
                  }}
                >
                  {completedCount}/{totalTasksCount}
                </div>
              </div>
            </div>

            {/* Stats list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-primary)', fontWeight: 500 }}>
                <Check size={16} color="var(--color-success)" strokeWidth={2.5} />
                <span id="stat-completed-count">{completedCount} completed</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-primary)', fontWeight: 500 }}>
                <Check size={16} color="var(--color-primary)" strokeWidth={2.5} />
                <span id="stat-remaining-count">{remainingCount} remaining</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                <Clock size={16} color="var(--text-muted)" />
                <span id="stat-estimated-hours">{estimatedHoursStr}</span>
              </div>
            </div>
          </div>

          {/* Motivation Quote Card */}
          <div
            id="motivation-quote-card"
            className="card"
            style={{
              padding: 'var(--space-5) var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              borderLeft: '4px solid var(--color-accent)',
            }}
          >
            <h4
              id="todays-quote-heading"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Quote size={15} color="var(--color-accent)" /> Today's Quote
            </h4>

            <p
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-relaxed)',
                margin: 0,
              }}
            >
              {getDailyQuote()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
