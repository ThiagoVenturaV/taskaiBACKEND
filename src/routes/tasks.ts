import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { authenticate } from '../auth';

export const tasksRouter = Router();

// All task routes require authentication
tasksRouter.use(authenticate);

type ColumnId = 'todo' | 'in-progress' | 'review' | 'done';

interface DbTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  tag: string | null;
  image_url: string | null;
  column_id: ColumnId;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

function mapTask(row: DbTask) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    tag: row.tag,
    imageUrl: row.image_url,
    columnId: row.column_id,
    completed: row.completed,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/tasks
tasksRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { rows } = await db.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY column_id, position ASC',
      [userId]
    );
    res.json(rows.map(mapTask));
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/tasks
tasksRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { title, description, dueDate, tag, columnId = 'todo' } = req.body as {
      title: string;
      description?: string;
      dueDate?: string;
      tag?: string;
      columnId?: ColumnId;
    };

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const { rows: maxPosRows } = await db.query(
      'SELECT MAX(position) as pos FROM tasks WHERE user_id = $1 AND column_id = $2',
      [userId, columnId]
    );

    const position = (maxPosRows[0]?.pos ?? -1) + 1;
    const id = uuidv4();
    const now = new Date().toISOString();

    const { rows } = await db.query(
      `INSERT INTO tasks (id, user_id, title, description, due_date, tag, column_id, position, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, userId, title, description ?? null, dueDate ?? null, tag ?? null, columnId, position, now, now]
    );

    res.status(201).json(mapTask(rows[0] as DbTask));
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// PATCH /api/tasks/:id
tasksRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const taskResult = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
    if (taskResult.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { title, description, dueDate, tag, columnId, completed, position, imageUrl } = req.body as {
      title?: string;
      description?: string;
      dueDate?: string;
      tag?: string;
      columnId?: ColumnId;
      completed?: boolean;
      position?: number;
      imageUrl?: string;
    };

    const now = new Date().toISOString();

    const { rows } = await db.query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        due_date = COALESCE($3, due_date),
        tag = COALESCE($4, tag),
        column_id = COALESCE($5, column_id),
        completed = COALESCE($6, completed),
        position = COALESCE($7, position),
        image_url = COALESCE($8, image_url),
        updated_at = $9
      WHERE id = $10 AND user_id = $11 RETURNING *`,
      [
        title ?? null,
        description ?? null,
        dueDate ?? null,
        tag ?? null,
        columnId ?? null,
        completed !== undefined ? completed : null,
        position ?? null,
        imageUrl ?? null,
        now,
        id,
        userId
      ]
    );

    res.json(mapTask(rows[0] as DbTask));
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/tasks/:id
tasksRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const result = await db.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/tasks/reorder — bulk position update after drag-and-drop
tasksRouter.post('/reorder', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { tasks } = req.body as { tasks: Array<{ id: string; columnId: ColumnId; position: number }> };

    if (!Array.isArray(tasks)) {
      res.status(400).json({ error: 'tasks must be an array' });
      return;
    }

    const now = new Date().toISOString();
    
    // Simplistic transaction approach via pool client
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const item of tasks) {
        await client.query(
          'UPDATE tasks SET column_id = $1, position = $2, updated_at = $3 WHERE id = $4 AND user_id = $5',
          [item.columnId, item.position, now, item.id, userId]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});
