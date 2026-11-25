import { Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { isDatabaseConnected } from '../utils/db';
import { localStore, newLocalId, type LocalMilestone, type LocalProject } from '../utils/localStore';

const sanitizeMilestones = (milestones: unknown) => {
  if (!Array.isArray(milestones)) return undefined;
  return milestones.map((m: Record<string, unknown>, idx: number) => {
    const cleaned: Record<string, unknown> = {
      title: typeof m.title === 'string' ? m.title.trim() : `Milestone ${idx + 1}`,
      order: typeof m.order === 'number' ? m.order : idx + 1,
      taskIds: Array.isArray(m.taskIds) ? m.taskIds.map(String) : [],
      isNextActionable: Boolean(m.isNextActionable),
    };
    const candidateId = typeof m._id === 'string' ? m._id : typeof m.id === 'string' ? m.id : undefined;
    if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
      cleaned._id = candidateId;
    }
    return cleaned;
  });
};

const toLocalMilestones = (milestones: unknown): LocalMilestone[] => {
  const sanitized = sanitizeMilestones(milestones) || [];
  return sanitized.map(m => ({
    _id: typeof m._id === 'string' ? m._id : newLocalId(),
    title: String(m.title),
    order: typeof m.order === 'number' ? m.order : 1,
    taskIds: Array.isArray(m.taskIds) ? m.taskIds.map(String) : [],
    isNextActionable: Boolean(m.isNextActionable),
  }));
};

// GET /api/v1/projects
export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      res.json(req.user?.id ? localStore.getProjects(req.user.id) : []);
      return;
    }
    const projects = await Project.find({ userId: req.user?.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('GetProjects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/projects
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, color } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }
    const defaultMilestones = [
      { title: 'Discovery & Setup', order: 1, taskIds: [], isNextActionable: true },
      { title: 'Execution Core', order: 2, taskIds: [], isNextActionable: false },
      { title: 'Review & Finalize', order: 3, taskIds: [], isNextActionable: false },
    ];
    if (!isDatabaseConnected()) {
      const project = localStore.createProject({
        userId: req.user?.id || '',
        name: String(name).trim(),
        description: description || '',
        color: color || '#10b981',
        milestones: toLocalMilestones(defaultMilestones),
      });
      res.status(201).json(project);
      return;
    }
    const project = await Project.create({
      userId: req.user?.id,
      name: name.trim(),
      description: description || '',
      color: color || '#10b981',
      milestones: defaultMilestones,
    });
    res.status(201).json(project);
  } catch (error) {
    console.error('CreateProject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/v1/projects/:id
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = { ...(req.body as Record<string, unknown>) };
    delete body._id;
    delete body.id;
    delete body.userId;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.dependencies;

    if (!isDatabaseConnected()) {
      if (body.milestones !== undefined) {
        body.milestones = toLocalMilestones(body.milestones);
      }
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const project = localStore.updateProject(projectId, req.user?.id || '', body as Partial<LocalProject>);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json(project);
      return;
    }

    if (body.milestones !== undefined) {
      body.milestones = sanitizeMilestones(body.milestones);
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error) {
    console.error('UpdateProject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/v1/projects/:id
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = localStore.deleteProject(projectId, req.user?.id || '');
      if (!deleted) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ message: 'Project deleted successfully' });
      return;
    }
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('DeleteProject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/v1/projects/:id/milestones
export const addMilestone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Milestone title is required' });
      return;
    }
    if (!isDatabaseConnected()) {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const project = localStore.addMilestone(projectId, req.user?.id || '', String(title));
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json(project);
      return;
    }
    const project = await Project.findOne({ _id: req.params.id, userId: req.user?.id });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    project.milestones.push({
      title: title.trim(),
      order: project.milestones.length + 1,
      taskIds: [],
      isNextActionable: false,
    });
    await project.save();
    res.json(project);
  } catch (error) {
    console.error('AddMilestone error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
