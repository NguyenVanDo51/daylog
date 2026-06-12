import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
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

router.get('/:key/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key as string;
    const [track] = await db.select().from(soundtracks).where(eq(soundtracks.key, key)).limit(1);
    if (!track) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(__dirname, '../../assets/soundtracks', track.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

export = router;
