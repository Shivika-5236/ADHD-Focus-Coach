import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Zap,
  TrendingUp,
  BarChart2,
  Calendar,
  Sparkles,
  RefreshCw,
  Loader2,
  Lightbulb,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface CoachingDigest {
  headline: string;
  strengths: string[];
  watchOuts: string[];
  nextExperiment: string;
  generatedAt: string;
  signature: string;
}

const DIGEST_STORAGE_KEY = 'adhd_focus_ai_digest_v1';

const loadCachedDigest = (): CoachingDigest | null => {
  try {
    const raw = localStorage.getItem(DIGEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.headline === 'string' &&
      Array.isArray(parsed.strengths) &&
      Array.isArray(parsed.watchOuts) &&
      typeof parsed.nextExperiment === 'string'
    ) {
      return parsed as CoachingDigest;
    }
    return null;
  } catch {
    return null;
  }
};

export const WorkInsights: React.FC = () => {
  const { tasks, sessionHistory, insights } = useTaskContext();
  const { isAuthenticated } = useAuth();
  const [digest, setDigest] = useState<CoachingDigest | null>(() => loadCachedDigest());
  const [isGenerating, setIsGenerating] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  // Load saved AI Coaching Digest from MongoDB Atlas when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    api.insights
      .getDigest()
      .then(res => {
        if (active && res.digest) {
          setDigest(res.digest);
          try {
            localStorage.setItem(DIGEST_STORAGE_KEY, JSON.stringify(res.digest));
          } catch {
            // non-fatal
          }
        }
      })
      .catch(() => {
        // fallback to local cache if server/DB unreachable
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const totalFocusHours = Math.floor(insights.totalFocusMinutes / 60);
  const totalFocusRemainingMins = insights.totalFocusMinutes % 60;
  const focusTimeStr = totalFocusHours > 0
    ? `${totalFocusHours}h ${totalFocusRemainingMins > 0 ? `${totalFocusRemainingMins}m` : ''}`
    : `${insights.totalFocusMinutes}m`;

  const completedTasks = tasks.filter(t => t.state === 'COMPLETED');
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Average session duration from history
  const avgSessionDuration = sessionHistory.length > 0
    ? Math.round(sessionHistory.reduce((acc, s) => acc + s.durationMinutes, 0) / sessionHistory.length)
    : 0;

  // Peak productivity time
  const { morning, afternoon, evening } = insights.timeOfDayMinutes;
  const peakTime = morning >= afternoon && morning >= evening
    ? { label: 'Mornings', sub: '6am – 12pm' }
    : afternoon >= evening
      ? { label: 'Afternoons', sub: '12pm – 5pm' }
      : { label: 'Evenings', sub: '5pm – 10pm' };

  // Daily history bar chart — last 7 entries
  const historySlice = (insights.dailyHistory ?? []).slice(-7);
  const maxFocusMinutes = Math.max(...historySlice.map(d => d.focusMinutes), 1);

  // Session history list (last 5)
  const recentSessions = [...sessionHistory].reverse().slice(0, 5);

  const dataSignature = `${insights.totalFocusMinutes}:${completedTasks.length}:${totalTasks}:${sessionHistory.length}:${insights.streakDays}:${insights.recoverySuccessCount}`;
  const isDigestStale = Boolean(digest && digest.signature !== dataSignature);

  const handleGenerateDigest = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setDigestError(null);

    try {
      const stalledTasks = tasks
        .filter(t => t.state === 'STALLED' || Boolean(t.lastStalledReason))
        .slice(0, 5)
        .map(t => ({
          title: t.title,
          lastStalledReason: t.lastStalledReason,
        }));

      const result = await api.ai.insightsDigest({
        totalFocusMinutes: insights.totalFocusMinutes,
        completedTasksCount: completedTasks.length,
        totalTasksCount: totalTasks,
        completionRate,
        streakDays: insights.streakDays,
        averageAccuracyRate: insights.averageAccuracyRate,
        recoverySuccessCount: insights.recoverySuccessCount,
        avgSessionDuration,
        timeOfDayMinutes: insights.timeOfDayMinutes,
        dailyHistory: historySlice.map(d => ({
          dayLabel: d.dayLabel,
          focusMinutes: d.focusMinutes,
          tasksDone: d.tasksDone,
        })),
        recentSessions: sessionHistory.slice(0, 10).map(s => ({
          taskTitle: s.taskTitle,
          durationMinutes: s.durationMinutes,
          plannedMinutes: s.plannedMinutes,
          completed: s.completed,
          completedStepsCount: s.completedStepsCount,
          totalStepsCount: s.totalStepsCount,
          startedAt: s.startedAt,
        })),
        stalledTasks,
      });

      const nextDigest: CoachingDigest = {
        ...result,
        generatedAt: new Date().toISOString(),
        signature: dataSignature,
      };
      setDigest(nextDigest);
      try {
        localStorage.setItem(DIGEST_STORAGE_KEY, JSON.stringify(nextDigest));
      } catch {
        // non-fatal storage error
      }
      if (isAuthenticated) {
        api.insights.saveDigest(nextDigest).catch(err => {
          console.warn('MongoDB coaching digest save failed:', err);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate coaching digest. Please retry.';
      setDigestError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDigestTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="page-shell animate-fade-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Insights</h1>
          <p className="page-subtitle">
            Understand your work patterns and improve over time.
          </p>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="stats-grid">
        {/* Focus Time */}
        <div className="white-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={22} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Total Focus Time</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {insights.totalFocusMinutes > 0 ? focusTimeStr : '—'}
            </div>
          </div>
        </div>

        {/* Tasks Completed */}
        <div className="white-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={22} color="var(--color-success)" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Tasks Completed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {completedTasks.length}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>/ {totalTasks}</span>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="white-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={22} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Completion Rate</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {totalTasks > 0 ? `${completionRate}%` : '—'}
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="white-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={22} color="var(--color-accent)" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Focus Streak</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {insights.streakDays > 0 ? `${insights.streakDays}d` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* AI Coaching Digest & Pattern Summary Card */}
      <div
        id="ai-coaching-digest-card"
        className="white-card"
        style={{
          padding: '24px 28px',
          borderColor: 'var(--border-card)',
          background: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: digest || digestError ? '18px' : '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--primary-subtle)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                AI Coaching Digest
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Plain-English pattern summary & advice from your focus data
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isDigestStale && !isGenerating && (
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  color: 'var(--accent-text)',
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--color-accent)',
                  padding: '3px 9px',
                  borderRadius: '999px',
                }}
              >
                New activity available
              </span>
            )}
            <button
              id="generate-ai-digest-btn"
              type="button"
              className={digest ? 'btn btn-secondary' : 'btn btn-primary'}
              onClick={handleGenerateDigest}
              disabled={isGenerating}
              style={{
                padding: '8px 14px',
                fontSize: '0.84rem',
                borderRadius: 'var(--radius-sm)',
                opacity: isGenerating ? 0.75 : 1,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Analyzing patterns...
                </>
              ) : digest ? (
                <>
                  <RefreshCw size={14} />
                  Refresh Digest
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Generate Digest
                </>
              )}
            </button>
          </div>
        </div>

        {digestError && (
          <div
            role="alert"
            style={{
              marginBottom: digest ? '16px' : '0',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--alert-subtle)',
              border: '1px solid var(--color-alert)',
              color: 'var(--alert-text)',
              fontSize: '0.83rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {digestError}
            </span>
            <button
              type="button"
              onClick={handleGenerateDigest}
              style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--alert-text)', textDecoration: 'underline', flexShrink: 0 }}
            >
              Retry
            </button>
          </div>
        )}

        {!digest && !digestError && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: 'var(--bg-surface-elevated)',
              border: '1px dashed var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.88rem',
              lineHeight: 1.5,
            }}
          >
            Turn your stats into actionable self-awareness — click <strong>Generate Digest</strong> to see when you focus best, where tasks tend to stall, and one small experiment to try next.
          </div>
        )}

        {digest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Headline takeaway */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface-elevated)',
                borderLeft: '4px solid var(--color-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.96rem',
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              “{digest.headline}”
            </div>

            {/* Strengths & Watch-Outs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'var(--success-subtle)',
                  border: '1px solid var(--color-success)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--success-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    marginBottom: '8px',
                  }}
                >
                  <CheckCircle2 size={14} color="var(--color-success)" />
                  What’s Working
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {digest.strengths.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'var(--alert-subtle)',
                  border: '1px solid var(--color-alert)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--alert-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    marginBottom: '8px',
                  }}
                >
                  <AlertTriangle size={14} color="var(--color-alert)" />
                  Patterns to Watch
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {digest.watchOuts.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Next Tiny Experiment */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Lightbulb size={17} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Next Tiny Experiment
                </span>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.45 }}>
                  {digest.nextExperiment}
                </p>
              </div>
              {digest.generatedAt && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
                  Updated {formatDigestTime(digest.generatedAt)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Daily Focus Bar Chart */}
      <div className="white-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <BarChart2 size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Focus Minutes by Day</h3>
        </div>

        {historySlice.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg-surface-elevated)', borderRadius: '12px' }}>
            No focus sessions recorded yet. Start your first session to see data here.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px' }}>
            {historySlice.map((day, i) => {
              const heightPct = maxFocusMinutes > 0 ? (day.focusMinutes / maxFocusMinutes) * 100 : 0;
              const isToday = i === historySlice.length - 1;
              return (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {day.focusMinutes > 0 ? `${day.focusMinutes}m` : ''}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '44px',
                      height: heightPct > 0 ? `${Math.max(heightPct, 8)}%` : '4px',
                      background: isToday ? 'var(--color-primary)' : 'var(--primary-border)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      opacity: day.focusMinutes === 0 ? 0.3 : 1,
                    }}
                  />
                  <span style={{ fontSize: '0.78rem', color: isToday ? 'var(--primary-text)' : 'var(--text-muted)', fontWeight: isToday ? 600 : 500 }}>
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Patterns Row */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Your Patterns</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>

          {/* Peak Time */}
          <div className="white-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={20} color="var(--color-accent)" />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Most Productive</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {insights.totalFocusMinutes > 0 ? peakTime.label : '—'}
              </div>
              {insights.totalFocusMinutes > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{peakTime.sub}</div>
              )}
            </div>
          </div>

          {/* Avg session */}
          <div className="white-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={20} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Avg Session Length</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {avgSessionDuration > 0 ? `${avgSessionDuration} min` : '—'}
              </div>
              {avgSessionDuration > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>across {sessionHistory.length} sessions</div>
              )}
            </div>
          </div>

          {/* Recovery */}
          <div className="white-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={20} color="var(--color-success)" />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Recovery Wins</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {insights.recoverySuccessCount > 0 ? insights.recoverySuccessCount : '—'}
              </div>
              {insights.recoverySuccessCount > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>times got back on track</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="white-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Calendar size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Sessions</h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {sessionHistory.length} total
          </span>
        </div>

        {recentSessions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', background: 'var(--bg-surface-elevated)', borderRadius: '10px' }}>
            No sessions yet. Complete a focus session to see your history here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentSessions.map(session => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: session.completed ? 'var(--success-subtle)' : 'var(--bg-surface)',
                    color: session.completed ? 'var(--color-success)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{session.taskTitle}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {session.durationMinutes}m spent · {session.plannedMinutes}m planned
                      {session.totalStepsCount > 0 && ` · ${session.completedStepsCount}/${session.totalStepsCount} steps`}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
                  background: session.completed ? 'var(--success-subtle)' : 'var(--bg-surface)',
                  color: session.completed ? 'var(--success-text)' : 'var(--text-secondary)',
                  border: session.completed ? '1px solid var(--color-success)' : '1px solid var(--border-subtle)',
                  textTransform: 'uppercase',
                }}>
                  {session.completed ? 'Done' : 'Ended'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
