import { Router } from 'express';
import {
  breakdown,
  unstick,
  parseBrainDump,
  insightsDigest,
  decomposeMilestone,
  decomposeProject,
} from '../controllers/ai.controller';

const router = Router();

// POST /api/v1/ai/breakdown — no auth required (available to guests too)
router.post('/breakdown', breakdown);

// POST /api/v1/ai/unstick — no auth required
router.post('/unstick', unstick);

// POST /api/v1/ai/parse-brain-dump — no auth required
router.post('/parse-brain-dump', parseBrainDump);

// POST /api/v1/ai/insights-digest — no auth required
router.post('/insights-digest', insightsDigest);

// POST /api/v1/ai/decompose-milestone — no auth required
router.post('/decompose-milestone', decomposeMilestone);

// POST /api/v1/ai/decompose-project — no auth required
router.post('/decompose-project', decomposeProject);

export default router;

