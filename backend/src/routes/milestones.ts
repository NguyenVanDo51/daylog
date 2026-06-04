import express, { Request, Response, NextFunction } from 'express';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, albumMembers, milestones } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { sendPush } from '../services/apns';
import { isValidUUID } from '../lib/validation';

const router = express.Router();

// Selecting these columns aliased to snake_case keeps the response shape that
// the existing tests assert on (id, album_id, created_by, title, note,
// occurred_at, cover_photo_id, created_at).
const milestoneSelect = {
  id: milestones.id,
  album_id: milestones.albumId,
  created_by: milestones.createdBy,
  title: milestones.title,
  note: milestones.note,
  occurred_at: milestones.occurredAt,
  cover_photo_id: milestones.coverPhotoId,
  created_at: milestones.createdAt,
};

async function isAlbumMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

router.post(
  '/albums/:albumId/milestones',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const albumId = req.params.albumId as string;
      if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
      const { title, note, occurred_at, cover_photo_id } = req.body ?? {};
      if (!title || !occurred_at) {
        res.status(400).json({ error: 'title and occurred_at required' });
        return;
      }

      if (!(await isAlbumMember(albumId, req.user!.id))) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const [milestone] = await db
        .insert(milestones)
        .values({
          albumId,
          createdBy: req.user!.id,
          title,
          note: note ?? null,
          occurredAt: new Date(occurred_at),
          coverPhotoId: cover_photo_id ?? null,
        })
        .returning(milestoneSelect);

      const recipients = await db
        .select({ token: users.apnsToken })
        .from(users)
        .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
        .where(
          and(
            eq(albumMembers.albumId, albumId),
            isNotNull(users.apnsToken),
            ne(users.id, req.user!.id)
          )
        );
      const tokens = recipients.map((r) => r.token!).filter(Boolean);
      sendPush(tokens, 'New milestone!', `${req.user!.displayName} added: ${title}`, {
        milestoneId: milestone.id,
      }).catch(console.error);

      res.status(201).json(milestone);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/albums/:albumId/milestones',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const albumId = req.params.albumId as string;
      if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
      if (!(await isAlbumMember(albumId, req.user!.id))) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const rows = await db
        .select(milestoneSelect)
        .from(milestones)
        .where(eq(milestones.albumId, albumId))
        .orderBy(desc(milestones.occurredAt));

      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/milestones/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const milestoneId = req.params.id as string;
      if (!isValidUUID(milestoneId)) { res.status(400).json({ error: 'Invalid milestoneId' }); return; }
      // Access check: caller must be a member of the milestone's owning album.
      const existing = await db
        .select({ id: milestones.id })
        .from(milestones)
        .innerJoin(albumMembers, eq(albumMembers.albumId, milestones.albumId))
        .where(
          and(eq(milestones.id, milestoneId), eq(albumMembers.userId, req.user!.id))
        )
        .limit(1);
      if (!existing[0]) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const { title, note, occurred_at, cover_photo_id } = req.body ?? {};

      // Mirror the original SQL's COALESCE($n, col) behavior: only overwrite
      // columns when the caller actually supplied a non-null value. If none
      // were supplied, the UPDATE would have been a no-op in the old route,
      // so we just return the current row.
      const patch: {
        title?: string;
        note?: string;
        occurredAt?: Date;
        coverPhotoId?: string;
      } = {};
      if (title !== undefined && title !== null) patch.title = title;
      if (note !== undefined && note !== null) patch.note = note;
      if (occurred_at !== undefined && occurred_at !== null) {
        patch.occurredAt = new Date(occurred_at);
      }
      if (cover_photo_id !== undefined && cover_photo_id !== null) {
        patch.coverPhotoId = cover_photo_id;
      }

      let updated;
      if (Object.keys(patch).length === 0) {
        const rows = await db
          .select(milestoneSelect)
          .from(milestones)
          .where(eq(milestones.id, milestoneId))
          .limit(1);
        updated = rows[0];
      } else {
        const rows = await db
          .update(milestones)
          .set(patch)
          .where(eq(milestones.id, milestoneId))
          .returning(milestoneSelect);
        updated = rows[0];
      }

      if (!updated) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/milestones/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const milestoneId = req.params.id as string;
      if (!isValidUUID(milestoneId)) { res.status(400).json({ error: 'Invalid milestoneId' }); return; }
      const existing = await db
        .select({ id: milestones.id, role: albumMembers.role })
        .from(milestones)
        .innerJoin(albumMembers, eq(albumMembers.albumId, milestones.albumId))
        .where(
          and(eq(milestones.id, milestoneId), eq(albumMembers.userId, req.user!.id))
        )
        .limit(1);
      if (!existing[0] || existing[0].role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await db.delete(milestones).where(eq(milestones.id, milestoneId));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

export = router;
