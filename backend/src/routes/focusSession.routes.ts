import { Router } from 'express';
import { getSessions, createSession, deleteSession } from '../controllers/focusSession.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getSessions);
router.post('/', createSession);
router.delete('/:id', deleteSession);

export default router;
