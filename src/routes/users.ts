import { Router, Request, Response } from 'express';
import { db } from '../database';
import { authenticate } from '../auth';

export const usersRouter = Router();
usersRouter.use(authenticate);

// GET /api/users/search?q=name — search users to share board with
usersRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const q = (req.query.q as string) || '';

    if (q.length < 2) {
      res.json([]);
      return;
    }

    const pattern = `%${q}%`;
    const { rows } = await db.query(
      `SELECT id, name, email FROM users
       WHERE (name ILIKE $1 OR email ILIKE $2) AND id != $3
       LIMIT 10`,
      [pattern, pattern, userId]
    );

    // Mark already-added shares
    const { rows: shared } = await db.query(
      'SELECT shared_with_id FROM board_shares WHERE owner_id = $1',
      [userId]
    );

    const sharedSet = new Set(shared.map((s: any) => s.shared_with_id));

    res.json(
      rows.map((u: any) => ({
        ...u,
        initials: u.name
          .split(' ')
          .slice(0, 2)
          .map((n: string) => n[0])
          .join('')
          .toUpperCase(),
        added: sharedSet.has(u.id),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/users/share — share board with a user
usersRouter.post('/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = (req as any).user.userId;
    const { sharedWithId } = req.body as { sharedWithId: string };

    if (!sharedWithId) {
      res.status(400).json({ error: 'sharedWithId is required' });
      return;
    }

    const { v4: uuidv4 } = require('uuid');
    try {
      await db.query(
        'INSERT INTO board_shares (id, owner_id, shared_with_id) VALUES ($1, $2, $3)',
        [uuidv4(), ownerId, sharedWithId]
      );
      res.json({ success: true });
    } catch {
      res.status(409).json({ error: 'Already shared' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});
