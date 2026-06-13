import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { albumMembers, daySoundtracks, soundtracks } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { isValidUUID } from '../lib/validation';
import { isAlbumArchived } from '../lib/albumGuards';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

async function isAlbumMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

router.get('/:date/soundtrack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await db
      .select({
        id: soundtracks.id,
        key: soundtracks.key,
        title: soundtracks.title,
        artist: soundtracks.artist,
        duration_ms: soundtracks.durationMs,
        is_active: soundtracks.isActive,
      })
      .from(daySoundtracks)
      .innerJoin(soundtracks, eq(soundtracks.id, daySoundtracks.soundtrackId))
      .where(and(eq(daySoundtracks.albumId, albumId), eq(daySoundtracks.date, date)))
      .limit(1);

    res.json(rows[0] ?? null);
  } catch (err) {
    next(err);
  }
});

router.put('/:date/soundtrack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    const soundtrackId = req.body?.soundtrack_id;

    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });
    if (!soundtrackId || !isValidUUID(soundtrackId)) {
      return res.status(400).json({ error: 'soundtrack_id required (valid UUID)' });
    }

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (await isAlbumArchived(albumId)) {
      return res.status(409).json({ error: 'Album is archived' });
    }

    const [track] = await db.select().from(soundtracks)
      .where(and(eq(soundtracks.id, soundtrackId), eq(soundtracks.isActive, true)))
      .limit(1);
    if (!track) return res.status(400).json({ error: 'Soundtrack not found or inactive' });

    const [row] = await db
      .insert(daySoundtracks)
      .values({ albumId, date, soundtrackId, updatedBy: req.user!.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [daySoundtracks.albumId, daySoundtracks.date],
        set: { soundtrackId, updatedBy: req.user!.id, updatedAt: new Date() },
      })
      .returning({
        date: daySoundtracks.date,
        soundtrack_id: daySoundtracks.soundtrackId,
        updated_at: daySoundtracks.updatedAt,
        updated_by: daySoundtracks.updatedBy,
      });

    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/:date/soundtrack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (await isAlbumArchived(albumId)) {
      return res.status(409).json({ error: 'Album is archived' });
    }

    await db.delete(daySoundtracks)
      .where(and(eq(daySoundtracks.albumId, albumId), eq(daySoundtracks.date, date)));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export = router;
