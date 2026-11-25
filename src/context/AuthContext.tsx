import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getAuthToken, setAuthToken, type UserPreferencesDTO } from '../services/api';
import { applyTheme } from '../utils/theme';

export interface User {
  id: string;
  name: string;
  email: string;
  preferences?: UserPreferencesDTO;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => void;
  updateUserPreferences: (partial: Partial<UserPreferencesDTO>) => Promise<UserPreferencesDTO | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const syncThemeFromUser = (u: User | null) => {
  if (u?.preferences?.theme) {
    applyTheme(u.preferences.theme);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          const res = await api.auth.getMe();
          setUser(res.user);
          syncThemeFromUser(res.user);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          setAuthToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    syncThemeFromUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.auth.register(name, email, password);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    syncThemeFromUser(data.user);
  };

  const loginAsGuest = async () => {
    const guestId = Math.floor(1000 + Math.random() * 9000);
    const guestEmail = `guest_${guestId}_${Date.now()}@adhdfocuscoach.local`;
    const guestPassword = `guest_${guestId}_pass`;
    const data = await api.auth.register(`Focus Explorer #${guestId}`, guestEmail, guestPassword);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    syncThemeFromUser(data.user);
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const updateUserPreferences = useCallback(
    async (partial: Partial<UserPreferencesDTO>): Promise<UserPreferencesDTO | null> => {
      if (!token) return null;
      try {
        const res = await api.auth.updatePreferences(partial);
        setUser(prev => (prev ? { ...prev, preferences: res.preferences } : prev));
        return res.preferences;
      } catch (err) {
        console.warn('MongoDB preference sync failed:', err);
        return null;
      }
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        loginAsGuest,
        logout,
        updateUserPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
