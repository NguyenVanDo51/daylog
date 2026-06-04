import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albumMembers } from '../db/schema';
import { isValidUUID } from '../lib/validation';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

// Shape returned by the query below. Field names are snake_case to match the
// raw-SQL aliases the tests assert on. `event_time` comes back from pg as a
// Date for timestamptz columns, but is intentionally widened to also accept a
// string in case the driver/cast returns a stringified timestamp.
type TimelineRow = {
  id: string;
  type: 'photo';
  event_time: Date | string;
  r2_key: string | null;
  thumbnail_key: string | null;
  caption: string | null;
  user_id: string;
  local_asset_id: string | null;
  media_type: string | null;
  source: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
};

type Cursor = {
  event_time: string;
  id: string;
};

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    const raw = Number(req.query.limit);
    const limit = Math.min(!isNaN(raw) && raw > 0 ? Math.floor(raw) : 20, 100);
    let cursor: Cursor | null = null;
    if (req.query.cursor) {
      try {
        cursor = JSON.parse(
          Buffer.from(req.query.cursor as string, 'base64').toString()
        ) as Cursor;
      } catch {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
    }

    const membership = await db
      .select({ x: sql<number>`1` })
      .from(albumMembers)
      .where(
        and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id))
      )
      .limit(1);
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    // Build the cursor predicate. When no cursor, collapses to an empty SQL
    // fragment so the WHERE keeps just the album_id filter.
    const cursorClause = cursor
      ? sql`AND (taken_at < ${cursor.event_time} OR (taken_at = ${cursor.event_time} AND id < ${cursor.id}))`
      : sql``;

    const result = await db.execute<TimelineRow>(sql`
      SELECT id, 'photo' AS type, taken_at AS event_time,
             r2_key, thumbnail_key, caption, uploaded_by AS user_id,
             local_asset_id, media_type, source, duration_ms,
             width, height
      FROM photos
      WHERE album_id = ${albumId} ${cursorClause}
      ORDER BY event_time DESC, id DESC
      LIMIT ${limit + 1}
    `);

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            event_time: items[items.length - 1].event_time,
            id: items[items.length - 1].id,
          })
        ).toString('base64')
      : null;

    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

export = router;
