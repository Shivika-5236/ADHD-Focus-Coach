import React, { useState } from 'react';
import {
  ChevronDown,
  Bot,
  Kanban,
  Check,
  Shield,
  Palette,
  Keyboard,
  Puzzle,
  Sun,
  Moon,
  Monitor,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { applyTheme, getStoredTheme, resolveTheme, type ThemePreference } from '../utils/theme';

type SettingsTab = 'general' | 'appearance' | 'keybindings' | 'extensions' | 'privacy';

interface StoredPreferences {
  focusTimerDefault: string;
  notifications: boolean;
  sound: boolean;
  autoStartNextStep: boolean;
  showDailyTips: boolean;
}

const PREFS_STORAGE_KEY = 'adhd_focus_preferences_v1';

const DEFAULT_PREFERENCES: StoredPreferences = {
  focusTimerDefault: '25 minutes',
  notifications: true,
  sound: true,
  autoStartNextStep: false,
  showDailyTips: true,
};

const loadStoredPreferences = (): StoredPreferences => {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      focusTimerDefault: typeof parsed.focusTimerDefault === 'string' ? parsed.focusTimerDefault : DEFAULT_PREFERENCES.focusTimerDefault,
      notifications: typeof parsed.notifications === 'boolean' ? parsed.notifications : DEFAULT_PREFERENCES.notifications,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_PREFERENCES.sound,
      autoStartNextStep: typeof parsed.autoStartNextStep === 'boolean' ? parsed.autoStartNextStep : DEFAULT_PREFERENCES.autoStartNextStep,
      showDailyTips: typeof parsed.showDailyTips === 'boolean' ? parsed.showDailyTips : DEFAULT_PREFERENCES.showDailyTips,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const savePreferences = (prefs: StoredPreferences) => {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // non-fatal
  }
};

const escapeCsvField = (value: unknown): string => {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const SettingsPage: React.FC = () => {
  const { tasks, projects, sessionHistory, insights, resetToDefaults } = useTaskContext();
  const { user, isAuthenticated, updateUserPreferences } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Theme & Preferences State (MongoDB Atlas source of truth when signed in; localStorage offline fallback)
  const [localTheme, setLocalTheme] = useState<ThemePreference>(() => user?.preferences?.theme ?? getStoredTheme());
  const [localPrefs, setLocalPrefs] = useState<StoredPreferences>(() =>
    user?.preferences
      ? {
          focusTimerDefault: user.preferences.focusTimerDefault,
          notifications: user.preferences.notifications,
          sound: user.preferences.sound,
          autoStartNextStep: user.preferences.autoStartNextStep,
          showDailyTips: user.preferences.showDailyTips,
        }
      : loadStoredPreferences()
  );
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const theme: ThemePreference = isAuthenticated && user?.preferences?.theme ? user.preferences.theme : localTheme;
  const prefs: StoredPreferences =
    isAuthenticated && user?.preferences
      ? {
          focusTimerDefault: user.preferences.focusTimerDefault,
          notifications: user.preferences.notifications,
          sound: user.preferences.sound,
          autoStartNextStep: user.preferences.autoStartNextStep,
          showDailyTips: user.preferences.showDailyTips,
        }
      : localPrefs;

  const handleThemeChange = (nextTheme: ThemePreference) => {
    setLocalTheme(nextTheme);
    applyTheme(nextTheme);
    if (isAuthenticated) {
      void updateUserPreferences({ theme: nextTheme });
    }
  };

  const updatePref = <K extends keyof StoredPreferences>(key: K, value: StoredPreferences[K]) => {
    setLocalPrefs(prev => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
    if (isAuthenticated) {
      void updateUserPreferences({ [key]: value });
    }
  };

  // Keybindings State
  const shortcuts = [
    { action: 'Start Focus', key: '⌘ 1' },
    { action: 'Pause / Resume', key: '⌘ 2' },
    { action: 'Complete Task', key: '⌘ 3' },
    { action: "I'm Stuck", key: '⌘ 4' },
    { action: 'Quick Capture', key: '⌘ K' },
    { action: 'AI Focus Coach', key: '⌘ /' },
  ];

  // Extensions State
  const [aiHelperEnabled, setAiHelperEnabled] = useState<boolean>(true);
  const [visualizerEnabled, setVisualizerEnabled] = useState<boolean>(true);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'keybindings', label: 'Keybindings' },
    { id: 'extensions', label: 'Extensions' },
    { id: 'privacy', label: 'Data & Privacy' },
  ];

  const getDateStamp = () => new Date().toISOString().split('T')[0];

  const handleExportJson = () => {
    const payload = {
      app: 'ADHDFocusCoach',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      preferences: {
        theme,
        ...prefs,
      },
      data: {
        tasks,
        projects,
        sessionHistory,
        insights,
      },
    };

    const filename = `adhd-focus-coach-backup-${getDateStamp()}.json`;
    triggerFileDownload(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8');
    setExportStatus(`Exported ${filename} (${tasks.length} tasks, ${projects.length} projects, ${sessionHistory.length} sessions)`);
  };

  const handleExportTasksCsv = () => {
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const headers = [
      'Title',
      'State',
      'Priority',
      'PlannedMinutes',
      'ActualMinutes',
      'IsToday',
      'Project',
      'StepsCompleted',
      'StepsTotal',
      'CreatedAt',
      'CompletedAt',
      'Notes',
    ];

    const rows = tasks.map(t => [
      t.title,
      t.state,
      t.priority,
      t.plannedMinutes,
      t.actualMinutes,
      t.isToday ? 'Yes' : 'No',
      t.projectId ? projectMap.get(t.projectId) || '' : '',
      t.steps.filter(s => s.isCompleted).length,
      t.steps.length,
      t.createdAt,
      t.completedAt || '',
      t.notes || '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(escapeCsvField).join(',')).join('\r\n');
    const filename = `adhd-focus-coach-tasks-${getDateStamp()}.csv`;
    triggerFileDownload(csv, filename, 'text/csv;charset=utf-8');
    setExportStatus(`Exported ${filename} (${tasks.length} tasks)`);
  };

  const handleExportSessionsCsv = () => {
    const headers = [
      'TaskTitle',
      'StartedAt',
      'EndedAt',
      'PlannedMinutes',
      'DurationMinutes',
      'Completed',
      'StepsCompleted',
      'StepsTotal',
    ];

    const rows = sessionHistory.map(s => [
      s.taskTitle,
      s.startedAt,
      s.endedAt,
      s.plannedMinutes,
      s.durationMinutes,
      s.completed ? 'Yes' : 'No',
      s.completedStepsCount,
      s.totalStepsCount,
    ]);

    const csv = [headers, ...rows].map(row => row.map(escapeCsvField).join(',')).join('\r\n');
    const filename = `adhd-focus-coach-sessions-${getDateStamp()}.csv`;
    triggerFileDownload(csv, filename, 'text/csv;charset=utf-8');
    setExportStatus(`Exported ${filename} (${sessionHistory.length} sessions)`);
  };

  const resolvedTheme = resolveTheme(theme);

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '22px 24px',
    boxShadow: 'var(--shadow-subtle)',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '8px 36px 8px 14px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  return (
    <div id="settings-page" className="page-shell animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 id="settings-heading" className="page-title">
            Settings
          </h1>
          <p id="settings-subtitle" className="page-subtitle">
            Customize your experience.
          </p>
        </div>
      </div>

      {/* Horizontal Tabs Navigation */}
      <div id="settings-tab-bar" className="tabs-bar">
        {tabs.map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${isSelected ? 'active' : ''}`}
            >
              {tab.label}
              {isSelected && <span id={`tab-indicator-${tab.id}`} />}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div id="general-settings-grid" className="two-col-grid">
          {/* Left Column — Preferences */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
            {/* Theme Dropdown Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <label
                htmlFor="theme-select"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                }}
              >
                Theme
              </label>

              <div style={{ position: 'relative', width: '180px' }}>
                <select
                  id="theme-select"
                  value={theme}
                  onChange={e => handleThemeChange(e.target.value as ThemePreference)}
                  style={selectStyle}
                >
                  <option value="Light">Light</option>
                  <option value="Dark">Dark</option>
                  <option value="System">System</option>
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Focus Timer Default Dropdown Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <label
                htmlFor="focus-timer-select"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                }}
              >
                Focus Timer Default
              </label>

              <div style={{ position: 'relative', width: '180px' }}>
                <select
                  id="focus-timer-select"
                  value={prefs.focusTimerDefault}
                  onChange={e => updatePref('focusTimerDefault', e.target.value)}
                  style={selectStyle}
                >
                  <option value="15 minutes">15 minutes</option>
                  <option value="20 minutes">20 minutes</option>
                  <option value="25 minutes">25 minutes</option>
                  <option value="30 minutes">30 minutes</option>
                  <option value="45 minutes">45 minutes</option>
                  <option value="60 minutes">60 minutes</option>
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Notifications Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <label
                htmlFor="notifications-toggle"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => updatePref('notifications', !prefs.notifications)}
              >
                Notifications
              </label>

              <button
                id="notifications-toggle"
                role="switch"
                aria-checked={prefs.notifications}
                onClick={() => updatePref('notifications', !prefs.notifications)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: prefs.notifications ? 'var(--color-primary)' : 'var(--border-subtle)',
                  border: 'none',
                  padding: 0,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: prefs.notifications ? '23px' : '3px',
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                  }}
                />
              </button>
            </div>

            {/* Sound Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <label
                htmlFor="sound-toggle"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => updatePref('sound', !prefs.sound)}
              >
                Sound
              </label>

              <button
                id="sound-toggle"
                role="switch"
                aria-checked={prefs.sound}
                onClick={() => updatePref('sound', !prefs.sound)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: prefs.sound ? 'var(--color-primary)' : 'var(--border-subtle)',
                  border: 'none',
                  padding: 0,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: prefs.sound ? '23px' : '3px',
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                  }}
                />
              </button>
            </div>

            {/* Auto-start Next Step Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <label
                htmlFor="auto-start-toggle"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => updatePref('autoStartNextStep', !prefs.autoStartNextStep)}
              >
                Auto-start next step
              </label>

              <button
                id="auto-start-toggle"
                role="switch"
                aria-checked={prefs.autoStartNextStep}
                onClick={() => updatePref('autoStartNextStep', !prefs.autoStartNextStep)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: prefs.autoStartNextStep ? 'var(--color-primary)' : 'var(--border-subtle)',
                  border: 'none',
                  padding: 0,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: prefs.autoStartNextStep ? '23px' : '3px',
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                  }}
                />
              </button>
            </div>

            {/* Show Daily Tips Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <label
                htmlFor="daily-tips-toggle"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => updatePref('showDailyTips', !prefs.showDailyTips)}
              >
                Show daily tips
              </label>

              <button
                id="daily-tips-toggle"
                role="switch"
                aria-checked={prefs.showDailyTips}
                onClick={() => updatePref('showDailyTips', !prefs.showDailyTips)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: prefs.showDailyTips ? 'var(--color-primary)' : 'var(--border-subtle)',
                  border: 'none',
                  padding: 0,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: prefs.showDailyTips ? '23px' : '3px',
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                  }}
                />
              </button>
            </div>
          </div>

          {/* Right Column — Keyboard Shortcuts & Extensions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Card 1: Keyboard Shortcuts */}
            <div id="keyboard-shortcuts-card" style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Keyboard Shortcuts
                </h3>
                <span
                  style={{
                    background: 'var(--success-subtle)',
                    color: 'var(--success-text)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-success)',
                  }}
                >
                  Active
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {shortcuts.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.action}</span>
                    <span
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {item.key}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  id="edit-keybindings-link"
                  onClick={() => setActiveTab('keybindings')}
                  style={{
                    color: 'var(--primary-text)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Edit Keybindings →
                </button>
              </div>
            </div>

            {/* Card 2: Extensions */}
            <div id="extensions-card" style={cardStyle}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                }}
              >
                Extensions
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* AI Task Helper */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Bot size={14} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      AI Task Helper
                    </span>
                  </div>

                  <span
                    id="badge-ai-task-helper"
                    style={{
                      background: 'var(--success-subtle)',
                      color: 'var(--success-text)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '2px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-success)',
                    }}
                  >
                    {aiHelperEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {/* Project Visualizer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Kanban size={14} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      Project Visualizer
                    </span>
                  </div>

                  <span
                    id="badge-project-visualizer"
                    style={{
                      background: 'var(--success-subtle)',
                      color: 'var(--success-text)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '2px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-success)',
                    }}
                  >
                    {visualizerEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  id="manage-extensions-link"
                  onClick={() => setActiveTab('extensions')}
                  style={{
                    color: 'var(--primary-text)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  → Manage Extensions →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="animate-fade-in" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={18} color="var(--color-primary)" /> Theme & Dark Mode
              </h3>
              <span
                id="active-theme-badge"
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary-text)',
                  border: '1px solid var(--primary-border)',
                }}
              >
                Active: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
                {theme === 'System' ? ' (System)' : ''}
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Switch between crisp Light mode, low-glare Dark mode, or follow your operating system automatically.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {(
                [
                  { value: 'Light', icon: <Sun size={18} />, desc: 'Bright & airy' },
                  { value: 'Dark', icon: <Moon size={18} />, desc: 'Low-glare focus' },
                  { value: 'System', icon: <Monitor size={18} />, desc: 'Match OS' },
                ] as const
              ).map(option => {
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    id={`appearance-theme-${option.value.toLowerCase()}`}
                    type="button"
                    onClick={() => handleThemeChange(option.value)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: '10px',
                      border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                      background: isActive ? 'var(--primary-subtle)' : 'var(--bg-surface-elevated)',
                      color: isActive ? 'var(--primary-text)' : 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {option.icon}
                      <span>{option.value}</span>
                      {isActive && <Check size={15} />}
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {option.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KEYBINDINGS */}
      {activeTab === 'keybindings' && (
        <div className="animate-fade-in" style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Keyboard size={18} color="var(--color-primary)" /> Global Hotkeys
              </h3>
              <span
                style={{
                  background: 'var(--success-subtle)',
                  color: 'var(--success-text)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-success)',
                }}
              >
                Active & Listening
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Control your focus flow directly from anywhere without leaving the keyboard. Works globally with ⌘ on macOS and Ctrl on Windows/Linux.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {shortcuts.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-primary)' }}>{s.action}</span>
                  <span style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {s.key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXTENSIONS */}
      {activeTab === 'extensions' && (
        <div className="animate-fade-in" style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Puzzle size={18} color="var(--color-primary)" /> Installed Focus Modules
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>AI Task Breakdown Assistant</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Generates small 2-minute micro-actions when stuck.</div>
                </div>
                <button
                  onClick={() => setAiHelperEnabled(!aiHelperEnabled)}
                  style={{
                    background: aiHelperEnabled ? 'var(--success-subtle)' : 'var(--bg-surface-elevated)',
                    color: aiHelperEnabled ? 'var(--success-text)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: aiHelperEnabled ? 'var(--color-success)' : 'var(--border-subtle)',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {aiHelperEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>Project Visualizer</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Interactive milestone dependency graph mapping.</div>
                </div>
                <button
                  onClick={() => setVisualizerEnabled(!visualizerEnabled)}
                  style={{
                    background: visualizerEnabled ? 'var(--success-subtle)' : 'var(--bg-surface-elevated)',
                    color: visualizerEnabled ? 'var(--success-text)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: visualizerEnabled ? 'var(--color-success)' : 'var(--border-subtle)',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {visualizerEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATA & PRIVACY */}
      {activeTab === 'privacy' && (
        <div className="animate-fade-in" style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--color-primary)" /> Data Export & Local Storage
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              Your tasks, projects, focus sessions, and insights are always yours. Download a full JSON backup or spreadsheet-ready CSV anytime.
            </p>

            {/* Live Data Snapshot */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '10px',
                padding: '12px 14px',
                marginBottom: '20px',
                borderRadius: '10px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tasks</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tasks.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Projects</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{projects.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Focus Sessions</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sessionHistory.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Focus Logged</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{insights.totalFocusMinutes}m</div>
              </div>
            </div>

            {/* Export Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button
                id="export-json-backup-btn"
                type="button"
                className="btn btn-primary"
                onClick={handleExportJson}
                style={{ fontSize: '0.85rem', padding: '9px 15px' }}
              >
                <Download size={15} />
                Export JSON Backup
              </button>

              <button
                id="export-tasks-csv-btn"
                type="button"
                className="btn btn-secondary"
                onClick={handleExportTasksCsv}
                style={{ fontSize: '0.85rem', padding: '9px 15px' }}
              >
                <FileSpreadsheet size={15} />
                Export Tasks (CSV)
              </button>

              <button
                id="export-sessions-csv-btn"
                type="button"
                className="btn btn-secondary"
                onClick={handleExportSessionsCsv}
                style={{ fontSize: '0.85rem', padding: '9px 15px' }}
              >
                <FileSpreadsheet size={15} />
                Export Sessions (CSV)
              </button>
            </div>

            {exportStatus && (
              <div
                id="export-status-banner"
                role="status"
                style={{
                  marginBottom: '16px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'var(--accent-green-bg)',
                  border: '1px solid var(--accent-green-border)',
                  color: 'var(--accent-green)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                {exportStatus}
              </div>
            )}

            {/* Danger Zone */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reset Local Cache</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Clears locally stored tasks, sessions, and cached preferences.</div>
              </div>
              <button
                id="clear-local-cache-btn"
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (confirm('Are you sure you want to clear all local data and cached settings?')) {
                    resetToDefaults();
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                style={{ fontSize: '0.84rem', padding: '8px 14px' }}
              >
                <Trash2 size={14} />
                Clear Local Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
