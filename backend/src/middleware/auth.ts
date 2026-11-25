import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

const getJwtSecret = (): string => process.env.JWT_SECRET || 'adhd-focus-coach-secret';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, getJwtSecret());
    req.user = verified as { id: string; email: string };
    next();
  } catch {
    res.status(400).json({ error: 'Invalid token' });
  }
};

export const optionalAuthenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    next();
    return;
  }

  try {
    const verified = jwt.verify(token, getJwtSecret());
    req.user = verified as { id: string; email: string };
  } catch {
    // Proceed without user when token is invalid/expired
  }
  next();
};
