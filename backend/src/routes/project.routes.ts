import { Router } from 'express';
import { getProjects, createProject, updateProject, deleteProject, addMilestone } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getProjects);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/milestones', addMilestone);

export default router;
