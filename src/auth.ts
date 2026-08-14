import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const configuredJwtSecret = process.env.JWT_SECRET;
if (!configuredJwtSecret || configuredJwtSecret.length < 32) {
  throw new Error('JWT_SECRET is required and must contain at least 32 characters');
}
const JWT_SECRET: string = configuredJwtSecret;

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.email !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  return { userId: decoded.userId, email: decoded.email };
}

// Express middleware — attaches user to req if token valid
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
