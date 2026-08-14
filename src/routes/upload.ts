import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../auth';
import { db } from '../database';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

// Use memory storage for Serverless environments (Vercel)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const hasValidImageSignature = (buffer: Buffer, mimeType: string): boolean => {
  if (mimeType === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

// POST /api/upload — upload an image as Base64 and attach to a task
uploadRouter.post('/', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file || !hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
      res.status(400).json({ error: 'No valid image file provided' });
      return;
    }

    const userId = (req as any).user.userId;
    const { taskId } = req.body as { taskId?: string };

    // Convert buffer to base64
    const base64Data = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64Data}`;

    // Optionally attach directly to a task
    if (taskId) {
      const { rows } = await db.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
      
      if (rows.length > 0) {
        await db.query(
          'UPDATE tasks SET image_url = $1, updated_at = $2 WHERE id = $3',
          [imageUrl, new Date().toISOString(), taskId]
        );
      }
    }

    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});
