export type TaskState =
  | 'CAPTURED'
  | 'PLANNED'
  | 'READY_TO_START'
  | 'FOCUSING'
  | 'PAUSED'
  | 'STALLED'
  | 'RECOVERY'
  | 'TRANSITIONING'
  | 'COMPLETED'
  | 'PROCESSING_FAILED';

export interface TaskStep {
  id: string;
  title: string;
  isCompleted: boolean;
  isCurrent?: boolean;
  estimatedMinutes?: number;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  state: TaskState;
  previousState?: TaskState; // Context preservation during failure/recovery
  projectId?: string;
  plannedMinutes: number;
  actualMinutes: number;
  steps: TaskStep[];
  priority: 'low' | 'medium' | 'high';
  isToday: boolean;
  createdAt: string;
  completedAt?: string;
  lastStalledReason?: string;
  suggestedNextAction?: string;
  processingError?: string;
  isProcessing?: boolean;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  order: number;
  taskIds: string[];
  isNextActionable?: boolean;
}

export interface ProjectDependency {
  fromMilestoneId: string;
  toMilestoneId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  milestones: ProjectMilestone[];
  dependencies: ProjectDependency[];
}

export interface ActiveFocusSession {
  taskId: string;
  startedAt: number;
  elapsedSeconds: number;
  plannedSeconds: number;
  activeStepId?: string;
}

export interface EndedFocusSession {
  id: string;
  taskId: string;
  taskTitle: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  plannedMinutes: number;
  completed: boolean;
  completedStepsCount: number;
  totalStepsCount: number;
}

export interface SharedParticipant {
  id: string;
  name: string;
  avatar: string;
  status: 'focusing' | 'paused' | 'break';
  taskDisplay: string;
  isPrivate: boolean;
  elapsedMinutes: number;
  joinedAt?: number;
}

export interface ProductivityInsights {
  totalFocusMinutes: number;
  completedTasksCount: number;
  streakDays: number;
  averageAccuracyRate: number; // Planned vs Actual ratio
  recoverySuccessCount: number;
  timeOfDayMinutes: {
    morning: number;
    afternoon: number;
    evening: number;
  };
  dailyHistory: {
    date: string;
    dayLabel: string;
    focusMinutes: number;
    tasksDone: number;
  }[];
}
