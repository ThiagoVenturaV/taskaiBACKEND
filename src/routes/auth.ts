import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { signToken } from '../auth';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, cpf, email, password, referral } = req.body as {
      name: string;
      phone?: string;
      cpf?: string;
      email: string;
      password: string;
      referral?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email and password are required' });
      return;
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await db.query(
      'INSERT INTO users (id, name, phone, cpf, email, password, referral) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, phone ?? null, cpf ?? null, email, hashed, referral ?? null]
    );

    const token = signToken({ userId: id, email });

    res.status(201).json({
      token,
      user: { id, name, email },
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const userResult = await db.query('SELECT id, name, email, password FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me (handled in index.ts)
authRouter.get('/me', (_req: Request, res: Response): void => {
  res.status(404).send();
});
