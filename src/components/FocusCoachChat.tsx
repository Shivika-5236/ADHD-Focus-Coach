import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  X,
  Bot,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { useTaskContext } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import './FocusCoachChat.css';

interface MessageAction {
  type: string;
  label?: string;
  executed?: boolean;
  data?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: React.ReactNode;
  action?: MessageAction;
}

export const FocusCoachChat: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const {
    tasks,
    activeTaskId,
    activeTask,
    activeSession,
    insights,
    pauseFocusSession,
    resumeFocusSession,
    extendFocusSession,
    completeActiveTask,
    endFocusSessionWithoutCompleting,
    toggleStepCompletion,
    addCustomStep,
    startFocusSession,
    createFocusSession,
    createTask,
    triggerStalled,
  } = useTaskContext();

  const { user, isAuthenticated } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef(false);

  // Identify current step & next available task
  const currentStep = useMemo(() => {
    return activeTask?.steps.find(s => !s.isCompleted);
  }, [activeTask]);

  const nextTask = useMemo(() => {
    if (activeTask && (activeTask.state === 'FOCUSING' || activeTask.state === 'PAUSED')) {
      return null;
    }
    const todayActive = tasks.filter(t => t.isToday && t.state !== 'COMPLETED');
    return (
      todayActive.find(t => t.state === 'READY_TO_START') ||
      todayActive.find(t => t.state === 'PLANNED') ||
      todayActive[0] ||
      null
    );
  }, [activeTask, tasks]);

  // Context-aware dynamic suggestions
  const dynamicSuggestions = useMemo(() => {
    if (activeTask && activeTask.state === 'FOCUSING') {
      return [
        '⏸️ Pause my timer',
        '✅ Mark current step done',
        '➕ Give me a 2-min micro-step',
        '⏱️ Add 5 minutes to timer',
        '🆘 I am feeling stuck',
        '🏁 Finish this task',
      ];
    }
    if (activeTask && activeTask.state === 'PAUSED') {
      return [
        '▶️ Resume my focus timer',
        '⏹️ End this session',
        '➕ Add a quick next step',
        'What should I do next?',
      ];
    }
    if (tasks.some(t => t.isToday && t.state !== 'COMPLETED')) {
      return [
        '🚀 Start focus on my next task',
        '🔨 Break down my top priority',
        'What should I work on first?',
        'Help me start a 10-minute sprint',
      ];
    }
    return [
      "💡 Help me brain-dump today's tasks",
      "What's a good way to start today?",
      'Plan a quick 15-minute starter task',
    ];
  }, [activeTask, tasks]);

  // Load persisted chat history from MongoDB Atlas when authenticated
  useEffect(() => {
    if (!isOpen || !isAuthenticated || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    api.chat
      .getHistory()
      .then(res => {
        if (res.messages && res.messages.length > 0) {
          setMessages(
            res.messages.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              action: m.action,
            }))
          );
        }
      })
      .catch(() => {
        historyLoadedRef.current = false;
      });
  }, [isOpen, isAuthenticated]);

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: (
            <>
              Hi! I'm your live ADHD Focus Coach. 👋<br /><br />
              I'm connected to your active focus session in real-time. Talk to me for motivation, or tell me to control your session directly:
              <br /><br />
              • <em>"Pause my timer"</em> or <em>"Resume"</em><br />
              • <em>"Mark this step done"</em><br />
              • <em>"Give me a 2-minute micro-step"</em><br />
              • <em>"Add 5 mins to my timer"</em><br />
              • <em>"I'm stuck or overwhelmed"</em>
            </>
          ),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Execute AI or User requested action
  const executeAction = async (action: any): Promise<string | null> => {
    if (!action || !action.type) return null;
    try {
      switch (action.type) {
        case 'PAUSE_SESSION': {
          if (activeTaskId) {
            pauseFocusSession();
            return 'Paused focus session';
          }
          return null;
        }
        case 'RESUME_SESSION': {
          if (activeTaskId) {
            resumeFocusSession();
            return 'Resumed focus session';
          }
          return null;
        }
        case 'COMPLETE_TASK': {
          if (activeTaskId) {
            await completeActiveTask();
            return 'Completed active task';
          }
          return null;
        }
        case 'END_SESSION': {
          if (activeTaskId) {
            await endFocusSessionWithoutCompleting();
            return 'Ended focus session';
          }
          return null;
        }
        case 'EXTEND_TIMER': {
          const extra = typeof action.extraMinutes === 'number' && action.extraMinutes > 0 ? action.extraMinutes : 5;
          if (activeTaskId) {
            extendFocusSession(extra);
            return `Added +${extra}m to focus timer`;
          }
          return null;
        }
        case 'MARK_STEP_DONE': {
          if (activeTask) {
            const stepId = action.stepId || activeTask.steps.find(s => !s.isCompleted)?.id;
            if (stepId) {
              toggleStepCompletion(activeTask.id, stepId);
              const step = activeTask.steps.find(s => s.id === stepId);
              return `Checked off: "${step?.title || action.stepTitle || 'Current step'}"`;
            }
          }
          return null;
        }
        case 'ADD_STEP': {
          if (activeTask && action.title) {
            const mins = typeof action.estimatedMinutes === 'number' ? action.estimatedMinutes : 2;
            addCustomStep(activeTask.id, action.title, mins);
            return `Added step: "${action.title}" (${mins}m)`;
          }
          return null;
        }
        case 'START_FOCUS': {
          if (action.taskId) {
            const t = tasks.find(item => item.id === action.taskId);
            startFocusSession(action.taskId, action.durationMinutes);
            return `Started focus on "${t?.title || 'task'}"`;
          } else if (action.taskTitle) {
            const existing = tasks.find(t => t.title.toLowerCase().includes(action.taskTitle.toLowerCase()));
            if (existing) {
              startFocusSession(existing.id, action.durationMinutes);
              return `Started focus on "${existing.title}"`;
            } else {
              const created = await createFocusSession(action.taskTitle, action.durationMinutes || 25);
              return `Created & started session: "${created.title}"`;
            }
          } else if (activeTaskId) {
            startFocusSession(activeTaskId, action.durationMinutes);
            return 'Started focus session';
          }
          return null;
        }
        case 'I_AM_STUCK': {
          triggerStalled(action.reason || 'Requested unstick help in coach chat');
          return 'Opened stuck recovery flow';
        }
        case 'CREATE_TASK': {
          if (action.title) {
            const created = await createTask(action.title, action.notes, action.isToday ?? true);
            return `Created task: "${created.title}"`;
          }
          return null;
        }
        default:
          return null;
      }
    } catch (err) {
      console.warn('Action execution error:', err);
      return null;
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Build rich live context
    const contextPayload = {
      activeTask: activeTask
        ? {
            id: activeTask.id,
            title: activeTask.title,
            state: activeTask.state,
            notes: activeTask.notes,
            plannedMinutes: activeTask.plannedMinutes,
            steps: activeTask.steps,
            currentStep: currentStep ? { id: currentStep.id, title: currentStep.title } : undefined,
          }
        : null,
      activeSession: activeSession
        ? {
            isFocusing: activeTask?.state === 'FOCUSING',
            isPaused: activeTask?.state === 'PAUSED',
            elapsedMinutes: Math.round(activeSession.elapsedSeconds / 60),
            remainingMinutes: Math.max(0, Math.round((activeSession.plannedSeconds - activeSession.elapsedSeconds) / 60)),
            plannedMinutes: Math.round(activeSession.plannedSeconds / 60),
          }
        : null,
      todayTasks: tasks
        .filter(t => t.isToday && t.state !== 'COMPLETED')
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          title: t.title,
          state: t.state,
          plannedMinutes: t.plannedMinutes,
          completedStepsCount: t.steps.filter(s => s.isCompleted).length,
          totalStepsCount: t.steps.length,
        })),
      completedTasksCountToday: tasks.filter(t => t.isToday && t.state === 'COMPLETED').length,
      streakDays: insights.streakDays,
      userName: user?.name,
    };

    try {
      const payload = newMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : text,
      }));

      const data = await api.chat.sendMessage(payload, contextPayload);

      let actionLabel: string | null = null;
      if (data.action) {
        actionLabel = await executeAction(data.action);
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'I am right here with you! Let us take it one small step at a time.',
        action: data.action
          ? {
              type: data.action.type,
              label: actionLabel || undefined,
              executed: Boolean(actionLabel),
              data: data.action,
            }
          : undefined,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.warn('Chat request failed, trying local fallback:', error);

      // Local rule-based action fallback
      let fallbackText =
        'I had trouble connecting to the cloud service, but I am still here to help. Pick the single easiest 2-minute step and set a quick timer!';
      let localActionLabel: string | null = null;
      let localActionType: string | null = null;

      const lower = text.toLowerCase();
      if (lower.includes('pause') && activeTaskId) {
        pauseFocusSession();
        localActionLabel = 'Paused focus session';
        localActionType = 'PAUSE_SESSION';
        fallbackText = 'Timer paused! Take a breath, drink some water, and come back when you feel ready.';
      } else if ((lower.includes('resume') || lower.includes('unpause')) && activeTaskId) {
        resumeFocusSession();
        localActionLabel = 'Resumed focus session';
        localActionType = 'RESUME_SESSION';
        fallbackText = 'Session resumed! Let us get back into the zone.';
      } else if (lower.includes('stuck')) {
        triggerStalled('Stuck helper requested');
        localActionLabel = 'Opened stuck recovery flow';
        localActionType = 'I_AM_STUCK';
        fallbackText = "I've opened the Stuck Recovery helper for you. Feeling stuck is normal—let's find a micro-move.";
      } else if (lower.includes('add 5') || lower.includes('more time')) {
        extendFocusSession(5);
        localActionLabel = 'Added +5m to timer';
        localActionType = 'EXTEND_TIMER';
        fallbackText = 'Added 5 minutes to your timer!';
      } else if (lower.includes('done') || lower.includes('finish')) {
        if (currentStep && activeTask) {
          toggleStepCompletion(activeTask.id, currentStep.id);
          localActionLabel = `Checked off: "${currentStep.title}"`;
          localActionType = 'MARK_STEP_DONE';
          fallbackText = `Nice work! Checked off "${currentStep.title}". Ready for the next one!`;
        }
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackText,
        action: localActionLabel
          ? {
              type: localActionType || 'LOCAL_FALLBACK',
              label: localActionLabel,
              executed: true,
            }
          : undefined,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: "Chat cleared! What's our next focus goal?",
      },
    ]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="focus-coach-chat-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="focus-coach-chat">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-header-icon">
              <Bot />
            </div>
            <div className="chat-header-text">
              <h3>Focus Coach</h3>
              <p>Live ADHD Assistant & Executive Agent</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handleClearHistory}
              className="chat-header-action-btn"
              title="Clear chat history"
              aria-label="Clear chat"
            >
              <RotateCcw size={15} />
            </button>
            <button onClick={onClose} className="chat-header-close" aria-label="Close Focus Coach">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Context Bar */}
        <div className="chat-context-bar">
          {activeTask && activeSession ? (
            <div className="chat-context-active">
              <div className="chat-context-header-row">
                <div className="chat-context-badge">
                  <span className={`chat-context-pulse ${activeTask.state === 'PAUSED' ? 'paused' : 'focusing'}`} />
                  <span>{activeTask.state === 'PAUSED' ? 'Paused' : 'Focusing'}</span>
                </div>
                <span className="chat-context-timer-pill">
                  <Clock size={12} />
                  {Math.floor(activeSession.elapsedSeconds / 60)}m / {activeTask.plannedMinutes}m
                </span>
              </div>

              <div className="chat-context-title-row">
                <strong className="chat-context-task-title" title={activeTask.title}>
                  {activeTask.title}
                </strong>
              </div>

              {currentStep && (
                <div className="chat-context-step-row" title={currentStep.title}>
                  <span className="chat-context-step-arrow">↳</span>
                  <span className="chat-context-step-label">Step:</span>
                  <span className="chat-context-step-name">{currentStep.title}</span>
                </div>
              )}

              <div className="chat-context-actions-row">
                {activeTask.state === 'PAUSED' ? (
                  <button onClick={() => resumeFocusSession()} className="context-action-btn primary" title="Resume timer">
                    <Play size={12} /> Resume
                  </button>
                ) : (
                  <button onClick={() => pauseFocusSession()} className="context-action-btn" title="Pause timer">
                    <Pause size={12} /> Pause
                  </button>
                )}
                {currentStep && (
                  <button
                    onClick={() => toggleStepCompletion(activeTask.id, currentStep.id)}
                    className="context-action-btn success"
                    title="Mark current step as done"
                  >
                    <CheckCircle2 size={12} /> Step Done
                  </button>
                )}
                <button
                  onClick={() => extendFocusSession(5)}
                  className="context-action-btn"
                  title="Add 5 minutes to timer"
                >
                  +5m
                </button>
                <button
                  onClick={() => triggerStalled('Feeling stuck')}
                  className="context-action-btn warning"
                  title="Open unstick recovery"
                >
                  <AlertCircle size={12} /> Stuck
                </button>
              </div>
            </div>
          ) : nextTask ? (
            <div className="chat-context-idle">
              <div className="chat-context-idle-left">
                <span className="chat-context-idle-dot" />
                <div className="chat-context-idle-info">
                  <span className="chat-context-idle-label">Up next today</span>
                  <strong className="chat-context-idle-title text-truncate">{nextTask.title}</strong>
                </div>
              </div>
              <button
                onClick={() => startFocusSession(nextTask.id)}
                className="context-action-btn primary"
                title="Start focus on this task"
              >
                <Play size={12} /> Start ({nextTask.plannedMinutes}m)
              </button>
            </div>
          ) : (
            <div className="chat-context-empty">
              <Sparkles size={14} color="var(--color-primary)" />
              <span>All clear today · Ask me to brainstorm or plan a task!</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message-row ${msg.role}`}>
              <div className="chat-message-content">
                {msg.role === 'assistant' && (
                  <div className="chat-message-avatar assistant">
                    <Bot />
                  </div>
                )}
                <div className="chat-bubble-wrapper">
                  <div className="chat-bubble">
                    {msg.content}
                    {msg.action?.executed && (
                      <div className="chat-action-executed-pill">
                        <Zap size={12} />
                        <span>{msg.action.label || 'Action Executed'}</span>
                      </div>
                    )}
                  </div>
                  <span className="chat-timestamp">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-message-row assistant">
              <div className="chat-message-content">
                <div className="chat-message-avatar assistant">
                  <Bot />
                </div>
                <div className="chat-bubble-wrapper">
                  <div className="chat-bubble">
                    <div className="typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer Area with Dynamic Quick Actions */}
        <div className="chat-composer-area">
          <div className="quick-actions-scroll-wrapper">
            <div className="quick-actions-container">
              {dynamicSuggestions.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="quick-action-btn"
                  disabled={isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="composer-input-group">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder={
                activeTask && activeTask.state === 'FOCUSING'
                  ? 'Tell Coach: "pause", "step done", "add 5 mins", "stuck"...'
                  : 'Ask Coach or tell it what to do...'
              }
              className="composer-textarea"
              rows={1}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading}
              className="composer-send-btn"
              aria-label="Send message"
            >
              <Send />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
