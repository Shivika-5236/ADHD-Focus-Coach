# ADHD Focus Coach

A full-stack ADHD productivity and focus coaching web application designed to reduce task-initiation friction, break overwhelming goals into manageable micro-steps, and support real-time body doubling.

## Features

- **Today Focus & Time-Aware Planner**: Prioritizes one active focus task at a time with structured focus timers and session tracking.
- **AI Task Breakdown & Brain Dump**: Uses Google Gemini on the backend to parse unstructured brain dumps, break down tasks into small steps, and help unstick stalled work.
- **Project Map & Milestones**: Organizes larger projects into milestones and actionable tasks.
- **Focus Coach Chat**: Context-aware AI coaching chat backed by persistent conversation history.
- **Real-Time Shared Focus Rooms**: Live body-doubling rooms powered by WebSockets (`/ws/focus-room`).
- **Work Insights**: Tracks focus minutes, streaks, completed tasks, and AI-generated coaching digests.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Lucide Icons, Canvas Confetti
- **Backend**: Node.js, Express 5, TypeScript, WebSockets (`ws`), Zod, Helmet, CORS, JWT + bcrypt
- **Database**: MongoDB Atlas (Mongoose)
- **AI**: Google Gemini API (`@google/genai`)

## Project Structure

```text
ADHDFocusCoach/
├── src/                    # Frontend React + TypeScript source
│   ├── components/         # UI components & modals
│   ├── context/            # AuthContext & TaskContext
│   ├── hooks/              # WebSocket & global keyboard shortcut hooks
│   ├── services/api.ts     # Typed REST API client
│   └── utils/              # Audio synthesizer, theme, state machine
├── backend/                # Express + TypeScript backend
│   ├── src/
│   │   ├── controllers/    # Auth, tasks, projects, sessions, insights, chat, AI
│   │   ├── middleware/     # JWT auth middleware
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # /api/v1/* Express routes
│   │   ├── websocket/      # /ws/focus-room WebSocket server
│   │   ├── app.ts          # Express app & CORS setup
│   │   └── server.ts       # HTTP + WebSocket server entrypoint
│   ├── .env.example        # Backend environment template
│   └── package.json
├── .env.example            # Frontend environment template
├── vite.config.ts          # Vite config with /api and /ws dev proxy
└── package.json
```

## Local Development Setup

### 1. Prerequisites

- Node.js 20+ and npm
- A MongoDB Atlas cluster (or local MongoDB instance)
- A Google Gemini API key

### 2. Install Dependencies

Install both frontend and backend dependencies:

```bash
# Install frontend dependencies (from repository root)
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Configure Environment Variables

Create the backend `.env` file from the template:

```bash
cp backend/.env.example backend/.env
```

Update `backend/.env` with your own values:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5001` |
| `DATABASE_URL` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Strong random secret for signing JWTs | `your-random-secret` |
| `JWT_EXPIRES_IN` | JWT expiration duration | `7d` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `GEMINI_API_KEY` | Google Gemini API key (backend only) | `your-gemini-api-key` |

For local development, you do **not** need a root `.env` file — `vite.config.ts` automatically proxies `/api` and `/ws` requests to `http://localhost:5001`.

### 4. Run in Development

Start the backend and frontend in separate terminals:

```bash
# Terminal 1: Backend (http://localhost:5001)
cd backend
npm run dev

# Terminal 2: Frontend (http://localhost:5173)
npm run dev
```

## Available Scripts

### Frontend (root)
- `npm run dev` — Start Vite development server
- `npm run build` — Type-check (`tsc -b`) and build production bundle to `dist/`
- `npm run lint` — Run Oxlint checks
- `npm run preview` — Preview production build locally

### Backend (`backend/`)
- `npm run dev` — Start backend with `ts-node-dev` hot reload
- `npm run build` — Compile TypeScript to `backend/dist/`
- `npm start` — Run compiled production server (`node dist/server.js`)

## Deployment Overview (Vercel + Render + MongoDB Atlas)

### 1. Database (MongoDB Atlas)
- Ensure your Atlas cluster Network Access allows connections from your Render backend (or `0.0.0.0/0` if using dynamic Render outbound IPs on the free tier).

### 2. Backend (Render)
- Create a **Web Service** on Render connected to your GitHub repository.
- Set **Root Directory** to `backend`.
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- Add environment variables in Render:
  - `DATABASE_URL`
  - `JWT_SECRET` (use a strong production secret)
  - `JWT_EXPIRES_IN=7d`
  - `CLIENT_URL=https://your-app.vercel.app` (your Vercel URL)
  - `GEMINI_API_KEY`

### 3. Frontend (Vercel)
- Import your GitHub repository on Vercel.
- Keep **Root Directory** as `.` (repository root), **Framework Preset** as `Vite`, **Build Command** as `npm run build`, and **Output Directory** as `dist`.
- Add environment variables in Vercel:
  - `VITE_API_URL=https://your-backend-service.onrender.com`
  - `VITE_WS_URL=wss://your-backend-service.onrender.com/ws/focus-room`
- Redeploy after setting environment variables so Vite embeds them into the production bundle.
