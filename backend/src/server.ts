import dotenv from 'dotenv';
dotenv.config({ override: true });

import http from 'http';
import app from './app';
import connectDB from './utils/db';
import { createWebSocketServer } from './websocket/focusRoom';

const PORT = process.env.PORT || 5001;

// Connect to MongoDB then start HTTP + WebSocket server
connectDB().then(() => {
  const server = http.createServer(app);
  createWebSocketServer(server);
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
});
