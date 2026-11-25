import { Response } from 'express';
import Task from '../models/Task';
import FocusSession from '../models/FocusSession';
import CoachingDigest from '../models/CoachingDigest';
import { AuthRequest } from '../middleware/auth';
import { isDatabaseConnected } from '../utils/db';
import { localStore } from '../utils/localStore';

interface SessionLike {
  durationMinutes: number;
  completed: boolean;
  startedAt?: Date | string;
  createdAt: Date | string;
}

interface TaskLike {
  plannedMinutes: number;
  actualMinutes: number;
  completedAt?: Date | string;
  updatedAt: Date | string;
}

const buildInsightsPayload = (
  completedSessions: SessionLike[],
  allSessions: SessionLike[],
  completedTasks: TaskLike[]
) => {
  const totalFocusMinutes = completedSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const completedTasksCount = completedTasks.length;

  const tasksWithBoth = completedTasks.filter(t => t.plannedMinutes > 0 && t.actualMinutes > 0);
  const averageAccuracyRate =
    tasksWithBoth.length > 0
      ? tasksWithBoth.reduce((sum, t) => sum + t.actualMinutes / t.plannedMinutes, 0) /
        tasksWithBoth.length
      : 0;

  const dailyMap: Record<string, { focusMinutes: number; tasksDone: number }> = {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyMap[key] = { focusMinutes: 0, tasksDone: 0 };
  }
  completedSessions.forEach(s => {
    const key = new Date(s.createdAt).toISOString().split('T')[0];
    if (dailyMap[key]) {
      dailyMap[key].focusMinutes += s.durationMinutes;
    }
  });
  completedTasks.forEach(t => {
    const key = t.completedAt
      ? new Date(t.completedAt).toISOString().split('T')[0]
      : new Date(t.updatedAt).toISOString().split('T')[0];
    if (dailyMap[key]) {
      dailyMap[key].tasksDone += 1;
    }
  });

  const today = new Date().toISOString().split('T')[0];
  const dailyHistory = Object.entries(dailyMap).map(([date, data]) => ({
    date,
    dayLabel: date === today ? 'Today' : days[new Date(date).getDay()],
    focusMinutes: data.focusMinutes,
    tasksDone: data.tasksDone,
  }));

  const timeOfDayMinutes = { morning: 0, afternoon: 0, evening: 0 };
  completedSessions.forEach(s => {
    const hour = s.startedAt ? new Date(s.startedAt).getHours() : 12;
    if (hour < 12) timeOfDayMinutes.morning += s.durationMinutes;
    else if (hour < 17) timeOfDayMinutes.afternoon += s.durationMinutes;
    else timeOfDayMinutes.evening += s.durationMinutes;
  });

  return {
    totalFocusMinutes,
    completedTasksCount,
    streakDays: calculateStreak(dailyHistory),
    averageAccuracyRate: Math.round(averageAccuracyRate * 100) / 100,
    recoverySuccessCount: completedSessions.length,
    timeOfDayMinutes,
    dailyHistory,
    recentSessions: allSessions.slice(0, 10),
  };
};

// GET /api/v1/insights
export const getInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!isDatabaseConnected()) {
      const allSessions = userId ? localStore.getFocusSessions(userId) : [];
      const completedSessions = allSessions.filter(s => s.completed);
      const completedTasks = userId
        ? localStore.getTasks(userId).filter(t => t.state === 'COMPLETED')
        : [];
      res.json(buildInsightsPayload(completedSessions, allSessions, completedTasks));
      return;
    }

    const [completedSessions, allSessions, completedTasks] = await Promise.all([
      FocusSession.find({ userId, completed: true }),
      FocusSession.find({ userId }).sort({ createdAt: -1 }).limit(50),
      Task.find({ userId, state: 'COMPLETED' }),
    ]);

    res.json(buildInsightsPayload(completedSessions, allSessions, completedTasks));
  } catch (error) {
    console.error('GetInsights error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/v1/insights/digest
export const getDigest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const digest = req.user?.id ? localStore.getDigest(req.user.id) : null;
      if (!digest) {
        res.json({ digest: null });
        return;
      }
      res.json({
        digest: {
          headline: digest.headline,
          strengths: digest.strengths,
          watchOuts: digest.watchOuts,
          nextExperiment: digest.nextExperiment,
          signature: digest.signature,
          generatedAt: digest.generatedAt,
        },
      });
      return;
    }

    const digest = await CoachingDigest.findOne({ userId: req.user?.id });
    if (!digest) {
      res.json({ digest: null });
      return;
    }
    res.json({
      digest: {
        headline: digest.headline,
        strengths: digest.strengths,
        watchOuts: digest.watchOuts,
        nextExperiment: digest.nextExperiment,
        signature: digest.signature,
        generatedAt: digest.generatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('GetDigest error:', error);
    res.status(500).json({ error: 'Server error loading coaching digest' });
  }
};

// PUT /api/v1/insights/digest
export const saveDigest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { headline, strengths, watchOuts, nextExperiment, signature, generatedAt } = req.body;
    if (typeof headline !== 'string' || typeof nextExperiment !== 'string') {
      res.status(400).json({ error: 'headline and nextExperiment are required' });
      return;
    }

    const cleanStrengths = Array.isArray(strengths)
      ? strengths.filter((s: unknown) => typeof s === 'string')
      : [];
    const cleanWatchOuts = Array.isArray(watchOuts)
      ? watchOuts.filter((w: unknown) => typeof w === 'string')
      : [];
    const resolvedGeneratedAt = generatedAt ? new Date(generatedAt) : new Date();

    if (!isDatabaseConnected()) {
      const saved = localStore.saveDigest({
        userId: req.user?.id || '',
        headline: headline.trim(),
        strengths: cleanStrengths,
        watchOuts: cleanWatchOuts,
        nextExperiment: nextExperiment.trim(),
        signature: typeof signature === 'string' ? signature : '',
        generatedAt: resolvedGeneratedAt.toISOString(),
      });
      res.json({
        digest: {
          headline: saved.headline,
          strengths: saved.strengths,
          watchOuts: saved.watchOuts,
          nextExperiment: saved.nextExperiment,
          signature: saved.signature,
          generatedAt: saved.generatedAt,
        },
      });
      return;
    }

    const digest = await CoachingDigest.findOneAndUpdate(
      { userId: req.user?.id },
      {
        $set: {
          headline: headline.trim(),
          strengths: cleanStrengths,
          watchOuts: cleanWatchOuts,
          nextExperiment: nextExperiment.trim(),
          signature: typeof signature === 'string' ? signature : '',
          generatedAt: resolvedGeneratedAt,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      digest: {
        headline: digest.headline,
        strengths: digest.strengths,
        watchOuts: digest.watchOuts,
        nextExperiment: digest.nextExperiment,
        signature: digest.signature,
        generatedAt: digest.generatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('SaveDigest error:', error);
    res.status(500).json({ error: 'Server error saving coaching digest' });
  }
};

function calculateStreak(dailyHistory: { date: string; focusMinutes: number }[]): number {
  let streak = 0;
  const sorted = [...dailyHistory].reverse();
  for (const day of sorted) {
    if (day.focusMinutes > 0) streak++;
    else break;
  }
  return streak;
}
