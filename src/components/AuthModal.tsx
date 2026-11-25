import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { X, User as UserIcon, Mail, Lock, Sparkles, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, login, register, loginAsGuest, logout } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.health()
      .then((res) => {
        if (active) setDbStatus(res.database);
      })
      .catch(() => {
        if (active) setDbStatus(null);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!name.trim()) throw new Error('Please enter your name');
        await register(name, email, password);
        setSuccessMsg('Account created successfully!');
      } else {
        await login(email, password);
        setSuccessMsg('Logged in successfully!');
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginAsGuest();
      setSuccessMsg('Logged in as Guest Explorer!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Guest login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(27, 42, 74, 0.52)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '24px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-elevation)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="var(--text-on-primary)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {isAuthenticated ? 'Your Account' : isRegisterMode ? 'Create Account' : 'Welcome Back'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--alert-subtle)',
              border: '1px solid var(--color-alert)',
              color: 'var(--alert-text)',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '0.875rem',
            }}
          >
            <AlertCircle size={16} color="var(--color-alert)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: 'var(--success-subtle)',
              border: '1px solid var(--color-success)',
              color: 'var(--success-text)',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {isAuthenticated && user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: 'var(--text-on-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</p>
                </div>
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: dbStatus === 'disconnected' ? 'var(--accent-text)' : 'var(--success-text)',
                  background: dbStatus === 'disconnected' ? 'var(--accent-subtle)' : 'var(--success-subtle)',
                  border: dbStatus === 'disconnected' ? '1px solid var(--color-accent)' : '1px solid var(--color-success)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: dbStatus === 'disconnected' ? 'var(--color-accent)' : 'var(--color-success)',
                  }}
                />
                {dbStatus === 'disconnected'
                  ? 'Offline Local Mode (MongoDB Atlas Disconnected)'
                  : 'Connected to MongoDB Atlas Cloud'}
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="btn btn-danger"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                width: '100%',
              }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {dbStatus === 'disconnected' && !error && (
              <div
                style={{
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--accent-text)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                }}
              >
                MongoDB Atlas is unreachable — accounts created here are saved locally on this device.
              </div>
            )}
            {isRegisterMode && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Your Name
                </label>
                <div style={{ position: 'relative' }}>
                  <UserIcon
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Smith"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                marginTop: '6px',
                padding: '11px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                width: '100%',
              }}
            >
              {loading ? 'Processing...' : isRegisterMode ? 'Sign Up' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', margin: '4px 0' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>or</span>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                padding: '10px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
              }}
            >
              <Sparkles size={16} color="var(--color-accent)" /> Continue with Instant Guest Account
            </button>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary-text)',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
