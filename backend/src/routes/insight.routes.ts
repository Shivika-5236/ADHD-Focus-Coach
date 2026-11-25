import { Router } from 'express';
import { getInsights, getDigest, saveDigest } from '../controllers/insight.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getInsights);
router.get('/digest', getDigest);
router.put('/digest', saveDigest);

export default router;
