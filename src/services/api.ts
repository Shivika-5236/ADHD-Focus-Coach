// Frontend API client communicating with Express + MongoDB backend

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? rawApiUrl.endsWith('/api/v1')
    ? rawApiUrl
    : `${rawApiUrl}/api/v1`
  : '/api/v1';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('adhd_auth_token');
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('adhd_auth_token', token);
  } else {
    localStorage.removeItem('adhd_auth_token');
  }
};

const authHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export interface UserPreferencesDTO {
  theme: 'Light' | 'Dark' | 'System';
  focusTimerDefault: string;
  notifications: boolean;
  sound: boolean;
  autoStartNextStep: boolean;
  showDailyTips: boolean;
}

export interface AuthUserDTO {
  id: string;
  name: string;
  email: string;
  preferences?: UserPreferencesDTO;
}

export interface CoachingDigestDTO {
  headline: string;
  strengths: string[];
  watchOuts: string[];
  nextExperiment: string;
  signature: string;
  generatedAt: string;
}

export const api = {
  health: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ success: boolean; message: string; database: 'connected' | 'disconnected' }>(res);
  },

  auth: {
    register: async (name: string, email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      return handleResponse<{ token: string; user: AuthUserDTO }>(res);
    },
    login: async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse<{ token: string; user: AuthUserDTO }>(res);
    },
    getMe: async () => {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: authHeaders(),
      });
      return handleResponse<{ user: AuthUserDTO }>(res);
    },
    getPreferences: async () => {
      const res = await fetch(`${API_BASE}/auth/preferences`, {
        headers: authHeaders(),
      });
      return handleResponse<{ preferences: UserPreferencesDTO }>(res);
    },
    updatePreferences: async (prefs: Partial<UserPreferencesDTO>) => {
      const res = await fetch(`${API_BASE}/auth/preferences`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(prefs),
      });
      return handleResponse<{ preferences: UserPreferencesDTO }>(res);
    },
  },

  tasks: {
    getAll: async () => {
      const res = await fetch(`${API_BASE}/tasks`, {
        headers: authHeaders(),
      });
      return handleResponse<any[]>(res);
    },
    create: async (taskData: any) => {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(taskData),
      });
      return handleResponse<any>(res);
    },
    update: async (id: string, updates: any) => {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse<any>(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse<{ message: string }>(res);
    },
  },

  projects: {
    getAll: async () => {
      const res = await fetch(`${API_BASE}/projects`, {
        headers: authHeaders(),
      });
      return handleResponse<any[]>(res);
    },
    create: async (projectData: { name: string; description?: string; color?: string }) => {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(projectData),
      });
      return handleResponse<any>(res);
    },
    update: async (id: string, updates: any) => {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse<any>(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse<{ message: string }>(res);
    },
    addMilestone: async (id: string, title: string) => {
      const res = await fetch(`${API_BASE}/projects/${id}/milestones`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title }),
      });
      return handleResponse<any>(res);
    },
  },

  focusSessions: {
    getAll: async () => {
      const res = await fetch(`${API_BASE}/focus-sessions`, {
        headers: authHeaders(),
      });
      return handleResponse<any[]>(res);
    },
    create: async (sessionData: any) => {
      const res = await fetch(`${API_BASE}/focus-sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(sessionData),
      });
      return handleResponse<any>(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/focus-sessions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse<{ message: string }>(res);
    },
  },

  insights: {
    get: async () => {
      const res = await fetch(`${API_BASE}/insights`, {
        headers: authHeaders(),
      });
      return handleResponse<any>(res);
    },
    getDigest: async () => {
      const res = await fetch(`${API_BASE}/insights/digest`, {
        headers: authHeaders(),
      });
      return handleResponse<{ digest: CoachingDigestDTO | null }>(res);
    },
    saveDigest: async (digest: CoachingDigestDTO) => {
      const res = await fetch(`${API_BASE}/insights/digest`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(digest),
      });
      return handleResponse<{ digest: CoachingDigestDTO }>(res);
    },
  },

  chat: {
    getHistory: async () => {
      const res = await fetch(`${API_BASE}/chat/history`, {
        headers: authHeaders(),
      });
      return handleResponse<{
        messages: {
          id: string;
          role: 'user' | 'assistant';
          content: string;
          action?: { type: string; label?: string; executed?: boolean; data?: any };
          createdAt: string;
        }[];
      }>(res);
    },
    clearHistory: async () => {
      const res = await fetch(`${API_BASE}/chat/history`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse<{ message: string }>(res);
    },
    sendMessage: async (
      messages: { role: 'user' | 'assistant'; content: string }[],
      context?: any
    ) => {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ messages, context }),
      });
      return handleResponse<{ message: string; action?: any }>(res);
    },
  },

  ai: {
    breakdown: async (data: {
      title: string;
      notes?: string;
      plannedMinutes: number;
      priority: string;
      projectName?: string;
    }) => {
      const res = await fetch(`${API_BASE}/ai/breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{
        steps: { title: string; estimatedMinutes: number; isCurrent: boolean }[];
        suggestedPlannedMinutes?: number;
      }>(res);
    },

    unstick: async (data: {
      taskTitle: string;
      currentStepTitle?: string;
      elapsedMinutes: number;
      stuckReason?: string;
    }) => {
      const res = await fetch(`${API_BASE}/ai/unstick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ micromove: string }>(res);
    },

    parseBrainDump: async (data: {
      rawText: string;
      projects?: { id: string; name: string }[];
    }) => {
      const res = await fetch(`${API_BASE}/ai/parse-brain-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{
        title: string;
        notes: string;
        priority: 'low' | 'medium' | 'high';
        plannedMinutes: number;
        isToday: boolean;
        suggestedProjectId?: string;
        steps: { title: string; estimatedMinutes: number; isCurrent: boolean }[];
      }>(res);
    },

    insightsDigest: async (data: {
      totalFocusMinutes: number;
      completedTasksCount: number;
      totalTasksCount: number;
      completionRate: number;
      streakDays: number;
      averageAccuracyRate: number;
      recoverySuccessCount: number;
      avgSessionDuration: number;
      timeOfDayMinutes: { morning: number; afternoon: number; evening: number };
      dailyHistory: { dayLabel: string; focusMinutes: number; tasksDone: number }[];
      recentSessions: {
        taskTitle: string;
        durationMinutes: number;
        plannedMinutes: number;
        completed: boolean;
        completedStepsCount: number;
        totalStepsCount: number;
        startedAt?: string;
      }[];
      stalledTasks?: { title: string; lastStalledReason?: string }[];
    }) => {
      const res = await fetch(`${API_BASE}/ai/insights-digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{
        headline: string;
        strengths: string[];
        watchOuts: string[];
        nextExperiment: string;
      }>(res);
    },

    decomposeMilestone: async (data: {
      projectName: string;
      projectDescription?: string;
      milestoneTitle: string;
      milestoneOrder?: number;
      existingTaskTitles?: string[];
    }) => {
      const res = await fetch(`${API_BASE}/ai/decompose-milestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{
        tasks: {
          title: string;
          notes: string;
          plannedMinutes: number;
          priority: 'low' | 'medium' | 'high';
          steps: { title: string; estimatedMinutes: number; isCurrent: boolean }[];
        }[];
      }>(res);
    },

    decomposeProject: async (data: {
      projectName: string;
      projectDescription?: string;
      existingMilestones?: string[];
    }) => {
      const res = await fetch(`${API_BASE}/ai/decompose-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{
        milestones: { title: string }[];
      }>(res);
    },
  },

  focusRooms: {
    list: async () => {
      const res = await fetch(`${API_BASE}/focus-rooms`);
      const payload = await handleResponse<
        | {
            success?: boolean;
            data?: {
              roomCode: string;
              participantCount: number;
              maxParticipants: number;
              focusingCount: number;
            }[];
          }
        | {
            roomCode: string;
            participantCount: number;
            maxParticipants: number;
            focusingCount: number;
          }[]
      >(res);
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.data)) return payload.data;
      return [];
    },
  },
};
