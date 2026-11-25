import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { DEFAULT_USER_PREFERENCES, IUserPreferences } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { isDatabaseConnected } from '../utils/db';
import { localStore } from '../utils/localStore';

const getJwtSecret = (): string => process.env.JWT_SECRET || 'adhd-focus-coach-secret';

const normalizeTheme = (val: unknown): IUserPreferences['theme'] | null => {
  if (val === 'Light' || val === 'light') return 'Light';
  if (val === 'Dark' || val === 'dark') return 'Dark';
  if (val === 'System' || val === 'system') return 'System';
  return null;
};

const formatPreferences = (prefs?: Partial<IUserPreferences>): IUserPreferences => ({
  theme: normalizeTheme(prefs?.theme) ?? DEFAULT_USER_PREFERENCES.theme,
  focusTimerDefault:
    typeof prefs?.focusTimerDefault === 'string'
      ? prefs.focusTimerDefault
      : DEFAULT_USER_PREFERENCES.focusTimerDefault,
  notifications:
    typeof prefs?.notifications === 'boolean'
      ? prefs.notifications
      : DEFAULT_USER_PREFERENCES.notifications,
  sound: typeof prefs?.sound === 'boolean' ? prefs.sound : DEFAULT_USER_PREFERENCES.sound,
  autoStartNextStep:
    typeof prefs?.autoStartNextStep === 'boolean'
      ? prefs.autoStartNextStep
      : DEFAULT_USER_PREFERENCES.autoStartNextStep,
  showDailyTips:
    typeof prefs?.showDailyTips === 'boolean'
      ? prefs.showDailyTips
      : DEFAULT_USER_PREFERENCES.showDailyTips,
});

const mergePreferences = (
  existing: Partial<IUserPreferences> | undefined,
  body: Partial<IUserPreferences>
): IUserPreferences => {
  const current = formatPreferences(existing);
  return {
    theme: normalizeTheme(body.theme) ?? current.theme,
    focusTimerDefault:
      typeof body.focusTimerDefault === 'string' && body.focusTimerDefault.trim()
        ? body.focusTimerDefault.trim()
        : current.focusTimerDefault,
    notifications:
      typeof body.notifications === 'boolean' ? body.notifications : current.notifications,
    sound: typeof body.sound === 'boolean' ? body.sound : current.sound,
    autoStartNextStep:
      typeof body.autoStartNextStep === 'boolean'
        ? body.autoStartNextStep
        : current.autoStartNextStep,
    showDailyTips:
      typeof body.showDailyTips === 'boolean' ? body.showDailyTips : current.showDailyTips,
  };
};

const buildAuthPayload = (user: {
  _id: { toString(): string };
  name: string;
  email: string;
  preferences?: Partial<IUserPreferences>;
}) => {
  const id = user._id.toString();
  const token = jwt.sign({ id, email: user.email }, getJwtSecret(), { expiresIn: '7d' });
  return {
    token,
    user: {
      id,
      name: user.name,
      email: user.email,
      preferences: formatPreferences(user.preferences),
    },
  };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body ?? {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isDatabaseConnected()) {
      const existing = localStore.findUserByEmail(normalizedEmail);
      if (existing) {
        res.status(400).json({ error: 'An account with this email already exists' });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const localUser = localStore.createUser({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      });
      res.status(201).json(buildAuthPayload(localUser));
      return;
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      preferences: { ...DEFAULT_USER_PREFERENCES },
    });
    res.status(201).json(buildAuthPayload(user));
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isDatabaseConnected()) {
      const localUser = localStore.findUserByEmail(normalizedEmail);
      if (!localUser) {
        res.status(503).json({
          error:
            'MongoDB Atlas is unreachable and no offline account exists for this email. Please Sign Up, continue as Guest, or check DATABASE_URL in backend/.env.',
        });
        return;
      }
      const valid = Boolean(localUser.passwordHash) && (await bcrypt.compare(password, localUser.passwordHash));
      if (!valid) {
        res.status(400).json({ error: 'Invalid email or password' });
        return;
      }
      res.json(buildAuthPayload(localUser));
      return;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }
    res.json(buildAuthPayload(user));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const localUser = req.user?.id ? localStore.findUserById(req.user.id) : undefined;
      if (!localUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({
        user: {
          id: localUser._id,
          name: localUser.name,
          email: localUser.email,
          preferences: formatPreferences(localUser.preferences),
        },
      });
      return;
    }

    const user = await User.findById(req.user?.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferences: formatPreferences(user.preferences),
      },
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDatabaseConnected()) {
      const localUser = req.user?.id ? localStore.findUserById(req.user.id) : undefined;
      if (!localUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ preferences: formatPreferences(localUser.preferences) });
      return;
    }

    const user = await User.findById(req.user?.id).select('preferences');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ preferences: formatPreferences(user.preferences) });
  } catch (error) {
    console.error('GetPreferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Partial<IUserPreferences>;

    if (!isDatabaseConnected()) {
      const localUser = req.user?.id ? localStore.findUserById(req.user.id) : undefined;
      if (!localUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const merged = mergePreferences(localUser.preferences, body);
      localStore.updateUserPreferences(localUser._id, merged);
      res.json({ preferences: merged });
      return;
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const merged = mergePreferences(user.preferences, body);
    user.preferences = merged;
    await user.save();

    res.json({ preferences: merged });
  } catch (error) {
    console.error('UpdatePreferences error:', error);
    res.status(500).json({ error: 'Server error updating preferences' });
  }
};
