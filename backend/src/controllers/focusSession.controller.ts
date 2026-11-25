import { Response } from 'express';
import FocusSession from '../models/FocusSession';
import { AuthRequest } from '../middleware/auth';
import { isDatabaseConnected } from '../utils/db';
import { localStore } from '../utils/localStore';

// GET /api/v1/focus-sessions
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      res.json(req.user?.id ? localStore.getFocusSessions(req.user.id) : []);
      return;
    }
    const sessions = await FocusSession.find({ userId: req.user?.id }).sort({ createdAt: -1 }).limit(100);
    res.json(sessions);
  } catch (error) {
    console.error('GetSessions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/focus-sessions
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId, taskTitle, plannedMinutes, startedAt, durationMinutes,
            completed, completedStepsCount, totalStepsCount, status, endedAt } = req.body;
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    if (!isDatabaseConnected()) {
      const session = localStore.createFocusSession({
        userId: req.user?.id || '',
        taskId: String(taskId),
        taskTitle: taskTitle || '',
        plannedMinutes: plannedMinutes || 25,
        durationMinutes: durationMinutes || 0,
        completed: Boolean(completed),
        completedStepsCount: completedStepsCount || 0,
        totalStepsCount: totalStepsCount || 0,
        status: status || 'COMPLETED',
        startedAt: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
        endedAt: endedAt ? new Date(endedAt).toISOString() : new Date().toISOString(),
      });
      res.status(201).json(session);
      return;
    }
    const session = await FocusSession.create({
      userId: req.user?.id,
      taskId,
      taskTitle: taskTitle || '',
      plannedMinutes: plannedMinutes || 25,
      durationMinutes: durationMinutes || 0,
      completed: completed || false,
      completedStepsCount: completedStepsCount || 0,
      totalStepsCount: totalStepsCount || 0,
      status: status || 'COMPLETED',
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : new Date(),
    });
    res.status(201).json(session);
  } catch (error) {
    console.error('CreateSession error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/v1/focus-sessions/:id
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = localStore.deleteFocusSession(sessionId, req.user?.id || '');
      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({ message: 'Session deleted successfully' });
      return;
    }
    const session = await FocusSession.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('DeleteSession error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
