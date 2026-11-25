import { Router } from 'express';
import { handleChat, getChatHistory, clearChatHistory } from '../controllers/chat.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuthenticate, handleChat);
router.get('/history', authenticate, getChatHistory);
router.delete('/history', authenticate, clearChatHistory);

export default router;
