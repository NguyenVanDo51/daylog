import { Router, Request, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { reactions, photos, users, albumMembers } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { sendPush } from '../services/apns';
import { isValidUUID } from '../lib/validation';

const router = Router({ mergeParams: true });

const VALID_EMOJIS = ['❤️', '😂', '😍', '🥹'];

async function requirePhotoMember(photoId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(photos)
    .innerJoin(albumMembers, eq(albumMembers.albumId, photos.albumId))
    .where(and(eq(photos.id, photoId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  if (!isValidUUID(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
  if (!(await requirePhotoMember(photoId, req.user!.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const rows = await db
      .select({ emoji: reactions.emoji, count: sql<number>`count(*)::int` })
      .from(reactions)
      .where(eq(reactions.photoId, photoId))
      .groupBy(reactions.emoji);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  const userId = req.user!.id;
  const { emoji } = req.body;

  if (!isValidUUID(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
  if (!VALID_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  if (!(await requirePhotoMember(photoId, userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await db
      .insert(reactions)
      .values({ photoId, userId, emoji })
      .onConflictDoUpdate({
        target: [reactions.photoId, reactions.userId],
        set: { emoji },
      });

    const [photo] = await db
      .select({ uploadedBy: photos.uploadedBy })
      .from(photos)
      .where(eq(photos.id, photoId));

    if (photo && photo.uploadedBy && photo.uploadedBy !== userId) {
      const [uploader] = await db
        .select({ apnsToken: users.apnsToken })
        .from(users)
        .where(eq(users.id, photo.uploadedBy));

      if (uploader?.apnsToken) {
        sendPush(
          [uploader.apnsToken],
          'Có reaction mới!',
          `Ai đó đã gửi ${emoji} cho ảnh của bé`,
          { photoId }
        ).catch(() => {});
      }
    }

    return res.status(201).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to upsert reaction' });
  }
});

router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  const userId = req.user!.id;
  if (!isValidUUID(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
  if (!(await requirePhotoMember(photoId, userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await db.delete(reactions).where(
      and(eq(reactions.photoId, photoId), eq(reactions.userId, userId))
    );
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete reaction' });
  }
});

export = router;
