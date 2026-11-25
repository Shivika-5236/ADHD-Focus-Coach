import { Response } from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task';
import { AuthRequest } from '../middleware/auth';
import { isDatabaseConnected } from '../utils/db';
import { localStore, newLocalId, type LocalTask, type LocalTaskStep } from '../utils/localStore';

const sanitizeSteps = (steps: unknown) => {
  if (!Array.isArray(steps)) return undefined;
  return steps.map((step: Record<string, unknown>, idx: number) => {
    const cleaned: Record<string, unknown> = {
      title: typeof step.title === 'string' ? step.title.trim() : 'Step',
      isCompleted: Boolean(step.isCompleted),
      isCurrent: Boolean(step.isCurrent),
      estimatedMinutes: typeof step.estimatedMinutes === 'number' ? step.estimatedMinutes : 5,
      position: typeof step.position === 'number' ? step.position : idx,
    };
    const candidateId = typeof step._id === 'string' ? step._id : typeof step.id === 'string' ? step.id : undefined;
    if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
      cleaned._id = candidateId;
    }
    return cleaned;
  });
};

const toLocalSteps = (steps: unknown): LocalTaskStep[] => {
  const sanitized = sanitizeSteps(steps) || [];
  return sanitized.map(s => ({
    _id: typeof s._id === 'string' ? s._id : newLocalId(),
    title: String(s.title),
    isCompleted: Boolean(s.isCompleted),
    isCurrent: Boolean(s.isCurrent),
    estimatedMinutes: typeof s.estimatedMinutes === 'number' ? s.estimatedMinutes : 5,
    position: typeof s.position === 'number' ? s.position : 0,
  }));
};

// GET /api/v1/tasks
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      res.json(req.user?.id ? localStore.getTasks(req.user.id) : []);
      return;
    }
    const tasks = await Task.find({ userId: req.user?.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('GetTasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/tasks
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, notes, isToday, projectId, plannedMinutes, priority, steps } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Task title is required' });
      return;
    }
    if (!isDatabaseConnected()) {
      const task = localStore.createTask({
        userId: req.user?.id || '',
        title: String(title).trim(),
        notes: notes || '',
        isToday: isToday !== undefined ? Boolean(isToday) : true,
        projectId: projectId || undefined,
        plannedMinutes: plannedMinutes || 20,
        priority: priority || 'medium',
        steps: toLocalSteps(steps),
        state: 'CAPTURED',
        actualMinutes: 0,
      });
      res.status(201).json(task);
      return;
    }
    const task = await Task.create({
      userId: req.user?.id,
      title: title.trim(),
      notes: notes || '',
      isToday: isToday !== undefined ? isToday : true,
      projectId: projectId || undefined,
      plannedMinutes: plannedMinutes || 20,
      priority: priority || 'medium',
      steps: sanitizeSteps(steps) || [],
      state: 'CAPTURED',
      actualMinutes: 0,
    });
    res.status(201).json(task);
  } catch (error) {
    console.error('CreateTask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/tasks/:id
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = { ...(req.body as Record<string, unknown>) };
    delete body._id;
    delete body.id;
    delete body.userId;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.isProcessing;
    delete body.processingError;

    if (!isDatabaseConnected()) {
      if (body.steps !== undefined) {
        body.steps = toLocalSteps(body.steps);
      }
      const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const task = localStore.updateTask(taskId, req.user?.id || '', body as Partial<LocalTask>);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json(task);
      return;
    }

    if (body.steps !== undefined) {
      body.steps = sanitizeSteps(body.steps);
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (error) {
    console.error('UpdateTask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/v1/tasks/:id
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = localStore.deleteTask(taskId, req.user?.id || '');
      if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json({ message: 'Task deleted successfully' });
      return;
    }
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('DeleteTask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
