import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import focusSessionRoutes from './routes/focusSession.routes';
import insightRoutes from './routes/insight.routes';
import chatRoutes from './routes/chat.routes';
import aiRoutes from './routes/ai.routes';
import { getActiveRooms } from './websocket/focusRoom';
import { getDatabaseError, isDatabaseConnected } from './utils/db';
// import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/focus-sessions', focusSessionRoutes);
app.use('/api/v1/insights', insightRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/ai', aiRoutes);

app.get('/api/v1/focus-rooms', (_req, res) => {
  res.json({ success: true, data: getActiveRooms() });
});

app.get('/api/v1/health', (_req, res) => {
  const connected = isDatabaseConnected();
  res.json({
    success: true,
    message: 'API is running',
    database: connected ? 'connected' : 'disconnected',
    ...(connected ? {} : { databaseError: getDatabaseError() }),
  });
});

// Error handling
// app.use(errorHandler);

export default app;
