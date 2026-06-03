import express, { Request, Response, NextFunction } from 'express';
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, albumMembers } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const membership = await db
      .select({ x: sql<number>`1` })
      .from(albumMembers)
      .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
      .limit(1);
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const rows = await db
      .select({
        id: users.id,
        display_name: users.displayName,
        avatar_url: users.avatarUrl,
        role: albumMembers.role,
        joined_at: albumMembers.joinedAt,
      })
      .from(users)
      .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
      .where(eq(albumMembers.albumId, albumId))
      .orderBy(asc(albumMembers.joinedAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export = router;
