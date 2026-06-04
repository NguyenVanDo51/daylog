import express, { Request, Response, NextFunction } from 'express';
import { and, between, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albumMembers, dayLabels } from '../db/schema';
import { isValidUUID } from '../lib/validation';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });

    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    const membership = await db
      .select({ x: sql<number>`1` })
      .from(albumMembers)
      .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
      .limit(1);
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    type DayRow = { day: string; has_upload: boolean; has_capture: boolean; has_milestone: boolean };

    const rows = await db.execute<DayRow>(sql`
      WITH photo_days AS (
        SELECT
          TO_CHAR(taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          BOOL_OR(source = 'upload')  AS has_upload,
          BOOL_OR(source = 'capture') AS has_capture,
          FALSE                        AS has_milestone
        FROM photos
        WHERE album_id = ${albumId}
          AND EXTRACT(YEAR  FROM taken_at AT TIME ZONE 'UTC') = ${year}
          AND EXTRACT(MONTH FROM taken_at AT TIME ZONE 'UTC') = ${month}
        GROUP BY day
      ),
      milestone_days AS (
        SELECT
          TO_CHAR(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          FALSE AS has_upload,
          FALSE AS has_capture,
          TRUE  AS has_milestone
        FROM milestones
        WHERE album_id = ${albumId}
          AND EXTRACT(YEAR  FROM occurred_at AT TIME ZONE 'UTC') = ${year}
          AND EXTRACT(MONTH FROM occurred_at AT TIME ZONE 'UTC') = ${month}
        GROUP BY day
      ),
      combined AS (
        SELECT day, has_upload, has_capture, has_milestone FROM photo_days
        UNION ALL
        SELECT day, has_upload, has_capture, has_milestone FROM milestone_days
      )
      SELECT
        day,
        BOOL_OR(has_upload)    AS has_upload,
        BOOL_OR(has_capture)   AS has_capture,
        BOOL_OR(has_milestone) AS has_milestone
      FROM combined
      GROUP BY day
      ORDER BY day
    `);

    const result: Record<string, { photo: boolean; capture: boolean; milestone: boolean; label?: string }> = {};
    for (const row of rows.rows) {
      result[row.day] = {
        photo: row.has_upload,
        capture: row.has_capture,
        milestone: row.has_milestone,
      };
    }

    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const labelRows = await db
      .select({ date: dayLabels.date, label: dayLabels.label })
      .from(dayLabels)
      .where(and(eq(dayLabels.albumId, albumId), between(dayLabels.date, fromDate, toDate)));

    for (const r of labelRows) {
      if (!result[r.date]) {
        result[r.date] = { photo: false, capture: false, milestone: false };
      }
      result[r.date].label = r.label;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export = router;
