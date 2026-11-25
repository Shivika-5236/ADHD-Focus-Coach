export type ThemePreference = 'Light' | 'Dark' | 'System';

const THEME_STORAGE_KEY = 'adhd_focus_theme';

export const getStoredTheme = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'Light' || saved === 'Dark' || saved === 'System') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'Light';
};

export const resolveTheme = (pref: ThemePreference): 'light' | 'dark' => {
  if (pref === 'Dark') return 'dark';
  if (pref === 'Light') return 'light';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const applyTheme = (pref: ThemePreference): 'light' | 'dark' => {
  const resolved = resolveTheme(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore storage errors
  }
  return resolved;
};

let mediaListenerAttached = false;

export const initTheme = (): void => {
  const current = getStoredTheme();
  applyTheme(current);

  if (!mediaListenerAttached && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaListenerAttached = true;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (getStoredTheme() === 'System') {
        applyTheme('System');
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
  }
};
