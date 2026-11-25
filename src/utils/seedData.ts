import type { Task, Project, SharedParticipant, ProductivityInsights } from '../types/task';

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_PARTICIPANTS: SharedParticipant[] = [];

export const INITIAL_INSIGHTS: ProductivityInsights = {
  totalFocusMinutes: 0,
  completedTasksCount: 0,
  streakDays: 0,
  averageAccuracyRate: 0,
  recoverySuccessCount: 0,
  timeOfDayMinutes: {
    morning: 0,
    afternoon: 0,
    evening: 0,
  },
  dailyHistory: [],
};
