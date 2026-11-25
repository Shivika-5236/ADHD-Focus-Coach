import { useEffect, useState, useRef } from 'react';
import { useTaskContext } from '../context/TaskContext';

export interface ShortcutHUD {
  label: string;
  sub?: string;
  icon?: string;
}

interface UseGlobalShortcutsProps {
  onOpenQuickCapture: () => void;
  onToggleChat?: () => void;
  onSwitchTab?: (tab: any) => void;
}

export function useGlobalShortcuts({
  onOpenQuickCapture,
  onToggleChat,
  onSwitchTab,
}: UseGlobalShortcutsProps) {
  const {
    tasks,
    activeTaskId,
    activeTask,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeActiveTask,
    triggerStalled,
  } = useTaskContext();

  const [hud, setHud] = useState<ShortcutHUD | null>(null);
  const timerRef = useRef<any>(null);

  const showHud = (label: string, sub?: string, icon?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHud({ label, sub, icon });
    timerRef.current = setTimeout(() => {
      setHud(null);
    }, 1800);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = e.key.toLowerCase();

      // ⌘ K / Ctrl+K: Quick Capture
      if (key === 'k') {
        e.preventDefault();
        onOpenQuickCapture();
        showHud('Quick Capture', '⌘ K', '⚡');
        return;
      }

      // ⌘ / / Ctrl+/: Toggle AI Coach Chat
      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        onToggleChat?.();
        showHud('Focus Coach Chat', '⌘ /', '🤖');
        return;
      }

      // ⌘ 1 / Ctrl+1: Start Focus / Resume
      if (e.key === '1') {
        e.preventDefault();
        if (activeTask && activeTask.state === 'PAUSED') {
          resumeFocusSession();
          showHud('Focus Resumed', activeTask.title, '▶️');
        } else if (activeTask && activeTask.state === 'FOCUSING') {
          showHud('Focus in Progress', activeTask.title, '🟢');
          onSwitchTab?.('focus');
        } else if (activeTask) {
          startFocusSession(activeTask.id);
          onSwitchTab?.('focus');
          showHud('Started Focus', activeTask.title, '▶️');
        } else {
          // Start next prioritized task for today
          const nextTask =
            tasks.find(t => t.isToday && t.state === 'READY_TO_START') ||
            tasks.find(t => t.isToday && t.state === 'PLANNED') ||
            tasks.find(t => t.isToday && t.state !== 'COMPLETED');
          if (nextTask) {
            startFocusSession(nextTask.id);
            onSwitchTab?.('focus');
            showHud('Started Focus', nextTask.title, '▶️');
          } else {
            onOpenQuickCapture();
            showHud('Capture a Task First', 'No active tasks for today', '📋');
          }
        }
        return;
      }

      // ⌘ 2 / Ctrl+2: Pause / Resume
      if (e.key === '2') {
        e.preventDefault();
        if (activeTask && activeTask.state === 'FOCUSING') {
          pauseFocusSession();
          showHud('Focus Paused', 'Take a breath', '⏸️');
        } else if (activeTask && activeTask.state === 'PAUSED') {
          resumeFocusSession();
          showHud('Focus Resumed', 'Back into focus', '▶️');
        } else {
          showHud('No active session', 'Press ⌘ 1 to start focus', 'ℹ️');
        }
        return;
      }

      // ⌘ 3 / Ctrl+3: Complete Active Task
      if (e.key === '3') {
        e.preventDefault();
        if (activeTaskId) {
          completeActiveTask();
          showHud('Task Completed! 🎉', activeTask?.title || '', '✅');
        } else {
          showHud('No active task to complete', 'Press ⌘ 1 to start focus', 'ℹ️');
        }
        return;
      }

      // ⌘ 4 / Ctrl+4: I'm Stuck Recovery
      if (e.key === '4') {
        e.preventDefault();
        if (activeTaskId) {
          triggerStalled('Triggered via keyboard hotkey ⌘4');
          showHud("I'm Stuck Helper Opened", 'Finding a 2-minute micromove', '🆘');
        } else {
          showHud('Start a focus session first', 'Press ⌘ 1', 'ℹ️');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    tasks,
    activeTaskId,
    activeTask,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeActiveTask,
    triggerStalled,
    onOpenQuickCapture,
    onToggleChat,
    onSwitchTab,
  ]);

  return { hud };
}

