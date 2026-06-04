import express, { Request, Response, NextFunction } from 'express';
import { and, asc, between, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { albumMembers, dayLabels } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { isValidUUID } from '../lib/validation';

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

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    }

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await db
      .select({
        date: dayLabels.date,
        label: dayLabels.label,
        updated_at: dayLabels.updatedAt,
        updated_by: dayLabels.updatedBy,
      })
      .from(dayLabels)
      .where(
        and(
          eq(dayLabels.albumId, albumId),
          between(dayLabels.date, from, to),
        )
      )
      .orderBy(asc(dayLabels.date));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export = router;
