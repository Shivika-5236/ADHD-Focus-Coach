import React, { useState } from 'react';
import {
  Calendar,
  CheckSquare,
  FolderKanban,
  PlayCircle,
  BarChart2,
  Users,
  Settings,
  Database,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

export type NavTab = 'today' | 'tasks' | 'projects' | 'focus' | 'insights' | 'shared' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  onOpenQuickCapture?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { user, isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <Calendar size={18} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={18} /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban size={18} /> },
    { id: 'focus', label: 'Focus', icon: <PlayCircle size={18} /> },
    { id: 'insights', label: 'Insights', icon: <BarChart2 size={18} /> },
    { id: 'shared', label: 'Shared', icon: <Users size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    setIsMobileNavOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar (visible <= 768px) */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-on-primary)',
            }}
          >
            <PlayCircle size={16} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            FocusCoach
          </span>
        </div>

        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setIsMobileNavOpen(prev => !prev)}
          aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileNavOpen}
        >
          {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`mobile-nav-backdrop ${isMobileNavOpen ? 'open' : ''}`}
        onClick={() => setIsMobileNavOpen(false)}
      />

      <aside className={`sidebar-container ${isMobileNavOpen ? 'open' : ''}`} id="app-sidebar">
        {/* Top Logo & Navigation */}
        <div>
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-2) var(--space-6)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-on-primary)',
                boxShadow: 'var(--shadow-subtle)',
                flexShrink: 0,
              }}
            >
              <PlayCircle size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                FocusCoach
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Database size={10} /> MERN Powered
              </span>
            </div>
          </div>

          {/* Clean Nav List */}
          <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {navItems.map(item => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  className={`nav-item-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span style={{ color: isActive ? 'var(--primary-text)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile */}
        <button
          type="button"
          id="sidebar-user-profile"
          onClick={() => {
            setIsAuthModalOpen(true);
            setIsMobileNavOpen(false);
          }}
          className="nav-item-btn"
          style={{
            padding: 'var(--space-3) var(--space-2)',
            borderTop: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--space-4)',
          }}
          title="Manage Account"
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: isAuthenticated ? 'var(--color-success)' : 'var(--color-primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              flexShrink: 0,
            }}
          >
            {user ? user.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user ? user.name : 'Sign In / Account'}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: isAuthenticated ? 'var(--success-text)' : 'var(--text-muted)' }}>
              {isAuthenticated ? 'MongoDB Connected' : 'Local / Guest'}
            </span>
          </div>
        </button>
      </aside>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
