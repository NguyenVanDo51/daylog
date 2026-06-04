import { Router, Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { reactions, photos, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { sendPush } from '../services/apns';

const router = Router({ mergeParams: true });

const VALID_EMOJIS = ['❤️', '😂', '😍', '🥹'];

// GET /photos/:photoId/reactions — count by emoji
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
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

// POST /photos/:photoId/reactions — upsert (one per user per photo)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  const userId = req.user!.id;
  const { emoji } = req.body;

  if (!VALID_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  try {
    await db
      .insert(reactions)
      .values({ photoId, userId, emoji })
      .onConflictDoUpdate({
        target: [reactions.photoId, reactions.userId],
        set: { emoji },
      });

    // Notify photo uploader if different from reactor (fire-and-forget)
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
        ).catch(() => {
          // push is optional — ignore if it fails
        });
      }
    }

    return res.status(201).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to upsert reaction' });
  }
});

// DELETE /photos/:photoId/reactions — remove current user's reaction
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  const userId = req.user!.id;
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
