import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albumMembers } from '../db/schema';
import { isValidUUID } from '../lib/validation';
import { getPresignedGetUrl } from '../services/r2';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

async function isMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

interface PhotoRow {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
  caption: string | null;
  uploaded_by: string;
  r2_key: string;
  thumbnail_key: string | null;
  width: number | null;
  height: number | null;
  date: string;
}

// GET /albums/:id/photos
// Returns the full album library grouped by day, newest day first.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!(await isMember(albumId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });

    const rows = await db.execute(sql`
      SELECT p.id, p.media_type, p.duration_ms,
             to_char(p.taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS taken_at,
             p.caption,
             p.uploaded_by,
             p.r2_key,
             p.thumbnail_key,
             p.width,
             p.height,
             (DATE(p.taken_at AT TIME ZONE 'UTC'))::text AS date
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.id
      WHERE ap.album_id = ${albumId}::uuid
      ORDER BY p.taken_at DESC
    `);

    const flat = await Promise.all(
      (rows.rows as unknown as PhotoRow[]).map(async (row) => ({
        id: row.id,
        media_type: row.media_type,
        duration_ms: row.duration_ms,
        taken_at: row.taken_at,
        caption: row.caption,
        uploaded_by: row.uploaded_by,
        width: row.width,
        height: row.height,
        date: row.date,
        photo_url: await getPresignedGetUrl(row.r2_key),
        thumb_url: row.thumbnail_key ? await getPresignedGetUrl(row.thumbnail_key) : null,
      })),
    );

    // Group by date, preserve newest-first day order and chronological-within-day.
    const byDate = new Map<string, typeof flat>();
    for (const p of flat) {
      const bucket = byDate.get(p.date);
      if (bucket) bucket.push(p);
      else byDate.set(p.date, [p]);
    }
    const days = Array.from(byDate.entries()).map(([date, photos]) => ({
      date,
      photos: photos.slice().sort((a, b) => a.taken_at.localeCompare(b.taken_at)),
    }));

    res.json(days);
  } catch (err) {
    next(err);
  }
});

export = router;
