import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider, useTaskContext } from './context/TaskContext';
import { Sidebar, type NavTab } from './components/Sidebar';
import { TodayDashboard } from './components/TodayDashboard';
import { TodayFocus } from './components/TodayFocus';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { ProjectMap } from './components/ProjectMap';
import { WorkInsights } from './components/WorkInsights';
import { SharedFocusModal } from './components/SharedFocusModal';
import { FocusSessionDashboard } from './components/FocusSessionDashboard';
import { SettingsPage } from './components/SettingsPage';
import { FocusCoachChat } from './components/FocusCoachChat';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { Bot } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('focus');
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { selectedDrawerTaskId, openTaskDrawer } = useTaskContext();

  const { hud } = useGlobalShortcuts({
    onOpenQuickCapture: () => setIsQuickCaptureOpen(prev => !prev),
    onToggleChat: () => setIsChatOpen(prev => !prev),
    onSwitchTab: tab => setCurrentTab(tab as NavTab),
  });

  return (
    <div className="layout-wrapper relative">
      {/* Global Keyboard Shortcut Feedback HUD */}
      {hud && (
        <div className="global-shortcut-hud" role="status">
          <span className="global-shortcut-hud-icon">{hud.icon}</span>
          <div className="global-shortcut-hud-text">
            <strong>{hud.label}</strong>
            {hud.sub && <span>{hud.sub}</span>}
          </div>
        </div>
      )}

      {/* Sidebar with Navigation and Account State */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Main Content Area */}
      <main className="main-content-container">
        {currentTab === 'today' && (
          <TodayDashboard
            onOpenTaskDetail={id => openTaskDrawer(id)}
            onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
            onStartFocus={() => setCurrentTab('focus')}
          />
        )}

        {currentTab === 'tasks' && (
          <TodayFocus
            onOpenTaskDetail={id => openTaskDrawer(id)}
            onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
            onStartFocus={() => setCurrentTab('focus')}
          />
        )}

        {currentTab === 'projects' && (
          <ProjectMap onOpenTaskDetail={id => openTaskDrawer(id)} />
        )}

        {currentTab === 'focus' && (
          <FocusSessionDashboard />
        )}

        {currentTab === 'insights' && (
          <WorkInsights />
        )}

        {currentTab === 'shared' && (
          <SharedFocusModal />
        )}

        {currentTab === 'settings' && (
          <SettingsPage />
        )}
      </main>

      {/* Quick Task Capture Modal */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onTaskCreated={id => openTaskDrawer(id)}
      />

      {/* Task Inspection & Step Drawer */}
      <TaskDetailDrawer
        taskId={selectedDrawerTaskId}
        onClose={() => openTaskDrawer(null)}
        onStartFocus={() => setCurrentTab('focus')}
      />

      {/* AI Chatbot Floating Button & Panel */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="floating-coach-btn"
          aria-label="Open Focus Coach"
          title="AI Focus Coach"
        >
          <Bot size={22} />
        </button>
      )}
      <FocusCoachChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <TaskProvider>
        <MainLayout />
      </TaskProvider>
    </AuthProvider>
  );
};

export default App;
