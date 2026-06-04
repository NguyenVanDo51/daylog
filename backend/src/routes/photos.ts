import express, { Request, Response, NextFunction } from 'express';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, albumMembers, photos, presignTokens } from '../db/schema';
import { getPresignedPutUrl } from '../services/r2';
import { generateThumbnail } from '../services/thumbnail';
import { sendPush } from '../services/apns';
import { isValidUUID, isValidDate } from '../lib/validation';
import { presignLimiter } from '../lib/rateLimit';

const router = express.Router();

router.use(requireAuth);

async function requireMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

function toSnakePhoto(p: typeof photos.$inferSelect) {
  return {
    id: p.id,
    album_id: p.albumId,
    uploaded_by: p.uploadedBy,
    r2_key: p.r2Key,
    thumbnail_key: p.thumbnailKey,
    taken_at: p.takenAt,
    caption: p.caption,
    local_asset_id: p.localAssetId,
    created_at: p.createdAt,
  };
}

router.post('/presign', presignLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id } = req.body ?? {};
    if (!album_id) return res.status(400).json({ error: 'album_id required' });
    if (!isValidUUID(album_id)) {
      return res.status(400).json({ error: 'album_id must be a valid UUID' });
    }
    if (!(await requireMember(album_id, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { url, key } = await getPresignedPutUrl();
    await db.insert(presignTokens).values({ key, userId: req.user!.id });
    return res.json({ url, key });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id, r2_key, taken_at, caption, local_asset_id } = req.body ?? {};
    if (!album_id || !r2_key || !taken_at) {
      return res.status(400).json({ error: 'album_id, r2_key, taken_at required' });
    }
    if (!isValidUUID(album_id)) {
      return res.status(400).json({ error: 'album_id must be a valid UUID' });
    }
    if (!isValidDate(taken_at)) {
      return res.status(400).json({ error: 'taken_at must be a valid ISO date' });
    }
    if (!(await requireMember(album_id, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Idempotency check first — before consuming a presign token
    if (local_asset_id) {
      const existing = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.albumId, album_id),
            eq(photos.localAssetId, local_asset_id),
            eq(photos.uploadedBy, req.user!.id)
          )
        )
        .limit(1);
      if (existing[0]) return res.status(200).json(toSnakePhoto(existing[0]));
    }

    // Verify this r2_key was issued to this user
    const [token] = await db
      .select()
      .from(presignTokens)
      .where(and(eq(presignTokens.key, r2_key), eq(presignTokens.userId, req.user!.id)))
      .limit(1);
    if (!token) {
      return res.status(400).json({ error: 'Invalid or unrecognized r2_key' });
    }
    await db.delete(presignTokens).where(eq(presignTokens.key, r2_key));

    const thumbnailKey = await generateThumbnail(r2_key);

    const [photo] = await db
      .insert(photos)
      .values({
        albumId: album_id,
        uploadedBy: req.user!.id,
        r2Key: r2_key,
        thumbnailKey,
        takenAt: new Date(taken_at),
        caption: caption ?? null,
        localAssetId: local_asset_id ?? null,
      })
      .returning();

    const recipients = await db
      .select({ token: users.apnsToken })
      .from(users)
      .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
      .where(
        and(
          eq(albumMembers.albumId, album_id),
          isNotNull(users.apnsToken),
          ne(users.id, req.user!.id)
        )
      );
    const tokens = recipients.map((r) => r.token!).filter(Boolean);
    sendPush(tokens, 'New photo added', `${req.user!.displayName} added a new photo`, { photoId: photo.id }).catch(console.error);

    return res.status(201).json(toSnakePhoto(photo));
  } catch (err) {
    next(err);
  }
});

export = router;
