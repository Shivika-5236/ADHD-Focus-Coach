import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

interface BreakdownStep {
  title: string;
  estimatedMinutes: number;
  isCurrent: boolean;
}

interface BreakdownResponse {
  steps: BreakdownStep[];
  suggestedPlannedMinutes?: number;
}

export const breakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, notes, plannedMinutes, priority, projectName } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Task title is required' });
      return;
    }

    const targetMinutes = typeof plannedMinutes === 'number' && plannedMinutes > 0
      ? plannedMinutes
      : 25;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an ADHD-friendly productivity coach. Your job is to break tasks into 3–5 concrete, actionable micro-steps that feel achievable and reduce overwhelm.

Rules you MUST follow:
1. Step 1 MUST be a "starter action" — something that takes ≤2 minutes, requires zero preparation, and has zero resistance (e.g. "Open a blank doc", "Set a timer for 10 minutes", "Write the task title at the top of a page").
2. All steps combined should roughly sum to the target minutes provided.
3. Steps must be specific, concrete, and kind in tone — no vague instructions like "work on it" or "research".
4. Each step title should be a short imperative sentence (5–12 words max).
5. Return ONLY valid JSON matching the schema. No markdown, no explanation.

Schema:
{
  "steps": [
    { "title": string, "estimatedMinutes": number, "isCurrent": boolean }
  ],
  "suggestedPlannedMinutes": number  // only include if the target seems off; omit otherwise
}

The first step must have "isCurrent": true. All others must have "isCurrent": false.`;

    const contextParts: string[] = [`Task: "${title}"`];
    if (projectName) contextParts.push(`Project: ${projectName}`);
    if (priority) contextParts.push(`Priority: ${priority}`);
    contextParts.push(`Target time: ${targetMinutes} minutes`);
    if (notes && notes.trim()) contextParts.push(`Notes: ${notes.trim()}`);

    const userPrompt = `${contextParts.join('\n')}\n\nBreak this task into 3–5 ADHD-friendly micro-steps. Step 1 must be a ≤2 minute zero-resistance starter action. Steps should sum to roughly ${targetMinutes} minutes total.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text ?? '';

    let parsed: BreakdownResponse;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('AI breakdown: failed to parse JSON response:', rawText);
      res.status(500).json({ error: 'AI returned an unexpected format. Please retry.' });
      return;
    }

    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      res.status(500).json({ error: 'AI returned no steps. Please retry.' });
      return;
    }

    // Sanitise steps — ensure types are correct and isCurrent is only on index 0
    const steps: BreakdownStep[] = parsed.steps.map((s, idx) => ({
      title: String(s.title ?? '').trim() || `Step ${idx + 1}`,
      estimatedMinutes: typeof s.estimatedMinutes === 'number' && s.estimatedMinutes > 0
        ? Math.round(s.estimatedMinutes)
        : 5,
      isCurrent: idx === 0,
    }));

    const result: BreakdownResponse = { steps };
    if (typeof parsed.suggestedPlannedMinutes === 'number' && parsed.suggestedPlannedMinutes > 0) {
      result.suggestedPlannedMinutes = Math.round(parsed.suggestedPlannedMinutes);
    }

    res.json(result);
  } catch (error) {
    console.error('AI breakdown error:', error);
    res.status(500).json({ error: 'Could not reach step generation assistant. Please retry.' });
  }
};

// POST /api/v1/ai/unstick
// Body: { taskTitle, currentStepTitle?, elapsedMinutes, stuckReason? }
// Returns: { micromove: string }
export const unstick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskTitle, currentStepTitle, elapsedMinutes, stuckReason } = req.body;

    if (!taskTitle || typeof taskTitle !== 'string') {
      res.status(400).json({ error: 'Task title is required' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an ADHD-aware productivity coach helping someone who feels stuck on a task.
Your job is to generate exactly one tiny, concrete, 2-minute "micromove" that removes the specific friction they're feeling.

Rules:
1. The micromove must be completable in 2 minutes or less — no exceptions.
2. It must directly address WHY they are stuck (use the stuckReason if provided).
3. Be warm, non-judgmental, and specific. Never say "just" or "simply".
4. Use an action verb to start: Open, Write, Read, Set, List, Circle, Say, Pick, Sketch.
5. Return ONLY valid JSON: { "micromove": string }. No markdown, no explanation, no extra keys.

Examples by reason:
- "Too big" → "Open a blank doc and write only the title of this task at the top."
- "Unclear" → "Write 2–3 bullet points of what you *do* know about this task right now."
- "Perfectionism" → "Set a timer for 90 seconds and write the worst possible first sentence — intentionally bad."
- "Low energy" → "Stand up, take 3 slow breaths, then read back the last sentence you wrote."`;

    const contextLines: string[] = [`Task: "${taskTitle}"`];
    if (currentStepTitle) contextLines.push(`Current step they're stuck on: "${currentStepTitle}"`);
    if (typeof elapsedMinutes === 'number' && elapsedMinutes > 0) {
      contextLines.push(`Time spent so far: ${elapsedMinutes} minutes`);
    }
    if (stuckReason) contextLines.push(`Why they feel stuck: ${stuckReason}`);

    const userPrompt = `${contextLines.join('\n')}\n\nGenerate a single 2-minute micromove to get them unstuck. Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text ?? '';
    let parsed: { micromove?: string };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('AI unstick: failed to parse JSON:', rawText);
      res.status(500).json({ error: 'AI returned an unexpected format. Please retry.' });
      return;
    }

    const micromove = typeof parsed.micromove === 'string' && parsed.micromove.trim()
      ? parsed.micromove.trim()
      : 'Take 2 minutes to write just one sentence about where you are on this task.';

    res.json({ micromove });
  } catch (error) {
    console.error('AI unstick error:', error);
    res.status(500).json({ error: 'Could not reach the unstick assistant. Please retry.' });
  }
};

interface BrainDumpResponse {
  title: string;
  notes: string;
  priority: 'low' | 'medium' | 'high';
  plannedMinutes: number;
  isToday: boolean;
  suggestedProjectId?: string;
  steps: BreakdownStep[];
}

// POST /api/v1/ai/parse-brain-dump
// Body: { rawText: string, projects?: { id: string; name: string }[] }
// Returns: BrainDumpResponse
export const parseBrainDump = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText, projects } = req.body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      res.status(400).json({ error: 'Please enter a thought or brain dump to parse.' });
      return;
    }

    const validProjects: { id: string; name: string }[] = Array.isArray(projects)
      ? projects
          .filter(
            (p): p is { id: string; name: string } =>
              Boolean(p && typeof p.id === 'string' && typeof p.name === 'string')
          )
          .slice(0, 30)
      : [];

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an ADHD-friendly executive function assistant that turns messy, unstructured brain dumps into a single clean, actionable, auto-scaffolded task.

Rules you MUST follow:
1. "title": Extract one crisp, clear, action-oriented task title (imperative verb first, 4–12 words max). Remove overwhelm filler words ("ugh", "I really need to", "don't forget").
2. "notes": Organize any useful context, details, deadlines, people, links, or reminders from the dump into brief, calm notes (1–3 short sentences or bullet points). Use "" if there are no extra details beyond the title.
3. "priority": Choose strictly "low", "medium", or "high" based on urgency, deadlines, or impact cues. Default to "medium" if unclear.
4. "plannedMinutes": Estimate realistic focus time in minutes (integer between 5 and 180, preferably a multiple of 5 such as 10, 15, 20, 25, 30, 45, 60). If the user mentions a duration, respect it; otherwise default to a realistic ADHD-friendly chunk (15–30 minutes).
5. "isToday": Boolean. Set to false ONLY if the dump clearly defers the task ("next week", "someday", "later this month", "not today"). Otherwise true.
6. "suggestedProjectId": If a list of user projects is provided AND the brain dump clearly matches one of them, return that exact project "id". Otherwise return null. Never invent an id.
7. "steps": Provide 2–4 concrete, bite-sized starter micro-steps so the user can begin immediately without paralysis.
   - Step 1 MUST be a zero-resistance starter action taking ≤2 minutes (e.g., "Open the Q3 spreadsheet and save a copy").
   - Step 1 must have "isCurrent": true; all other steps must have "isCurrent": false.
   - Step estimates should roughly align with plannedMinutes.
8. Return ONLY valid JSON matching the exact schema below. No markdown, no commentary.

Schema:
{
  "title": string,
  "notes": string,
  "priority": "low" | "medium" | "high",
  "plannedMinutes": number,
  "isToday": boolean,
  "suggestedProjectId": string | null,
  "steps": [
    { "title": string, "estimatedMinutes": number, "isCurrent": boolean }
  ]
}`;

    const projectContext =
      validProjects.length > 0
        ? `\nAvailable user projects:\n${validProjects.map(p => `- id: "${p.id}", name: "${p.name}"`).join('\n')}`
        : '';

    const userPrompt = `Raw brain dump:\n"""\n${rawText.trim()}\n"""${projectContext}\n\nParse and scaffold this brain dump into a clean ADHD-friendly task. Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawResponseText = response.text ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawResponseText);
    } catch {
      const cleaned = rawResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('AI parseBrainDump: failed to parse JSON:', rawResponseText);
        res.status(500).json({ error: 'AI returned an unexpected format. Please retry.' });
        return;
      }
    }

    const fallbackTitle = rawText.trim().split(/[\n.!?]/)[0].trim().slice(0, 80) || 'New Task';
    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : fallbackTitle;

    const notes = typeof parsed.notes === 'string' ? parsed.notes.trim() : '';

    const rawPriority = typeof parsed.priority === 'string' ? parsed.priority.toLowerCase().trim() : '';
    const priority: 'low' | 'medium' | 'high' =
      rawPriority === 'low' || rawPriority === 'medium' || rawPriority === 'high'
        ? rawPriority
        : 'medium';

    const rawMinutes = typeof parsed.plannedMinutes === 'number' ? parsed.plannedMinutes : Number(parsed.plannedMinutes);
    const plannedMinutes =
      Number.isFinite(rawMinutes) && rawMinutes > 0
        ? Math.min(180, Math.max(5, Math.round(rawMinutes)))
        : 20;

    const isToday = typeof parsed.isToday === 'boolean' ? parsed.isToday : true;

    const validProjectIds = new Set(validProjects.map(p => p.id));
    const suggestedProjectId =
      typeof parsed.suggestedProjectId === 'string' && validProjectIds.has(parsed.suggestedProjectId)
        ? parsed.suggestedProjectId
        : undefined;

    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: BreakdownStep[] = rawSteps
      .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
      .slice(0, 5)
      .map((s, idx) => {
        const est = typeof s.estimatedMinutes === 'number' ? s.estimatedMinutes : Number(s.estimatedMinutes);
        return {
          title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${idx + 1}`,
          estimatedMinutes: Number.isFinite(est) && est > 0 ? Math.min(60, Math.max(1, Math.round(est))) : idx === 0 ? 2 : 5,
          isCurrent: idx === 0,
        };
      });

    const result: BrainDumpResponse = {
      title,
      notes,
      priority,
      plannedMinutes,
      isToday,
      steps,
    };

    if (suggestedProjectId) {
      result.suggestedProjectId = suggestedProjectId;
    }

    res.json(result);
  } catch (error) {
    console.error('AI parseBrainDump error:', error);
    res.status(500).json({ error: 'Could not reach the AI parser. Please retry.' });
  }
};

interface InsightsDigestResponse {
  headline: string;
  strengths: string[];
  watchOuts: string[];
  nextExperiment: string;
}

// POST /api/v1/ai/insights-digest
// Body: aggregated productivity insights, recent sessions, and stalled task signals
// Returns: InsightsDigestResponse
export const insightsDigest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      totalFocusMinutes = 0,
      completedTasksCount = 0,
      totalTasksCount = 0,
      completionRate = 0,
      streakDays = 0,
      averageAccuracyRate = 0,
      recoverySuccessCount = 0,
      avgSessionDuration = 0,
      timeOfDayMinutes = { morning: 0, afternoon: 0, evening: 0 },
      dailyHistory = [],
      recentSessions = [],
      stalledTasks = [],
    } = req.body ?? {};

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an empathetic, insightful ADHD executive-function coach reviewing a user's focus analytics dashboard.
Your job is to translate their raw numbers into warm, plain-English self-awareness and practical coaching advice.

Rules you MUST follow:
1. "headline": Write 1 crisp, plain-English pattern summary (max 24 words) that translates the data into a real takeaway (e.g., "You focus best in 25m morning blocks, while afternoon tasks tend to lose steam."). Do NOT just recite numbers mechanically.
2. "strengths": 1–2 concise, specific observations (each ≤18 words) about what is working well (peak time of day, session sizing, streak momentum, recovery wins, step completion).
3. "watchOuts": 1–2 gentle, non-judgmental observations (each ≤18 words) about friction patterns (e.g., time-blindness when actual vs planned differs, unfinished sessions, low-energy time windows, or stalled tasks). Never shame or lecture.
4. "nextExperiment": 1 concrete, low-friction ADHD-friendly experiment to try next (≤22 words, e.g., "Schedule your hardest task in a 20m morning block and save quick admin for afternoons.").
5. If the user has little or no recorded data yet (e.g., 0 focus minutes and 0 sessions), acknowledge warmly that they are building their baseline and give encouraging, practical starter insights rather than making up fake history.
6. Return ONLY valid JSON matching the exact schema below. No markdown, no commentary.

Schema:
{
  "headline": string,
  "strengths": string[],
  "watchOuts": string[],
  "nextExperiment": string
}`;

    const safeDaily = Array.isArray(dailyHistory)
      ? dailyHistory.slice(-7).map((d: any) => ({
          day: String(d?.dayLabel ?? ''),
          focusMinutes: Number(d?.focusMinutes ?? 0),
          tasksDone: Number(d?.tasksDone ?? 0),
        }))
      : [];

    const safeSessions = Array.isArray(recentSessions)
      ? recentSessions.slice(0, 10).map((s: any) => ({
          task: String(s?.taskTitle ?? '').slice(0, 80),
          spentMin: Number(s?.durationMinutes ?? 0),
          plannedMin: Number(s?.plannedMinutes ?? 0),
          completed: Boolean(s?.completed),
          steps: `${Number(s?.completedStepsCount ?? 0)}/${Number(s?.totalStepsCount ?? 0)}`,
          startedHour: s?.startedAt ? new Date(s.startedAt).getHours() : undefined,
        }))
      : [];

    const safeStalled = Array.isArray(stalledTasks)
      ? stalledTasks.slice(0, 5).map((t: any) => ({
          title: String(t?.title ?? '').slice(0, 80),
          reason: typeof t?.lastStalledReason === 'string' ? t.lastStalledReason.slice(0, 120) : undefined,
        }))
      : [];

    const summaryPayload = {
      totalFocusMinutes: Number(totalFocusMinutes) || 0,
      completedTasksCount: Number(completedTasksCount) || 0,
      totalTasksCount: Number(totalTasksCount) || 0,
      completionRatePct: Number(completionRate) || 0,
      streakDays: Number(streakDays) || 0,
      averageAccuracyRate: Number(averageAccuracyRate) || 0,
      recoverySuccessCount: Number(recoverySuccessCount) || 0,
      avgSessionDurationMinutes: Number(avgSessionDuration) || 0,
      timeOfDayMinutes: {
        morning: Number(timeOfDayMinutes?.morning) || 0,
        afternoon: Number(timeOfDayMinutes?.afternoon) || 0,
        evening: Number(timeOfDayMinutes?.evening) || 0,
      },
      last7Days: safeDaily,
      recentSessions: safeSessions,
      stalledTasks: safeStalled,
    };

    const userPrompt = `Here is the user's current ADHD Focus Coach analytics snapshot:\n${JSON.stringify(summaryPayload, null, 2)}\n\nGenerate a plain-English AI coaching digest and pattern summary. Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawResponseText = response.text ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawResponseText);
    } catch {
      const cleaned = rawResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('AI insightsDigest: failed to parse JSON:', rawResponseText);
        res.status(500).json({ error: 'AI returned an unexpected format. Please retry.' });
        return;
      }
    }

    const toStringList = (val: unknown, fallback: string[]): string[] => {
      if (!Array.isArray(val)) return fallback;
      const cleaned = val
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 3);
      return cleaned.length > 0 ? cleaned : fallback;
    };

    const headline =
      typeof parsed.headline === 'string' && parsed.headline.trim()
        ? parsed.headline.trim()
        : 'You are building momentum—short, structured focus blocks are your strongest lever.';

    const strengths = toStringList(parsed.strengths, [
      'Showing up to review your patterns builds real executive-function awareness.',
    ]);

    const watchOuts = toStringList(parsed.watchOuts, [
      'Log a few more timed focus blocks so we can spot your best energy windows.',
    ]);

    const nextExperiment =
      typeof parsed.nextExperiment === 'string' && parsed.nextExperiment.trim()
        ? parsed.nextExperiment.trim()
        : 'Try one 20-minute morning focus block on your most important task tomorrow.';

    const result: InsightsDigestResponse = {
      headline,
      strengths,
      watchOuts,
      nextExperiment,
    };

    res.json(result);
  } catch (error) {
    console.error('AI insightsDigest error:', error);
    res.status(500).json({ error: 'Could not reach the coaching digest assistant. Please retry.' });
  }
};

interface DecomposedTaskDraft {
  title: string;
  notes: string;
  plannedMinutes: number;
  priority: 'low' | 'medium' | 'high';
  steps: BreakdownStep[];
}

// POST /api/v1/ai/decompose-milestone
// Body: { projectName, projectDescription?, milestoneTitle, milestoneOrder?, existingTaskTitles?: string[] }
// Returns: { tasks: DecomposedTaskDraft[] }
export const decomposeMilestone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, projectDescription, milestoneTitle, milestoneOrder, existingTaskTitles } = req.body ?? {};

    if (!milestoneTitle || typeof milestoneTitle !== 'string' || !milestoneTitle.trim()) {
      res.status(400).json({ error: 'Milestone title is required' });
      return;
    }

    const existingTitles: string[] = Array.isArray(existingTaskTitles)
      ? existingTaskTitles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 20)
      : [];

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an ADHD-friendly project coach. Your job is to decompose a single project milestone into 2–4 concrete, bite-sized, actionable focus tasks that eliminate overwhelm and make starting effortless.

Rules you MUST follow:
1. Generate 2 to 4 concrete tasks scoped strictly to the given milestone. Do NOT duplicate any existing tasks listed.
2. Task 1 should be the lowest-friction entry task to kickstart momentum on this milestone.
3. Each task MUST have:
   - "title": Clear, imperative action title (4–12 words max).
   - "notes": Brief helpful context or definition of done (1 short sentence, or "").
   - "plannedMinutes": Realistic ADHD-friendly focus block (integer 10–45, multiple of 5).
   - "priority": "low" | "medium" | "high".
   - "steps": 2–3 tiny micro-steps where step 1 takes ≤2 minutes and has "isCurrent": true (others false).
4. Return ONLY valid JSON matching the exact schema below. No markdown, no commentary.

Schema:
{
  "tasks": [
    {
      "title": string,
      "notes": string,
      "plannedMinutes": number,
      "priority": "low" | "medium" | "high",
      "steps": [
        { "title": string, "estimatedMinutes": number, "isCurrent": boolean }
      ]
    }
  ]
}`;

    const contextLines: string[] = [];
    if (projectName && typeof projectName === 'string' && projectName.trim()) {
      contextLines.push(`Project: "${projectName.trim()}"`);
    }
    if (projectDescription && typeof projectDescription === 'string' && projectDescription.trim()) {
      contextLines.push(`Project Goal: ${projectDescription.trim()}`);
    }
    contextLines.push(
      `Milestone${typeof milestoneOrder === 'number' ? ` (Stage ${milestoneOrder})` : ''}: "${milestoneTitle.trim()}"`
    );
    if (existingTitles.length > 0) {
      contextLines.push(`Already linked tasks (do NOT repeat these): ${existingTitles.map(t => `"${t}"`).join(', ')}`);
    }

    const userPrompt = `${contextLines.join('\n')}\n\nBreak this milestone into 2–4 concrete ADHD-friendly focus tasks with tiny starter steps. Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text ?? '';
    let parsed: { tasks?: unknown };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('AI decomposeMilestone: failed to parse JSON:', rawText);
        res.status(500).json({ error: 'AI returned an unexpected format. Please retry.' });
        return;
      }
    }

    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      res.status(500).json({ error: 'AI returned no tasks for this milestone. Please retry.' });
      return;
    }

    const tasks: DecomposedTaskDraft[] = parsed.tasks
      .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
      .slice(0, 4)
      .map((t, idx) => {
        const rawPriority = typeof t.priority === 'string' ? t.priority.toLowerCase().trim() : '';
        const priority: 'low' | 'medium' | 'high' =
          rawPriority === 'low' || rawPriority === 'medium' || rawPriority === 'high' ? rawPriority : 'medium';

        const rawMins = typeof t.plannedMinutes === 'number' ? t.plannedMinutes : Number(t.plannedMinutes);
        const plannedMinutes =
          Number.isFinite(rawMins) && rawMins > 0 ? Math.min(90, Math.max(10, Math.round(rawMins))) : 20;

        const rawSteps = Array.isArray(t.steps) ? t.steps : [];
        const steps: BreakdownStep[] = rawSteps
          .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
          .slice(0, 4)
          .map((s, sIdx) => {
            const est = typeof s.estimatedMinutes === 'number' ? s.estimatedMinutes : Number(s.estimatedMinutes);
            return {
              title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${sIdx + 1}`,
              estimatedMinutes: Number.isFinite(est) && est > 0 ? Math.min(30, Math.max(1, Math.round(est))) : sIdx === 0 ? 2 : 5,
              isCurrent: sIdx === 0,
            };
          });

        return {
          title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : `${milestoneTitle.trim()} — Task ${idx + 1}`,
          notes: typeof t.notes === 'string' ? t.notes.trim() : '',
          plannedMinutes,
          priority,
          steps,
        };
      });

    res.json({ tasks });
  } catch (error) {
    console.error('AI decomposeMilestone error:', error);
    res.status(500).json({ error: 'Could not decompose this milestone right now. Please retry.' });
  }
};

// POST /api/v1/ai/decompose-project
// Body: { projectName, projectDescription?, existingMilestones?: string[] }
// Returns: { milestones: { title: string }[] }
export const decomposeProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, projectDescription, existingMilestones } = req.body ?? {};

    if (!projectName || typeof projectName !== 'string' || !projectName.trim()) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const existingList: string[] = Array.isArray(existingMilestones)
      ? existingMilestones.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).slice(0, 15)
      : [];

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an ADHD-friendly project architect. Your job is to break a project into 3–5 clear, sequential, jargon-free milestones that build momentum from a low-friction start to finish.

Rules you MUST follow:
1. Return 3 to 5 sequential milestones tailored specifically to the project's name and goal (NOT generic labels like "Discovery & Setup" or "Execution Core").
2. Each milestone title should be concise and concrete (3–8 words).
3. Milestone 1 should feel approachable and easy to start.
4. Return ONLY valid JSON matching this exact schema:
{
  "milestones": [
    { "title": string }
  ]
}`;

    const contextLines: string[] = [`Project Name: "${projectName.trim()}"`];
    if (projectDescription && typeof projectDescription === 'string' && projectDescription.trim()) {
      contextLines.push(`Description / Goal: ${projectDescription.trim()}`);
    }
    if (existingList.length > 0) {
      contextLines.push(`Current milestones: ${existingList.map(m => `"${m}"`).join(', ')}`);
    }

    const userPrompt = `${contextLines.join('\n')}\n\nGenerate 3–5 sequential, concrete milestones specifically tailored to this project. Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text ?? '';
    let parsed: { milestones?: unknown };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('AI decomposeProject: failed to parse JSON:', rawText);
        res.status(500).json({ error: 'AI returned an unexpected format. Please retry.' });
        return;
      }
    }

    if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
      res.status(500).json({ error: 'AI returned no milestones. Please retry.' });
      return;
    }

    const milestones = parsed.milestones
      .map(m => {
        if (typeof m === 'string') return { title: m.trim() };
        if (m && typeof m === 'object' && typeof (m as Record<string, unknown>).title === 'string') {
          return { title: String((m as Record<string, unknown>).title).trim() };
        }
        return { title: '' };
      })
      .filter(m => m.title.length > 0)
      .slice(0, 5);

    if (milestones.length === 0) {
      res.status(500).json({ error: 'AI returned no valid milestones. Please retry.' });
      return;
    }

    res.json({ milestones });
  } catch (error) {
    console.error('AI decomposeProject error:', error);
    res.status(500).json({ error: 'Could not decompose this project right now. Please retry.' });
  }
};

