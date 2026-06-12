import express, { Request, Response, NextFunction } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { soundtracks } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select({
        id: soundtracks.id,
        key: soundtracks.key,
        title: soundtracks.title,
        artist: soundtracks.artist,
        duration_ms: soundtracks.durationMs,
      })
      .from(soundtracks)
      .where(eq(soundtracks.isActive, true))
      .orderBy(asc(soundtracks.sortOrder), asc(soundtracks.title));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export = router;
