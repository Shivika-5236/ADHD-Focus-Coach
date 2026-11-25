import { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import ChatMessage from '../models/ChatMessage';
import { AuthRequest } from '../middleware/auth';
import { isDatabaseConnected } from '../utils/db';
import { localStore } from '../utils/localStore';

interface ChatContext {
  activeTask?: {
    id: string;
    title: string;
    state: string;
    notes?: string;
    plannedMinutes: number;
    steps?: Array<{ id: string; title: string; isCompleted: boolean; isCurrent?: boolean }>;
    currentStep?: { id: string; title: string };
  } | null;
  activeSession?: {
    isFocusing: boolean;
    isPaused: boolean;
    elapsedMinutes: number;
    remainingMinutes: number;
    plannedMinutes: number;
  } | null;
  todayTasks?: Array<{
    id: string;
    title: string;
    state: string;
    plannedMinutes: number;
    completedStepsCount?: number;
    totalStepsCount?: number;
  }>;
  completedTasksCountToday?: number;
  streakDays?: number;
  userName?: string;
}

const buildContextSummary = (context?: ChatContext): string => {
  if (!context) return 'No live task or focus session is currently active.';

  const lines: string[] = [];
  if (context.userName) {
    lines.push(`User Name: ${context.userName}`);
  }

  if (context.activeTask) {
    const t = context.activeTask;
    lines.push(`Active Task: "${t.title}" (Status: ${t.state}, Planned: ${t.plannedMinutes} mins)`);
    if (t.notes) lines.push(`Task Notes: ${t.notes}`);
    if (t.currentStep) {
      lines.push(`Current Step: "${t.currentStep.title}" (ID: ${t.currentStep.id})`);
    }
    if (t.steps && t.steps.length > 0) {
      const stepSummary = t.steps.map((s, idx) => `${idx + 1}. [${s.isCompleted ? 'DONE' : 'TODO'}] ${s.title}`).join('; ');
      lines.push(`Steps: ${stepSummary}`);
    }
  } else {
    lines.push('Active Task: None currently in focus.');
  }

  if (context.activeSession) {
    const s = context.activeSession;
    lines.push(`Focus Timer: ${s.isPaused ? 'PAUSED' : 'FOCUSING active'} - Elapsed: ${s.elapsedMinutes}m, Remaining: ${s.remainingMinutes}m of ${s.plannedMinutes}m`);
  } else {
    lines.push('Focus Timer: Not running.');
  }

  if (context.todayTasks && context.todayTasks.length > 0) {
    const taskList = context.todayTasks.map(t => `"${t.title}" [${t.state}, ${t.plannedMinutes}m]`).join(', ');
    lines.push(`Today's Planned Tasks: ${taskList}`);
  }

  if (typeof context.completedTasksCountToday === 'number') {
    lines.push(`Tasks Completed Today: ${context.completedTasksCountToday}`);
  }
  if (typeof context.streakDays === 'number' && context.streakDays > 0) {
    lines.push(`Current Streak: ${context.streakDays} day(s)`);
  }

  return lines.join('\n');
};

export const getChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const history = req.user?.id ? localStore.getChatHistory(req.user.id) : [];
      res.json({
        messages: history.map(m => ({
          id: m._id,
          role: m.role,
          content: m.content,
          action: m.action,
          createdAt: m.createdAt,
        })),
      });
      return;
    }
    const history = await ChatMessage.find({ userId: req.user?.id })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json({
      messages: history.map(m => ({
        id: m._id.toString(),
        role: m.role,
        content: m.content,
        action: m.action,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('GetChatHistory error:', error);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
};

export const clearChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      if (req.user?.id) {
        localStore.clearChatHistory(req.user.id);
      }
      res.json({ message: 'Chat history cleared' });
      return;
    }
    await ChatMessage.deleteMany({ userId: req.user?.id });
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error('ClearChatHistory error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
};

export const handleChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const contextSummary = buildContextSummary(context);

    const systemInstruction = `You are Focus Coach, an empathetic, ADHD-specialized executive function coach built into the ADHDFocusCoach app.
You have real-time live access to the user's workspace, active focus session, timer, and tasks.

YOUR COACHING PHILOSOPHY (ADHD-FIRST):
1. Executive dysfunction is a neurological challenge with task initiation, working memory, and time perception—never a moral failing or laziness.
2. Meet the user where they are with warmth, validation, and zero judgment.
3. Keep responses concise (2 to 4 sentences max). Never overwhelm the user with walls of text or complex lists.
4. When the user feels overwhelmed or stuck, always offer a tiny "micromove" taking ≤2 minutes.
5. BE ACTION-CAPABLE: You can directly control the app! When the user asks you to pause, resume, extend timer, mark a step done, add a step, start a task, or when they express that they are stuck, trigger the appropriate action!

LIVE USER CONTEXT:
${contextSummary}

ACTION EXECUTION RULES:
You MUST respond with a JSON object in this exact schema:
{
  "message": "Short, warm, supportive message to the user.",
  "action": null | {
    "type": "PAUSE_SESSION" | "RESUME_SESSION" | "COMPLETE_TASK" | "END_SESSION" | "EXTEND_TIMER" | "MARK_STEP_DONE" | "ADD_STEP" | "START_FOCUS" | "I_AM_STUCK" | "CREATE_TASK",
    ...additional parameters
  }
}

Action details:
- "PAUSE_SESSION": Use when user wants to pause, take a breather, get water, hold on. No extra params.
- "RESUME_SESSION": Use when user is ready to continue or unpause. No extra params.
- "COMPLETE_TASK": Use when user finished the entire active task. No extra params.
- "END_SESSION": Use when user wants to stop/cancel the current session without completing the task. No extra params.
- "EXTEND_TIMER": Use when user needs more time (e.g. "add 5 mins", "need more time", "extend timer"). Params: { "extraMinutes": number (default 5) }
- "MARK_STEP_DONE": Use when user completed their current step. Params: { "stepId"?: string, "stepTitle"?: string }
- "ADD_STEP": Use when breaking down or adding a tiny micro-action. Params: { "title": string (concise imperative step ≤10 words), "estimatedMinutes"?: number (default 2) }
- "START_FOCUS": Use when starting a focus session on a task. Params: { "taskId"?: string, "taskTitle"?: string, "durationMinutes"?: number (default 25) }
- "I_AM_STUCK": Use when user feels stuck, paralyzed, or overwhelmed and needs the unstick flow. Params: { "reason"?: string }
- "CREATE_TASK": Use when user asks to capture or add a new task. Params: { "title": string, "notes"?: string, "plannedMinutes"?: number, "isToday"?: boolean }

If no action is needed, set "action": null.
Return ONLY valid JSON matching this schema.`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: formattedContents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const rawText = response.text ?? '';
    let parsed: { message?: string; action?: any } = {};

    try {
      parsed = JSON.parse(rawText);
    } catch {
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(clean);
      } catch {
        parsed = { message: rawText };
      }
    }

    const message = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : 'I am right here with you! Let us take it one small step at a time.';

    // Persist user prompt & assistant reply when authenticated
    if (req.user?.id) {
      const latestUserMessage = [...messages]
        .reverse()
        .find((m: { role?: string; content?: unknown }) => m.role === 'user');
      const docsToInsert: Array<{
        userId: string;
        role: 'user' | 'assistant';
        content: string;
        action?: { type: string; label?: string; executed?: boolean; data?: Record<string, unknown> };
      }> = [];

      if (latestUserMessage && typeof latestUserMessage.content === 'string' && latestUserMessage.content.trim()) {
        docsToInsert.push({
          userId: req.user.id,
          role: 'user',
          content: latestUserMessage.content.trim(),
        });
      }

      docsToInsert.push({
        userId: req.user.id,
        role: 'assistant',
        content: message,
        action: parsed.action
          ? {
              type: String(parsed.action.type || ''),
              executed: true,
              data: parsed.action,
            }
          : undefined,
      });

      if (isDatabaseConnected()) {
        ChatMessage.insertMany(docsToInsert).catch(err => {
          console.warn('Chat history persistence warning:', err);
        });
      } else {
        localStore.appendChatMessages(docsToInsert);
      }
    }

    res.json({
      message,
      action: parsed.action || null,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
};
