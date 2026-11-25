import type { TaskState } from '../types/task';

/**
 * PRD Finite State Machine Allowed Transitions Map
 */
export const ALLOWED_TRANSITIONS: Record<TaskState, TaskState[]> = {
  CAPTURED: ['PLANNED', 'PROCESSING_FAILED'],
  PLANNED: ['READY_TO_START', 'CAPTURED', 'PROCESSING_FAILED'],
  READY_TO_START: ['FOCUSING', 'PLANNED'],
  FOCUSING: ['PAUSED', 'STALLED', 'TRANSITIONING', 'COMPLETED', 'PROCESSING_FAILED'],
  PAUSED: ['FOCUSING', 'TRANSITIONING', 'COMPLETED'],
  STALLED: ['RECOVERY', 'FOCUSING'],
  RECOVERY: ['FOCUSING', 'PROCESSING_FAILED'],
  TRANSITIONING: ['READY_TO_START', 'COMPLETED'],
  COMPLETED: ['PLANNED'], // Can revisit if needed
  PROCESSING_FAILED: ['CAPTURED', 'PLANNED', 'RECOVERY', 'FOCUSING'], // Recovery targets
};

/**
 * Validates whether a state transition is legal according to the PRD
 */
export function canTransition(from: TaskState, to: TaskState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * State descriptive metadata for clear, non-punitive UI presentation
 */
export interface StateMeta {
  label: string;
  badgeClass: string;
  description: string;
  primaryActionLabel?: string;
}

export const STATE_METADATA: Record<TaskState, StateMeta> = {
  CAPTURED: {
    label: 'Captured',
    badgeClass: 'badge-captured',
    description: 'Quickly recorded. Ready to plan duration and steps.',
    primaryActionLabel: 'Plan Task',
  },
  PLANNED: {
    label: 'Planned',
    badgeClass: 'badge-planned',
    description: 'Steps and time planned. Ready to queue for action.',
    primaryActionLabel: 'Mark Ready',
  },
  READY_TO_START: {
    label: 'Ready to Start',
    badgeClass: 'badge-ready',
    description: 'Prepared and uncluttered. Primed for focused work.',
    primaryActionLabel: 'Start Focus',
  },
  FOCUSING: {
    label: 'Focusing',
    badgeClass: 'badge-focusing',
    description: 'Active focus session in progress.',
    primaryActionLabel: 'Pause',
  },
  PAUSED: {
    label: 'Paused',
    badgeClass: 'badge-paused',
    description: 'Session paused. Take a breath and resume when ready.',
    primaryActionLabel: 'Resume Focus',
  },
  STALLED: {
    label: 'Stalled',
    badgeClass: 'badge-stalled',
    description: 'Feeling resistance or hit a barrier. You are not stuck permanently.',
    primaryActionLabel: 'Get Next Step Help',
  },
  RECOVERY: {
    label: 'Recovery',
    badgeClass: 'badge-recovery',
    description: 'A gentle, bite-sized micro-step to rebuild momentum.',
    primaryActionLabel: 'Start Next Step',
  },
  TRANSITIONING: {
    label: 'Transitioning',
    badgeClass: 'badge-transitioning',
    description: 'Session complete. Mindful moment to choose your next move.',
    primaryActionLabel: 'Choose Next Task',
  },
  COMPLETED: {
    label: 'Completed',
    badgeClass: 'badge-completed',
    description: 'Task accomplished. Great progress!',
  },
  PROCESSING_FAILED: {
    label: 'Processing Paused',
    badgeClass: 'badge-failed',
    description: 'A temporary service hiccup occurred. Your task is completely safe.',
    primaryActionLabel: 'Retry Action',
  },
};
