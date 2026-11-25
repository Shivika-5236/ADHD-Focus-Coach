import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { Task, TaskState, TaskStep, Project, ActiveFocusSession, SharedParticipant, ProductivityInsights, EndedFocusSession } from '../types/task';
import { canTransition } from '../utils/stateMachine';
import { soundEngine } from '../utils/audioSynthesizer';
import { INITIAL_TASKS, INITIAL_PROJECTS, INITIAL_INSIGHTS } from '../utils/seedData';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useFocusRoomSocket, type SocketConnectionState } from '../hooks/useFocusRoomSocket';
import confetti from 'canvas-confetti';

interface TaskContextType {
  tasks: Task[];
  projects: Project[];
  activeTaskId: string | null;
  activeTask: Task | null;
  activeSession: ActiveFocusSession | null;
  sessionHistory: EndedFocusSession[];
  insights: ProductivityInsights;
  sharedParticipants: SharedParticipant[];
  isFocusModeActive: boolean;
  isStuckModalOpen: boolean;
  isTransitionModalOpen: boolean;
  selectedDrawerTaskId: string | null;

  // Actions
  createTask: (
    title: string,
    notes?: string,
    isToday?: boolean,
    projectId?: string,
    options?: {
      priority?: 'low' | 'medium' | 'high';
      plannedMinutes?: number;
      steps?: TaskStep[];
    }
  ) => Promise<Task>;
  updateTask: (updated: Partial<Task> & { id: string }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  transitionTask: (taskId: string, targetState: TaskState, contextUpdates?: Partial<Task>) => boolean;
  openTaskDrawer: (id: string | null) => void;

  // Focus Session Controls
  startFocusSession: (taskId: string, customDurationMinutes?: number, extraNotes?: string) => void;
  createFocusSession: (title: string, durationMinutes: number, notes?: string, initialSteps?: string[]) => Promise<Task>;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  extendFocusSession: (extraMinutes?: number) => void;
  completeActiveTask: () => Promise<void>;
  endFocusSessionWithoutCompleting: () => Promise<void>;
  deleteSessionHistoryItem: (id: string) => Promise<void>;

  // Recovery & Transition
  triggerStalled: (reason?: string) => void;
  requestNextStepHelp: (forceFail?: boolean, stuckReason?: string) => Promise<void>;
  startRecoveredStep: () => void;
  closeStuckModal: () => void;
  triggerTransitionFlow: () => void;
  completeTransition: (nextTaskId?: string) => void;

  // Step Builder & AI Breakdown
  requestStepBreakdown: (taskId: string, forceFail?: boolean) => Promise<void>;
  retryFailedOperation: (taskId: string) => Promise<void>;
  toggleStepCompletion: (taskId: string, stepId: string) => void;
  addCustomStep: (taskId: string, title: string, estimatedMinutes?: number) => void;
  deleteCustomStep: (taskId: string, stepId: string) => void;

  // Projects
  createProject: (name: string, description: string, color?: string) => Promise<Project>;
  addMilestoneToProject: (projectId: string, title: string) => Promise<void>;
  setNextActionableMilestone: (projectId: string, milestoneId: string) => void;
  addTasksToMilestone: (
    projectId: string,
    milestoneId: string,
    drafts: {
      title: string;
      notes?: string;
      plannedMinutes: number;
      priority: 'low' | 'medium' | 'high';
      steps?: { title: string; estimatedMinutes: number; isCurrent: boolean }[];
    }[]
  ) => Promise<Task[]>;
  applyProjectMilestones: (projectId: string, titles: string[]) => Promise<void>;

  // Shared Sessions (Real-Time WebSocket)
  isSharedSessionActive: boolean;
  sharedRoomCode: string | null;
  sharedParticipantId: string;
  sharedConnectionState: SocketConnectionState;
  sharedConnectionError: string | null;
  sharedIsPrivate: boolean;
  sharedStatus: 'focusing' | 'paused' | 'break';
  joinSharedSession: (
    roomCode: string,
    isPrivate: boolean,
    options?: { displayName?: string; avatar?: string; taskDisplay?: string }
  ) => void;
  leaveSharedSession: () => void;
  toggleSharedPrivacy: () => void;
  updateSharedStatus: (status: 'focusing' | 'paused' | 'break') => void;
  updateSharedTaskDisplay: (taskDisplay: string) => void;

  resetToDefaults: () => void;
}

const STORAGE_KEYS = {
  TASKS: 'adhd_focus_tasks_v5',
  PROJECTS: 'adhd_focus_projects_v5',
  INSIGHTS: 'adhd_focus_insights_v5',
  SESSIONS: 'adhd_focus_sessions_v1',
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      const loaded: Task[] = saved ? JSON.parse(saved) : INITIAL_TASKS;
      return loaded.filter(t => t.id !== 'task-done-1');
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [insights, setInsights] = useState<ProductivityInsights>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INSIGHTS);
      return saved ? JSON.parse(saved) : INITIAL_INSIGHTS;
    } catch {
      return INITIAL_INSIGHTS;
    }
  });

  const [sessionHistory, setSessionHistory] = useState<EndedFocusSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sharedParticipantId] = useState<string>(() => {
    try {
      const existing = sessionStorage.getItem('adhd_focus_ws_pid');
      if (existing) return existing;
      const generated = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('adhd_focus_ws_pid', generated);
      return generated;
    } catch {
      return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }
  });
  const [sharedRoomCode, setSharedRoomCode] = useState<string | null>(null);
  const [sharedIsPrivate, setSharedIsPrivate] = useState<boolean>(false);
  const [sharedStatus, setSharedStatus] = useState<'focusing' | 'paused' | 'break'>('focusing');
  const [sharedDisplayName, setSharedDisplayName] = useState<string>('');
  const [sharedAvatar, setSharedAvatar] = useState<string>('🌟');
  const [sharedCustomTask, setSharedCustomTask] = useState<string>('');
  const isSharedSessionActive = sharedRoomCode !== null;

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveFocusSession | null>(null);
  const [selectedDrawerTaskId, setSelectedDrawerTaskId] = useState<string | null>(null);
  const [isStuckModalOpen, setIsStuckModalOpen] = useState<boolean>(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);

  // Sync to local storage for instant offline availability
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INSIGHTS, JSON.stringify(insights));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  }, [insights]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessionHistory));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  }, [sessionHistory]);

  // Load from MongoDB backend when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadBackendData = async () => {
      try {
        const [backendTasks, backendProjects, backendSessions, backendInsights] = await Promise.allSettled([
          api.tasks.getAll(),
          api.projects.getAll(),
          api.focusSessions.getAll(),
          api.insights.get(),
        ]);

        if (backendTasks.status === 'fulfilled' && Array.isArray(backendTasks.value) && backendTasks.value.length > 0) {
          const mappedTasks: Task[] = backendTasks.value.map(t => ({
            id: t._id || t.id,
            title: t.title,
            notes: t.notes || '',
            state: t.state || 'CAPTURED',
            plannedMinutes: t.plannedMinutes || 20,
            actualMinutes: t.actualMinutes || 0,
            priority: t.priority || 'medium',
            isToday: t.isToday !== undefined ? t.isToday : true,
            projectId: t.projectId,
            steps: (t.steps || []).map((s: any) => ({
              id: s._id || s.id || `step-${Math.random()}`,
              title: s.title,
              isCompleted: s.isCompleted || false,
              isCurrent: s.isCurrent || false,
              estimatedMinutes: s.estimatedMinutes || 5,
            })),
            createdAt: t.createdAt || new Date().toISOString(),
          }));
          setTasks(mappedTasks);
        }

        if (backendProjects.status === 'fulfilled' && Array.isArray(backendProjects.value) && backendProjects.value.length > 0) {
          const mappedProjects: Project[] = backendProjects.value.map(p => ({
            id: p._id || p.id,
            name: p.name,
            description: p.description || '',
            color: p.color || '#0F766E',
            milestones: (p.milestones || []).map((m: any) => ({
              id: m._id || m.id || `m-${Math.random()}`,
              title: m.title,
              order: m.order || 1,
              taskIds: m.taskIds || [],
              isNextActionable: m.isNextActionable || false,
            })),
            dependencies: [],
          }));
          setProjects(mappedProjects);
        }

        if (backendSessions.status === 'fulfilled' && Array.isArray(backendSessions.value)) {
          const mappedSessions: EndedFocusSession[] = backendSessions.value.map(s => ({
            id: s._id || s.id,
            taskId: s.taskId,
            taskTitle: s.taskTitle || '',
            startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : new Date().toISOString(),
            endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : new Date().toISOString(),
            durationMinutes: s.durationMinutes || 0,
            plannedMinutes: s.plannedMinutes || 25,
            completed: s.completed || false,
            completedStepsCount: s.completedStepsCount || 0,
            totalStepsCount: s.totalStepsCount || 0,
          }));
          setSessionHistory(mappedSessions);
        }

        if (backendInsights.status === 'fulfilled' && backendInsights.value) {
          const bi = backendInsights.value;
          setInsights(prev => ({
            ...prev,
            totalFocusMinutes: bi.totalFocusMinutes || prev.totalFocusMinutes,
            completedTasksCount: bi.completedTasksCount || prev.completedTasksCount,
            streakDays: bi.streakDays || prev.streakDays,
            averageAccuracyRate: bi.averageAccuracyRate || prev.averageAccuracyRate,
            dailyHistory: bi.dailyHistory || prev.dailyHistory,
          }));
        }
      } catch (err) {
        console.error('Error synchronizing with MongoDB backend:', err);
      }
    };

    loadBackendData();
  }, [isAuthenticated]);

  // Session timer ticker
  useEffect(() => {
    if (!activeSession) return;
    const task = tasks.find(t => t.id === activeSession.taskId);
    if (!task || task.state !== 'FOCUSING') return;

    const interval = setInterval(() => {
      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, tasks]);

  const activeTask = tasks.find(t => t.id === activeTaskId) || null;
  const isFocusModeActive = Boolean(activeTask && ['FOCUSING', 'PAUSED', 'STALLED', 'RECOVERY'].includes(activeTask.state));

  // State Transition Core Function
  const transitionTask = (taskId: string, targetState: TaskState, contextUpdates?: Partial<Task>): boolean => {
    let succeeded = false;
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task;

        if (!canTransition(task.state, targetState)) {
          console.warn(`Invalid state transition requested: ${task.state} -> ${targetState}`);
          return task;
        }

        succeeded = true;
        const updated = {
          ...task,
          previousState: task.state,
          state: targetState,
          ...(contextUpdates || {}),
        };

        // Async sync to backend
        if (isAuthenticated) {
          api.tasks.update(taskId, { state: targetState, ...contextUpdates }).catch(err => {
            console.warn('Background sync failed for transition:', err);
          });
        }

        return updated;
      })
    );
    return succeeded;
  };

  const createTask = async (
    title: string,
    notes?: string,
    isToday = true,
    projectId?: string,
    options?: {
      priority?: 'low' | 'medium' | 'high';
      plannedMinutes?: number;
      steps?: TaskStep[];
    }
  ): Promise<Task> => {
    const tempId = `task-${Date.now()}`;
    const plannedMinutes =
      typeof options?.plannedMinutes === 'number' && options.plannedMinutes > 0
        ? Math.round(options.plannedMinutes)
        : 20;
    const priority = options?.priority ?? 'medium';
    const steps: TaskStep[] = (options?.steps ?? []).map((s, idx) => ({
      id: s.id || `step-${Date.now()}-${idx + 1}`,
      title: s.title,
      isCompleted: Boolean(s.isCompleted),
      isCurrent: s.isCurrent ?? idx === 0,
      estimatedMinutes: s.estimatedMinutes,
    }));

    const newTask: Task = {
      id: tempId,
      title: title.trim() || 'Untitled Task',
      notes: notes || '',
      state: 'CAPTURED',
      plannedMinutes,
      actualMinutes: 0,
      steps,
      priority,
      isToday,
      projectId,
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI update
    setTasks(prev => [newTask, ...prev]);

    if (projectId) {
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== projectId || p.milestones.length === 0) return p;
          const updatedMilestones = [...p.milestones];
          updatedMilestones[0] = {
            ...updatedMilestones[0],
            taskIds: [...updatedMilestones[0].taskIds, newTask.id],
          };
          return { ...p, milestones: updatedMilestones };
        })
      );
    }

    // Persist to MongoDB backend
    if (isAuthenticated) {
      try {
        const created = await api.tasks.create({
          title: newTask.title,
          notes: newTask.notes,
          isToday: newTask.isToday,
          projectId: newTask.projectId,
          plannedMinutes: newTask.plannedMinutes,
          priority: newTask.priority,
          steps: newTask.steps.map((s, idx) => ({
            title: s.title,
            isCompleted: s.isCompleted,
            isCurrent: Boolean(s.isCurrent),
            estimatedMinutes: s.estimatedMinutes,
            position: idx,
          })),
        });

        if (created && created._id) {
          newTask.id = created._id;
          setTasks(prev => prev.map(t => (t.id === tempId ? { ...t, id: created._id } : t)));
        }
      } catch (err) {
        console.warn('Backend task create failed, keeping local task:', err);
      }
    }

    return newTask;
  };

  const updateTask = async (updated: Partial<Task> & { id: string }) => {
    setTasks(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)));

    if (isAuthenticated) {
      try {
        await api.tasks.update(updated.id, updated);
      } catch (err) {
        console.warn('Backend task update failed:', err);
      }
    }
  };

  const deleteTask = async (id: string) => {
    if (activeTaskId === id) {
      setActiveTaskId(null);
      setActiveSession(null);
    }
    if (selectedDrawerTaskId === id) {
      setSelectedDrawerTaskId(null);
    }
    setTasks(prev => prev.filter(t => t.id !== id));

    if (isAuthenticated) {
      try {
        await api.tasks.delete(id);
      } catch (err) {
        console.warn('Backend task delete failed:', err);
      }
    }
  };

  const openTaskDrawer = (id: string | null) => {
    setSelectedDrawerTaskId(id);
  };

  // Focus Session Controls
  const startFocusSession = (taskId: string, customDurationMinutes?: number, extraNotes?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const plannedMinutes = customDurationMinutes || task.plannedMinutes || 25;

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          previousState: t.state,
          state: 'FOCUSING',
          plannedMinutes,
          notes: extraNotes ? (t.notes ? `${t.notes}\n\n${extraNotes}` : extraNotes) : t.notes,
        };
      })
    );

    setActiveTaskId(taskId);
    setActiveSession({
      taskId,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      plannedSeconds: plannedMinutes * 60,
      activeStepId: task.steps.find(s => !s.isCompleted)?.id,
    });
  };

  const createFocusSession = async (title: string, durationMinutes: number, notes?: string, initialSteps?: string[]): Promise<Task> => {
    const tempId = `task-${Date.now()}`;
    const formattedSteps: TaskStep[] = (initialSteps || [])
      .filter(s => s && s.trim().length > 0)
      .map((s, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        title: s.trim(),
        isCompleted: false,
        estimatedMinutes: Math.round(durationMinutes / Math.max(1, (initialSteps || []).length)),
      }));

    const newTask: Task = {
      id: tempId,
      title: title.trim() || 'Focus Session Task',
      notes: notes || '',
      state: 'FOCUSING',
      plannedMinutes: durationMinutes,
      actualMinutes: 0,
      steps: formattedSteps,
      priority: 'medium',
      isToday: true,
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(tempId);
    setActiveSession({
      taskId: tempId,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      plannedSeconds: durationMinutes * 60,
      activeStepId: formattedSteps[0]?.id,
    });

    if (isAuthenticated) {
      try {
        const created = await api.tasks.create({
          title: newTask.title,
          notes: newTask.notes,
          isToday: true,
          plannedMinutes: durationMinutes,
          priority: 'medium',
          steps: formattedSteps,
        });
        if (created && created._id) {
          newTask.id = created._id;
          setActiveTaskId(created._id);
          setTasks(prev => prev.map(t => (t.id === tempId ? { ...t, id: created._id } : t)));
        }
      } catch (err) {
        console.warn('Backend task create failed:', err);
      }
    }

    return newTask;
  };

  const pauseFocusSession = () => {
    if (!activeTaskId) return;
    transitionTask(activeTaskId, 'PAUSED');
  };

  const resumeFocusSession = () => {
    if (!activeTaskId) return;
    transitionTask(activeTaskId, 'FOCUSING');
  };

  const extendFocusSession = (extraMinutes = 5) => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;
    const additionalSecs = extraMinutes * 60;
    setActiveSession(prev =>
      prev
        ? {
            ...prev,
            plannedSeconds: prev.plannedSeconds + additionalSecs,
          }
        : null
    );
    const newPlannedMinutes = (task.plannedMinutes || 25) + extraMinutes;
    updateTask({ id: activeTaskId, plannedMinutes: newPlannedMinutes });
  };

  const completeActiveTask = async () => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    const actualMins = activeSession
      ? Math.max(1, Math.round(activeSession.elapsedSeconds / 60))
      : task.plannedMinutes;

    transitionTask(activeTaskId, 'COMPLETED', {
      actualMinutes: actualMins,
      completedAt: new Date().toISOString(),
      steps: task.steps.map(s => ({ ...s, isCompleted: true })),
    });

    const sessionRecord: EndedFocusSession = {
      id: `sess-${Date.now()}`,
      taskId: activeTaskId,
      taskTitle: task.title,
      startedAt: new Date(activeSession?.startedAt || Date.now()).toISOString(),
      endedAt: new Date().toISOString(),
      durationMinutes: actualMins,
      plannedMinutes: task.plannedMinutes || 25,
      completed: true,
      completedStepsCount: task.steps.length,
      totalStepsCount: task.steps.length,
    };
    setSessionHistory(prev => [sessionRecord, ...prev]);

    setInsights(prev => ({
      ...prev,
      totalFocusMinutes: prev.totalFocusMinutes + actualMins,
      completedTasksCount: prev.completedTasksCount + 1,
      dailyHistory: prev.dailyHistory.map(day =>
        day.dayLabel === 'Today'
          ? { ...day, focusMinutes: day.focusMinutes + actualMins, tasksDone: day.tasksDone + 1 }
          : day
      ),
    }));

    // Persist session to MongoDB backend
    if (isAuthenticated) {
      try {
        await api.focusSessions.create({
          taskId: activeTaskId,
          taskTitle: task.title,
          plannedMinutes: task.plannedMinutes || 25,
          durationMinutes: actualMins,
          completed: true,
          completedStepsCount: task.steps.length,
          totalStepsCount: task.steps.length,
          status: 'COMPLETED',
        });
      } catch (err) {
        console.warn('Backend focus session create failed:', err);
      }
    }

    soundEngine.playGentleChime();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#0F766E', '#D97706', '#15803D'],
      });
    } catch {
      // non-fatal
    }

    setIsTransitionModalOpen(true);
  };

  const endFocusSessionWithoutCompleting = async () => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (task && activeSession) {
      const elapsedMins = Math.max(1, Math.round(activeSession.elapsedSeconds / 60));
      const doneSteps = task.steps.filter(s => s.isCompleted).length;
      const sessionRecord: EndedFocusSession = {
        id: `sess-${Date.now()}`,
        taskId: activeTaskId,
        taskTitle: task.title,
        startedAt: new Date(activeSession.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMinutes: elapsedMins,
        plannedMinutes: task.plannedMinutes || 25,
        completed: false,
        completedStepsCount: doneSteps,
        totalStepsCount: task.steps.length,
      };
      setSessionHistory(prev => [sessionRecord, ...prev]);

      if (isAuthenticated) {
        api.focusSessions.create({
          taskId: activeTaskId,
          taskTitle: task.title,
          plannedMinutes: task.plannedMinutes || 25,
          durationMinutes: elapsedMins,
          completed: false,
          completedStepsCount: doneSteps,
          totalStepsCount: task.steps.length,
          status: 'CANCELLED',
        }).catch(err => console.warn('Backend session save failed:', err));
      }
    }

    transitionTask(activeTaskId, 'READY_TO_START');
    setActiveTaskId(null);
    setActiveSession(null);
  };

  const deleteSessionHistoryItem = async (id: string) => {
    setSessionHistory(prev => prev.filter(s => s.id !== id));
    if (isAuthenticated) {
      try {
        await api.focusSessions.delete(id);
      } catch (err) {
        console.warn('Backend session delete failed:', err);
      }
    }
  };

  // Recovery Workflow
  const triggerStalled = (reason?: string) => {
    if (!activeTaskId) return;
    transitionTask(activeTaskId, 'STALLED', {
      lastStalledReason: reason || 'Encountered resistance or task felt overwhelming',
    });
    setIsStuckModalOpen(true);
  };

  const requestNextStepHelp = async (forceFail = false, stuckReason?: string) => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    updateTask({ id: activeTaskId, isProcessing: true });
    await new Promise(r => setTimeout(r, 600));

    if (forceFail) {
      updateTask({
        id: activeTaskId,
        isProcessing: false,
        processingError: 'Network timeout while analyzing step complexity.',
      });
      transitionTask(activeTaskId, 'PROCESSING_FAILED');
      return;
    }

    try {
      const currentStep = task.steps.find(s => !s.isCompleted);
      const elapsedMinutes = activeSession
        ? Math.round(activeSession.elapsedSeconds / 60)
        : 0;

      const result = await api.ai.unstick({
        taskTitle: task.title,
        currentStepTitle: currentStep?.title,
        elapsedMinutes,
        stuckReason,
      });

      updateTask({
        id: activeTaskId,
        isProcessing: false,
        suggestedNextAction: result.micromove,
        processingError: undefined,
      });
      transitionTask(activeTaskId, 'RECOVERY');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the unstick assistant. Please retry.';
      updateTask({
        id: activeTaskId,
        isProcessing: false,
        processingError: message,
      });
      transitionTask(activeTaskId, 'PROCESSING_FAILED');
    }
  };

  const startRecoveredStep = () => {
    if (!activeTaskId) return;
    transitionTask(activeTaskId, 'FOCUSING');
    setIsStuckModalOpen(false);
  };

  const closeStuckModal = () => {
    setIsStuckModalOpen(false);
  };

  // Transition Flow
  const triggerTransitionFlow = () => {
    if (!activeTaskId) return;
    transitionTask(activeTaskId, 'TRANSITIONING');
    setIsTransitionModalOpen(true);
  };

  const completeTransition = (nextTaskId?: string) => {
    setIsTransitionModalOpen(false);
    setActiveTaskId(null);
    setActiveSession(null);

    if (nextTaskId) {
      transitionTask(nextTaskId, 'READY_TO_START');
      setSelectedDrawerTaskId(nextTaskId);
    }
  };

  // Step Builder & Breakdown
  const requestStepBreakdown = async (taskId: string, forceFail = false) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    updateTask({ id: taskId, isProcessing: true });
    await new Promise(r => setTimeout(r, 600));

    if (forceFail) {
      updateTask({
        id: taskId,
        isProcessing: false,
        processingError: 'Could not reach step generation assistant. Please retry.',
      });
      transitionTask(taskId, 'PROCESSING_FAILED');
      return;
    }

    try {
      const project = projects.find(p => p.id === task.projectId);
      const result = await api.ai.breakdown({
        title: task.title,
        notes: task.notes,
        plannedMinutes: task.plannedMinutes,
        priority: task.priority,
        projectName: project?.name,
      });

      const generatedSteps = result.steps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx + 1}`,
        title: s.title,
        isCompleted: false,
        isCurrent: idx === 0,
        estimatedMinutes: s.estimatedMinutes,
      }));

      const taskUpdates: Parameters<typeof updateTask>[0] = {
        id: taskId,
        isProcessing: false,
        steps: generatedSteps,
        processingError: undefined,
      };

      if (typeof result.suggestedPlannedMinutes === 'number' && result.suggestedPlannedMinutes > 0) {
        taskUpdates.plannedMinutes = result.suggestedPlannedMinutes;
      }

      updateTask(taskUpdates);

      if (task.state === 'CAPTURED' || task.state === 'PROCESSING_FAILED') {
        transitionTask(taskId, 'PLANNED');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach step generation assistant. Please retry.';
      updateTask({
        id: taskId,
        isProcessing: false,
        processingError: message,
      });
      transitionTask(taskId, 'PROCESSING_FAILED');
    }
  };

  const retryFailedOperation = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.previousState === 'RECOVERY' || task.lastStalledReason) {
      await requestNextStepHelp(false);
    } else {
      await requestStepBreakdown(taskId, false);
    }
  };

  const toggleStepCompletion = (taskId: string, stepId: string) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task;
        const updatedSteps = task.steps.map(s => (s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s));
        const updated = { ...task, steps: updatedSteps };
        if (isAuthenticated) {
          api.tasks.update(taskId, { steps: updatedSteps }).catch(err => console.warn('Step update sync failed:', err));
        }
        return updated;
      })
    );
  };

  const addCustomStep = (taskId: string, title: string, estimatedMinutes = 10) => {
    if (!title.trim()) return;
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task;
        const newStep = {
          id: `step-${Date.now()}`,
          title: title.trim(),
          isCompleted: false,
          estimatedMinutes,
        };
        const updated = { ...task, steps: [...task.steps, newStep] };
        if (isAuthenticated) {
          api.tasks.update(taskId, { steps: updated.steps }).catch(err => console.warn('Step add sync failed:', err));
        }
        return updated;
      })
    );
  };

  const deleteCustomStep = (taskId: string, stepId: string) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task;
        const updated = { ...task, steps: task.steps.filter(s => s.id !== stepId) };
        if (isAuthenticated) {
          api.tasks.update(taskId, { steps: updated.steps }).catch(err => console.warn('Step delete sync failed:', err));
        }
        return updated;
      })
    );
  };

  // Projects
  const createProject = async (name: string, description: string, color = '#0F766E'): Promise<Project> => {
    const tempId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: tempId,
      name: name.trim() || 'New Project',
      description: description.trim(),
      color,
      milestones: [
        { id: `m-${Date.now()}-1`, title: 'Discovery & Setup', order: 1, taskIds: [], isNextActionable: true },
        { id: `m-${Date.now()}-2`, title: 'Execution Core', order: 2, taskIds: [], isNextActionable: false },
        { id: `m-${Date.now()}-3`, title: 'Review & Finalize', order: 3, taskIds: [], isNextActionable: false },
      ],
      dependencies: [],
    };
    setProjects(prev => [...prev, newProject]);

    if (isAuthenticated) {
      try {
        const created = await api.projects.create({
          name: newProject.name,
          description: newProject.description,
          color: newProject.color,
        });
        if (created && created._id) {
          newProject.id = created._id;
          setProjects(prev => prev.map(p => (p.id === tempId ? { ...p, id: created._id } : p)));
        }
      } catch (err) {
        console.warn('Backend project create failed:', err);
      }
    }

    return newProject;
  };

  const addMilestoneToProject = async (projectId: string, title: string) => {
    if (!title.trim()) return;
    const newMilestone = {
      id: `m-${Date.now()}`,
      title: title.trim(),
      order: 1,
      taskIds: [],
      isNextActionable: false,
    };

    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        newMilestone.order = p.milestones.length + 1;
        return { ...p, milestones: [...p.milestones, newMilestone] };
      })
    );

    if (isAuthenticated) {
      try {
        await api.projects.addMilestone(projectId, title.trim());
      } catch (err) {
        console.warn('Backend milestone add failed:', err);
      }
    }
  };

  const setNextActionableMilestone = (projectId: string, milestoneId: string) => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated = p.milestones.map(m => ({
          ...m,
          isNextActionable: m.id === milestoneId,
        }));
        if (isAuthenticated) {
          api.projects
            .update(projectId, {
              milestones: updated.map(m => ({
                title: m.title,
                order: m.order,
                taskIds: m.taskIds,
                isNextActionable: Boolean(m.isNextActionable),
              })),
            })
            .catch(err => console.warn('Backend milestone update failed:', err));
        }
        return { ...p, milestones: updated };
      })
    );
  };

  const addTasksToMilestone = async (
    projectId: string,
    milestoneId: string,
    drafts: {
      title: string;
      notes?: string;
      plannedMinutes: number;
      priority: 'low' | 'medium' | 'high';
      steps?: { title: string; estimatedMinutes: number; isCurrent: boolean }[];
    }[]
  ): Promise<Task[]> => {
    const project = projects.find(p => p.id === projectId);
    const milestone = project?.milestones.find(m => m.id === milestoneId);
    if (!project || !milestone || drafts.length === 0) return [];

    const now = Date.now();
    const isNextActionable = Boolean(milestone.isNextActionable);

    const newTasks: Task[] = drafts.map((draft, idx) => {
      const steps: TaskStep[] = (draft.steps || []).map((s, sIdx) => ({
        id: `step-${now}-${idx}-${sIdx + 1}`,
        title: s.title,
        isCompleted: false,
        isCurrent: s.isCurrent ?? sIdx === 0,
        estimatedMinutes: s.estimatedMinutes,
      }));

      return {
        id: `task-${now}-${idx + 1}`,
        title: draft.title.trim() || 'Milestone Task',
        notes: draft.notes?.trim() || '',
        state: 'CAPTURED',
        plannedMinutes: Math.max(5, Math.round(draft.plannedMinutes || 20)),
        actualMinutes: 0,
        steps,
        priority: draft.priority || 'medium',
        isToday: isNextActionable,
        projectId,
        createdAt: new Date().toISOString(),
      };
    });

    // Optimistic UI updates
    const tempIds = newTasks.map(t => t.id);
    setTasks(prev => [...newTasks, ...prev]);
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          milestones: p.milestones.map(m =>
            m.id === milestoneId ? { ...m, taskIds: [...m.taskIds, ...tempIds] } : m
          ),
        };
      })
    );

    if (isAuthenticated) {
      try {
        const idMap = new Map<string, string>();
        for (const task of newTasks) {
          const created = await api.tasks.create({
            title: task.title,
            notes: task.notes,
            isToday: task.isToday,
            projectId: task.projectId,
            plannedMinutes: task.plannedMinutes,
            priority: task.priority,
            steps: task.steps.map((s, sIdx) => ({
              title: s.title,
              isCompleted: s.isCompleted,
              isCurrent: Boolean(s.isCurrent),
              estimatedMinutes: s.estimatedMinutes,
              position: sIdx,
            })),
          });
          if (created && created._id) {
            idMap.set(task.id, created._id);
          }
        }

        if (idMap.size > 0) {
          setTasks(prev => prev.map(t => (idMap.has(t.id) ? { ...t, id: idMap.get(t.id)! } : t)));
          const updatedMilestones = project.milestones.map(m => {
            if (m.id !== milestoneId) return m;
            const resolvedNewIds = tempIds.map(tid => idMap.get(tid) || tid);
            return { ...m, taskIds: [...m.taskIds, ...resolvedNewIds] };
          });
          setProjects(prev =>
            prev.map(p => (p.id === projectId ? { ...p, milestones: updatedMilestones } : p))
          );

          await api.projects.update(projectId, {
            milestones: updatedMilestones.map(m => ({
              title: m.title,
              order: m.order,
              taskIds: m.taskIds.filter(id => /^[a-f\d]{24}$/i.test(id)),
              isNextActionable: Boolean(m.isNextActionable),
            })),
          });
        }
      } catch (err) {
        console.warn('Backend milestone task sync failed:', err);
      }
    }

    return newTasks;
  };

  const applyProjectMilestones = async (projectId: string, titles: string[]): Promise<void> => {
    const cleanTitles = titles.map(t => t.trim()).filter(Boolean);
    if (cleanTitles.length === 0) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const DEFAULT_TITLES = new Set(['Discovery & Setup', 'Execution Core', 'Review & Finalize']);
    const isEmptyDefaultTemplate =
      project.milestones.every(m => m.taskIds.length === 0 && DEFAULT_TITLES.has(m.title));

    const now = Date.now();
    const updatedMilestones = isEmptyDefaultTemplate
      ? cleanTitles.map((title, idx) => ({
          id: `m-${now}-${idx + 1}`,
          title,
          order: idx + 1,
          taskIds: [] as string[],
          isNextActionable: idx === 0,
        }))
      : [
          ...project.milestones,
          ...cleanTitles.map((title, idx) => ({
            id: `m-${now}-${idx + 1}`,
            title,
            order: project.milestones.length + idx + 1,
            taskIds: [] as string[],
            isNextActionable: project.milestones.length === 0 && idx === 0,
          })),
        ];

    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, milestones: updatedMilestones } : p))
    );

    if (isAuthenticated) {
      try {
        await api.projects.update(projectId, {
          milestones: updatedMilestones.map(m => ({
            title: m.title,
            order: m.order,
            taskIds: m.taskIds.filter(id => /^[a-f\d]{24}$/i.test(id)),
            isNextActionable: Boolean(m.isNextActionable),
          })),
        });
      } catch (err) {
        console.warn('Backend project milestone decomposition sync failed:', err);
      }
    }
  };

  // Shared Sessions (Real-Time WebSocket)
  const effectiveSharedTaskDisplay =
    sharedCustomTask.trim() || activeTask?.title || 'Focused Deep Work';

  const sharedIdentity = useMemo(
    () => ({
      participantId: sharedParticipantId,
      name: sharedDisplayName.trim() || user?.name || 'Focus Guest',
      avatar: sharedAvatar,
      status: sharedStatus,
      taskDisplay: effectiveSharedTaskDisplay,
      isPrivate: sharedIsPrivate,
    }),
    [
      sharedParticipantId,
      sharedDisplayName,
      user?.name,
      sharedAvatar,
      sharedStatus,
      effectiveSharedTaskDisplay,
      sharedIsPrivate,
    ]
  );

  const {
    participants: sharedParticipants,
    connectionState: sharedConnectionState,
    error: sharedConnectionError,
    sendStatus,
    sendTaskUpdate,
    disconnect: disconnectFocusRoom,
  } = useFocusRoomSocket(sharedRoomCode, sharedIdentity);

  // Auto-broadcast active task changes while connected to a shared room
  useEffect(() => {
    if (!sharedRoomCode || sharedConnectionState !== 'connected') return;
    sendTaskUpdate(effectiveSharedTaskDisplay, sharedIsPrivate);
  }, [sharedRoomCode, sharedConnectionState, effectiveSharedTaskDisplay, sharedIsPrivate, sendTaskUpdate]);

  // Auto-sync focus timer pause/resume to room status when active task state changes
  useEffect(() => {
    if (!sharedRoomCode || sharedConnectionState !== 'connected' || !activeTask) return;
    if (activeTask.state === 'PAUSED') {
      sendStatus('paused');
    } else if (activeTask.state === 'FOCUSING') {
      sendStatus('focusing');
    }
  }, [sharedRoomCode, sharedConnectionState, activeTask, sendStatus]);

  const joinSharedSession = (
    roomCode: string,
    isPrivate: boolean,
    options?: { displayName?: string; avatar?: string; taskDisplay?: string }
  ) => {
    const normalized = roomCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
    if (!normalized) return;

    setSharedIsPrivate(isPrivate);
    setSharedStatus(activeTask?.state === 'PAUSED' ? 'paused' : 'focusing');
    if (options?.displayName !== undefined) setSharedDisplayName(options.displayName);
    if (options?.avatar) setSharedAvatar(options.avatar);
    if (options?.taskDisplay !== undefined) setSharedCustomTask(options.taskDisplay);
    setSharedRoomCode(normalized);
  };

  const leaveSharedSession = () => {
    disconnectFocusRoom();
    setSharedRoomCode(null);
    setSharedCustomTask('');
  };

  const toggleSharedPrivacy = () => {
    setSharedIsPrivate(prev => {
      const next = !prev;
      sendTaskUpdate(effectiveSharedTaskDisplay, next);
      return next;
    });
  };

  const updateSharedStatus = (status: 'focusing' | 'paused' | 'break') => {
    setSharedStatus(status);
    sendStatus(status);
  };

  const updateSharedTaskDisplay = (taskDisplay: string) => {
    setSharedCustomTask(taskDisplay);
    sendTaskUpdate(taskDisplay.trim() || activeTask?.title || 'Focused Deep Work', sharedIsPrivate);
  };

  const resetToDefaults = () => {
    setTasks(INITIAL_TASKS);
    setProjects(INITIAL_PROJECTS);
    setInsights(INITIAL_INSIGHTS);
    setSessionHistory([]);
    disconnectFocusRoom();
    setSharedRoomCode(null);
    setActiveTaskId(null);
    setActiveSession(null);
    setSelectedDrawerTaskId(null);
    setIsStuckModalOpen(false);
    setIsTransitionModalOpen(false);
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.INSIGHTS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        projects,
        activeTaskId,
        activeTask,
        activeSession,
        sessionHistory,
        insights,
        sharedParticipants,
        isFocusModeActive,
        isStuckModalOpen,
        isTransitionModalOpen,
        selectedDrawerTaskId,

        createTask,
        updateTask,
        deleteTask,
        transitionTask,
        openTaskDrawer,

        startFocusSession,
        createFocusSession,
        pauseFocusSession,
        resumeFocusSession,
        extendFocusSession,
        completeActiveTask,
        endFocusSessionWithoutCompleting,
        deleteSessionHistoryItem,

        triggerStalled,
        requestNextStepHelp,
        startRecoveredStep,
        closeStuckModal,
        triggerTransitionFlow,
        completeTransition,

        requestStepBreakdown,
        retryFailedOperation,
        toggleStepCompletion,
        addCustomStep,
        deleteCustomStep,

        createProject,
        addMilestoneToProject,
        setNextActionableMilestone,
        addTasksToMilestone,
        applyProjectMilestones,

        isSharedSessionActive,
        sharedRoomCode,
        sharedParticipantId,
        sharedConnectionState,
        sharedConnectionError,
        sharedIsPrivate,
        sharedStatus,
        joinSharedSession,
        leaveSharedSession,
        toggleSharedPrivacy,
        updateSharedStatus,
        updateSharedTaskDisplay,

        resetToDefaults,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};
