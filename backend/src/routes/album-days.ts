import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albumMembers, albumPhotos, photos } from '../db/schema';
import { isValidUUID } from '../lib/validation';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

async function isMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// GET /albums/:id/days
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!(await isMember(albumId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });

    const rows = await db.execute(sql`
      SELECT
        day_group.date,
        thumb.thumbnail_photo_id,
        day_group.has_video,
        day_group.photo_count
      FROM (
        SELECT
          (DATE(p.taken_at AT TIME ZONE 'UTC'))::text AS date,
          BOOL_OR(p.media_type = 'video') AS has_video,
          COUNT(*)::int AS photo_count,
          MIN(p.taken_at) AS earliest_taken_at
        FROM photos p
        JOIN album_photos ap ON ap.photo_id = p.id
        WHERE ap.album_id = ${albumId}::uuid
        GROUP BY DATE(p.taken_at AT TIME ZONE 'UTC')
      ) AS day_group
      JOIN LATERAL (
        SELECT p2.id AS thumbnail_photo_id
        FROM photos p2
        JOIN album_photos ap2 ON ap2.photo_id = p2.id
        WHERE ap2.album_id = ${albumId}::uuid
          AND p2.taken_at = day_group.earliest_taken_at
        LIMIT 1
      ) AS thumb ON true
      ORDER BY day_group.date DESC
    `);

    res.json(rows.rows);
  } catch (err) {
    next(err);
  }
});

// GET /albums/:id/days/:date/photos
router.get('/:date/photos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (!(await isMember(albumId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });

    const rows = await db.execute(sql`
      SELECT p.id, p.media_type, p.duration_ms,
             to_char(p.taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS taken_at,
             p.caption
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.id
      WHERE ap.album_id = ${albumId}::uuid
        AND DATE(p.taken_at AT TIME ZONE 'UTC') = ${date}::date
      ORDER BY p.taken_at ASC
    `);

    res.json(rows.rows);
  } catch (err) {
    next(err);
  }
});

export = router;
