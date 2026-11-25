import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { DEFAULT_USER_PREFERENCES, IUserPreferences } from '../models/User';
import type { TaskState } from '../models/Task';
import type { SessionStatus } from '../models/FocusSession';
import type { IChatAction } from '../models/ChatMessage';

export interface LocalUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  preferences: IUserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface LocalTaskStep {
  _id: string;
  title: string;
  isCompleted: boolean;
  isCurrent: boolean;
  estimatedMinutes?: number;
  position: number;
}

export interface LocalTask {
  _id: string;
  userId: string;
  projectId?: string;
  title: string;
  notes: string;
  state: TaskState;
  previousState?: TaskState;
  plannedMinutes: number;
  actualMinutes: number;
  priority: 'low' | 'medium' | 'high';
  isToday: boolean;
  steps: LocalTaskStep[];
  lastStalledReason?: string;
  suggestedNextAction?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalMilestone {
  _id: string;
  title: string;
  order: number;
  taskIds: string[];
  isNextActionable: boolean;
}

export interface LocalProject {
  _id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  milestones: LocalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalFocusSession {
  _id: string;
  userId: string;
  taskId: string;
  taskTitle?: string;
  status: SessionStatus;
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  plannedMinutes: number;
  completed: boolean;
  completedStepsCount: number;
  totalStepsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCoachingDigest {
  userId: string;
  headline: string;
  strengths: string[];
  watchOuts: string[];
  nextExperiment: string;
  signature: string;
  generatedAt: string;
}

export interface LocalChatMessage {
  _id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  action?: IChatAction;
  createdAt: string;
}

interface LocalDatabaseSchema {
  users: LocalUser[];
  tasks: LocalTask[];
  projects: LocalProject[];
  focusSessions: LocalFocusSession[];
  digests: LocalCoachingDigest[];
  chatMessages: LocalChatMessage[];
}

const STORE_PATH = path.resolve(__dirname, '../../data/local-db.json');

const createEmptyStore = (): LocalDatabaseSchema => ({
  users: [],
  tasks: [],
  projects: [],
  focusSessions: [],
  digests: [],
  chatMessages: [],
});

let cache: LocalDatabaseSchema | null = null;

/** Generate a Mongo-compatible 24-hex ObjectId string. */
export const newLocalId = (): string => new mongoose.Types.ObjectId().toString();

const loadStore = (): LocalDatabaseSchema => {
  if (cache) return cache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LocalDatabaseSchema>;
      cache = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        focusSessions: Array.isArray(parsed.focusSessions) ? parsed.focusSessions : [],
        digests: Array.isArray(parsed.digests) ? parsed.digests : [],
        chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
      };
      return cache;
    }
  } catch (err) {
    console.warn('⚠️ Failed to read local fallback store, starting fresh:', err);
  }
  cache = createEmptyStore();
  return cache;
};

const saveStore = (store: LocalDatabaseSchema): void => {
  cache = store;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ Failed to persist local fallback store:', err);
  }
};

/** File-backed local store used automatically when MongoDB Atlas is unreachable. */
export const localStore = {
  findUserByEmail(email: string): LocalUser | undefined {
    const normalized = email.trim().toLowerCase();
    return loadStore().users.find(u => u.email === normalized);
  },

  findUserById(id: string): LocalUser | undefined {
    return loadStore().users.find(u => u._id === id);
  },

  createUser(input: { name: string; email: string; passwordHash: string }): LocalUser {
    const store = loadStore();
    const now = new Date().toISOString();
    const user: LocalUser = {
      _id: newLocalId(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      preferences: { ...DEFAULT_USER_PREFERENCES },
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(user);
    saveStore(store);
    return user;
  },

  updateUserPreferences(userId: string, preferences: IUserPreferences): LocalUser | null {
    const store = loadStore();
    const user = store.users.find(u => u._id === userId);
    if (!user) return null;
    user.preferences = preferences;
    user.updatedAt = new Date().toISOString();
    saveStore(store);
    return user;
  },

  getTasks(userId: string): LocalTask[] {
    return loadStore()
      .tasks.filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createTask(input: Omit<LocalTask, '_id' | 'createdAt' | 'updatedAt'>): LocalTask {
    const store = loadStore();
    const now = new Date().toISOString();
    const task: LocalTask = {
      ...input,
      _id: newLocalId(),
      createdAt: now,
      updatedAt: now,
    };
    store.tasks.push(task);
    saveStore(store);
    return task;
  },

  updateTask(id: string, userId: string, updates: Partial<LocalTask>): LocalTask | null {
    const store = loadStore();
    const idx = store.tasks.findIndex(t => t._id === id && t.userId === userId);
    if (idx === -1) return null;
    store.tasks[idx] = {
      ...store.tasks[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
    return store.tasks[idx];
  },

  deleteTask(id: string, userId: string): boolean {
    const store = loadStore();
    const before = store.tasks.length;
    store.tasks = store.tasks.filter(t => !(t._id === id && t.userId === userId));
    if (store.tasks.length === before) return false;
    saveStore(store);
    return true;
  },

  getProjects(userId: string): LocalProject[] {
    return loadStore()
      .projects.filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createProject(input: Omit<LocalProject, '_id' | 'createdAt' | 'updatedAt'>): LocalProject {
    const store = loadStore();
    const now = new Date().toISOString();
    const project: LocalProject = {
      ...input,
      _id: newLocalId(),
      createdAt: now,
      updatedAt: now,
    };
    store.projects.push(project);
    saveStore(store);
    return project;
  },

  updateProject(id: string, userId: string, updates: Partial<LocalProject>): LocalProject | null {
    const store = loadStore();
    const idx = store.projects.findIndex(p => p._id === id && p.userId === userId);
    if (idx === -1) return null;
    store.projects[idx] = {
      ...store.projects[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
    return store.projects[idx];
  },

  deleteProject(id: string, userId: string): boolean {
    const store = loadStore();
    const before = store.projects.length;
    store.projects = store.projects.filter(p => !(p._id === id && p.userId === userId));
    if (store.projects.length === before) return false;
    saveStore(store);
    return true;
  },

  addMilestone(projectId: string, userId: string, title: string): LocalProject | null {
    const store = loadStore();
    const project = store.projects.find(p => p._id === projectId && p.userId === userId);
    if (!project) return null;
    project.milestones.push({
      _id: newLocalId(),
      title: title.trim(),
      order: project.milestones.length + 1,
      taskIds: [],
      isNextActionable: false,
    });
    project.updatedAt = new Date().toISOString();
    saveStore(store);
    return project;
  },

  getFocusSessions(userId: string): LocalFocusSession[] {
    return loadStore()
      .focusSessions.filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);
  },

  createFocusSession(input: Omit<LocalFocusSession, '_id' | 'createdAt' | 'updatedAt'>): LocalFocusSession {
    const store = loadStore();
    const now = new Date().toISOString();
    const session: LocalFocusSession = {
      ...input,
      _id: newLocalId(),
      createdAt: now,
      updatedAt: now,
    };
    store.focusSessions.push(session);
    saveStore(store);
    return session;
  },

  deleteFocusSession(id: string, userId: string): boolean {
    const store = loadStore();
    const before = store.focusSessions.length;
    store.focusSessions = store.focusSessions.filter(s => !(s._id === id && s.userId === userId));
    if (store.focusSessions.length === before) return false;
    saveStore(store);
    return true;
  },

  getDigest(userId: string): LocalCoachingDigest | null {
    return loadStore().digests.find(d => d.userId === userId) || null;
  },

  saveDigest(digest: LocalCoachingDigest): LocalCoachingDigest {
    const store = loadStore();
    const idx = store.digests.findIndex(d => d.userId === digest.userId);
    if (idx === -1) {
      store.digests.push(digest);
    } else {
      store.digests[idx] = digest;
    }
    saveStore(store);
    return digest;
  },

  getChatHistory(userId: string): LocalChatMessage[] {
    return loadStore()
      .chatMessages.filter(m => m.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-100);
  },

  appendChatMessages(messages: Omit<LocalChatMessage, '_id' | 'createdAt'>[]): void {
    const store = loadStore();
    const now = Date.now();
    messages.forEach((m, idx) => {
      store.chatMessages.push({
        ...m,
        _id: newLocalId(),
        createdAt: new Date(now + idx).toISOString(),
      });
    });
    saveStore(store);
  },

  clearChatHistory(userId: string): void {
    const store = loadStore();
    store.chatMessages = store.chatMessages.filter(m => m.userId !== userId);
    saveStore(store);
  },
};
