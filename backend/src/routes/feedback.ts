import { Router, Request, Response } from 'express';
import { db } from '../db';
import { feedback } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();
const VALID_PLATFORMS = ['ios', 'android', 'web'] as const;
type Platform = typeof VALID_PLATFORMS[number];

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    rating?: unknown;
    message?: unknown;
    app_version?: unknown;
    platform?: unknown;
  };

  const rating = body.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'invalid_rating' });
  }

  let messageOrNull: string | null = null;
  if (body.message !== undefined) {
    if (typeof body.message !== 'string') {
      return res.status(400).json({ error: 'invalid_message' });
    }
    if (body.message.length > 2000) {
      return res.status(400).json({ error: 'message_too_long' });
    }
    const trimmed = body.message.trim();
    messageOrNull = trimmed.length > 0 ? trimmed : null;
  }

  let appVersionOrNull: string | null = null;
  if (body.app_version !== undefined) {
    if (typeof body.app_version !== 'string' || body.app_version.length > 64) {
      return res.status(400).json({ error: 'invalid_app_version' });
    }
    appVersionOrNull = body.app_version;
  }

  let platformOrNull: Platform | null = null;
  if (body.platform !== undefined) {
    if (typeof body.platform !== 'string' || !VALID_PLATFORMS.includes(body.platform as Platform)) {
      return res.status(400).json({ error: 'invalid_platform' });
    }
    platformOrNull = body.platform as Platform;
  }

  try {
    await db.insert(feedback).values({
      userId: req.user!.id,
      rating,
      message: messageOrNull,
      appVersion: appVersionOrNull,
      platform: platformOrNull,
    });
    return res.status(204).send();
  } catch (err) {
    console.error('feedback insert failed', err);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

export = router;
