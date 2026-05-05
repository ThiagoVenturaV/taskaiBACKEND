import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database';
import { authRouter } from './routes/auth';
import { tasksRouter } from './routes/tasks';
import { uploadRouter } from './routes/upload';
import { usersRouter } from './routes/users';
import { authenticate } from './auth';

const app = express();
const PORT = process.env.PORT || 3001;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/upload', uploadRouter);

// Protected user routes
app.use('/api/users', authenticate, usersRouter);

// Protect /api/auth/me - using pg
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const jwtUser = (req as any).user;
    const { db } = await import('./database');
    const { rows } = await db.query('SELECT id, name, email FROM users WHERE id = $1', [jwtUser.userId]);
    const user = rows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Task AI backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to the database:', err);
  });
