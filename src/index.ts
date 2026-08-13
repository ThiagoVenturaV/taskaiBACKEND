import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './database';
import { authRouter } from './routes/auth';
import { tasksRouter } from './routes/tasks';
import { uploadRouter } from './routes/upload';
import { usersRouter } from './routes/users';
import { authenticate } from './auth';

const app = express();
const PORT = process.env.PORT || 3001;

const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS is required in production');
}
const allowedOrigins = configuredOrigins.length > 0
  ? configuredOrigins
  : ['http://localhost:5173'];

// ─── Middleware ───────────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
}), authRouter);
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
if (process.env.NODE_ENV !== 'production') {
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`✅ Task AI backend running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to the database:', err);
    });
} else {
  // Try to initialize database lazily for production
  initializeDatabase().catch(err => console.error('Database initialization failed:', err));
}

// Export the app for Vercel Serverless Functions
export default app;
