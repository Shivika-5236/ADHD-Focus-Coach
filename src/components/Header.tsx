import React, { useState } from 'react';
import { Sparkles, Plus, Volume2, VolumeX, BarChart3, Map, CheckCircle2, Users, RotateCcw, User as UserIcon, Database } from 'lucide-react';
import { soundEngine } from '../utils/audioSynthesizer';
import type { SoundscapeType } from '../utils/audioSynthesizer';
import { useTaskContext } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  currentTab: 'today' | 'projects' | 'insights' | 'shared';
  setCurrentTab: (tab: 'today' | 'projects' | 'insights' | 'shared') => void;
  onOpenQuickCapture: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, onOpenQuickCapture }) => {
  const { isSharedSessionActive, resetToDefaults } = useTaskContext();
  const { user, isAuthenticated } = useAuth();
  const [soundscape, setSoundscape] = useState<SoundscapeType>('none');
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleSoundSelect = (type: SoundscapeType) => {
    setSoundscape(type);
    soundEngine.playSoundscape(type);
    setShowSoundMenu(false);
  };

  return (
    <>
      <header className="app-header glass-panel" style={{ marginBottom: '24px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-on-primary)',
                boxShadow: 'var(--shadow-subtle)',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ADHD Focus Coach
                <span style={{ fontSize: '0.65rem', background: 'var(--primary-subtle)', color: 'var(--primary-text)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={10} /> MERN + Atlas
                </span>
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Low cognitive friction · One thing at a time</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              id="nav-tab-today"
              className={`btn btn-ghost ${currentTab === 'today' ? 'tab-active' : ''}`}
              onClick={() => setCurrentTab('today')}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: currentTab === 'today' ? 'var(--color-primary)' : 'transparent',
                color: currentTab === 'today' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                boxShadow: currentTab === 'today' ? 'var(--shadow-subtle)' : 'none',
              }}
            >
              <CheckCircle2 size={16} /> Today's Focus
            </button>
            <button
              id="nav-tab-projects"
              className={`btn btn-ghost ${currentTab === 'projects' ? 'tab-active' : ''}`}
              onClick={() => setCurrentTab('projects')}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: currentTab === 'projects' ? 'var(--color-primary)' : 'transparent',
                color: currentTab === 'projects' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                boxShadow: currentTab === 'projects' ? 'var(--shadow-subtle)' : 'none',
              }}
            >
              <Map size={16} /> Project Map
            </button>
            <button
              id="nav-tab-insights"
              className={`btn btn-ghost ${currentTab === 'insights' ? 'tab-active' : ''}`}
              onClick={() => setCurrentTab('insights')}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: currentTab === 'insights' ? 'var(--color-primary)' : 'transparent',
                color: currentTab === 'insights' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                boxShadow: currentTab === 'insights' ? 'var(--shadow-subtle)' : 'none',
              }}
            >
              <BarChart3 size={16} /> Work Insights
            </button>
            <button
              id="nav-tab-shared"
              className={`btn btn-ghost ${currentTab === 'shared' ? 'tab-active' : ''}`}
              onClick={() => setCurrentTab('shared')}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: currentTab === 'shared' ? 'var(--color-primary)' : 'transparent',
                color: currentTab === 'shared' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                boxShadow: currentTab === 'shared' ? 'var(--shadow-subtle)' : 'none',
                position: 'relative',
              }}
            >
              <Users size={16} /> Shared Focus
              {isSharedSessionActive && (
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--color-success)',
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                  }}
                />
              )}
            </button>
          </nav>

          {/* Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Ambient Sound Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                id="soundscape-toggle-btn"
                className="btn btn-secondary"
                onClick={() => setShowSoundMenu(!showSoundMenu)}
                title="Calming Focus Soundscapes"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
              >
                {soundscape === 'none' ? <VolumeX size={16} /> : <Volume2 size={16} color="var(--color-primary)" />}
                <span>{soundscape === 'none' ? 'Ambient Off' : soundscape}</span>
              </button>

              {showSoundMenu && (
                <div
                  className="glass-panel animate-slide-up"
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: '200px',
                    zIndex: 200,
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 600 }}>
                    NATIVE SOUNDSCAPES
                  </div>
                  <button
                    id="sound-option-none"
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.82rem', padding: '6px 8px' }}
                    onClick={() => handleSoundSelect('none')}
                  >
                    Mute / Off
                  </button>
                  <button
                    id="sound-option-whitenoise"
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.82rem', padding: '6px 8px' }}
                    onClick={() => handleSoundSelect('whitenoise')}
                  >
                    🌊 Pink/White Noise
                  </button>
                  <button
                    id="sound-option-rain"
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.82rem', padding: '6px 8px' }}
                    onClick={() => handleSoundSelect('rain')}
                  >
                    🌧️ Gentle Rain
                  </button>
                  <button
                    id="sound-option-binaural40hz"
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.82rem', padding: '6px 8px' }}
                    onClick={() => handleSoundSelect('binaural40hz')}
                  >
                    🧠 40Hz Gamma Focus
                  </button>
                  <button
                    id="sound-option-cafe"
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.82rem', padding: '6px 8px' }}
                    onClick={() => handleSoundSelect('cafe')}
                  >
                    ☕ Cafe Warmth
                  </button>
                </div>
              )}
            </div>

            {/* User Account / Auth Modal Trigger */}
            <button
              id="auth-modal-btn"
              className="btn btn-secondary"
              onClick={() => setIsAuthModalOpen(true)}
              style={{
                padding: '8px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: isAuthenticated ? 'var(--success-border)' : undefined,
                background: isAuthenticated ? 'var(--success-subtle)' : undefined,
              }}
            >
              <UserIcon size={15} color={isAuthenticated ? 'var(--color-success)' : 'var(--text-secondary)'} />
              <span>{isAuthenticated && user ? user.name.split(' ')[0] : 'Account'}</span>
            </button>

            {/* Quick Capture Trigger */}
            <button
              id="header-quick-capture-btn"
              className="btn btn-primary"
              onClick={onOpenQuickCapture}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Quick Capture
            </button>

            {/* Reset Demo Data Button */}
            <button
              id="reset-demo-data-btn"
              className="btn btn-ghost"
              onClick={() => {
                if (window.confirm('Reset all tasks and data to default sample state?')) {
                  resetToDefaults();
                }
              }}
              title="Reset Data"
              style={{ padding: '8px', color: 'var(--text-muted)' }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
