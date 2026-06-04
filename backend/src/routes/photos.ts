import express, { Request, Response, NextFunction } from 'express';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
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

const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'video/mp4'] as const;
type AllowedContentType = typeof ALLOWED_CONTENT_TYPES[number];

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
    media_type: p.mediaType,
    source: p.source,
    duration_ms: p.durationMs,
  };
}

router.post('/presign', presignLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id, content_type = 'image/webp' } = req.body ?? {};
    if (!album_id) return res.status(400).json({ error: 'album_id required' });
    if (!isValidUUID(album_id)) {
      return res.status(400).json({ error: 'album_id must be a valid UUID' });
    }
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(content_type)) {
      return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` });
    }
    if (!(await requireMember(album_id, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { url, key } = await getPresignedPutUrl(content_type as AllowedContentType);
    await db.insert(presignTokens).values({ key, userId: req.user!.id });
    return res.json({ url, key });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      album_id, r2_key, taken_at, caption, local_asset_id,
      media_type = 'photo', source = 'upload',
      duration_ms, thumbnail_r2_key,
    } = req.body ?? {};

    if (!album_id || !r2_key || !taken_at) {
      return res.status(400).json({ error: 'album_id, r2_key, taken_at required' });
    }
    if (!isValidUUID(album_id)) {
      return res.status(400).json({ error: 'album_id must be a valid UUID' });
    }
    if (!isValidDate(taken_at)) {
      return res.status(400).json({ error: 'taken_at must be a valid ISO date' });
    }
    if (!['photo', 'video'].includes(media_type)) {
      return res.status(400).json({ error: 'media_type must be photo or video' });
    }
    if (!['capture', 'upload'].includes(source)) {
      return res.status(400).json({ error: 'source must be capture or upload' });
    }

    // Video-specific validation
    if (media_type === 'video') {
      if (duration_ms == null) {
        return res.status(400).json({ error: 'duration_ms required for video' });
      }
      if (typeof duration_ms !== 'number' || duration_ms > 2000 || duration_ms < 1) {
        return res.status(400).json({ error: 'duration_ms must be between 1 and 2000' });
      }
      if (!thumbnail_r2_key) {
        return res.status(400).json({ error: 'thumbnail_r2_key required for video' });
      }
    }

    if (!(await requireMember(album_id, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Rate limit: 30 min between captures per user
    if (source === 'capture') {
      const [lastCapture] = await db
        .select({ createdAt: photos.createdAt })
        .from(photos)
        .where(and(eq(photos.uploadedBy, req.user!.id), eq(photos.source, 'capture')))
        .orderBy(desc(photos.createdAt))
        .limit(1);

      if (lastCapture?.createdAt) {
        const elapsed = Date.now() - new Date(lastCapture.createdAt).getTime();
        const COOLDOWN_MS = 30 * 60 * 1000;
        if (elapsed < COOLDOWN_MS) {
          const retryAfterSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
          return res.status(429).json({
            error: 'rate_limited',
            retry_after_seconds: retryAfterSeconds,
            message: `Bạn có thể chụp tiếp sau ${Math.ceil(retryAfterSeconds / 60)} phút.`,
          });
        }
      }
    }

    // Idempotency check first — before consuming a presign token
    if (local_asset_id) {
      const existing = await db
        .select()
        .from(photos)
        .where(and(
          eq(photos.albumId, album_id),
          eq(photos.localAssetId, local_asset_id),
          eq(photos.uploadedBy, req.user!.id)
        ))
        .limit(1);
      if (existing[0]) return res.status(200).json(toSnakePhoto(existing[0]));
    }

    // Verify main r2_key ownership
    const [token] = await db
      .select()
      .from(presignTokens)
      .where(and(eq(presignTokens.key, r2_key), eq(presignTokens.userId, req.user!.id)))
      .limit(1);
    if (!token) {
      return res.status(400).json({ error: 'Invalid or unrecognized r2_key' });
    }
    await db.delete(presignTokens).where(eq(presignTokens.key, r2_key));

    // Thumbnail: server-generated for photos, client-provided for videos
    let thumbnailKey: string | null;
    if (media_type === 'video') {
      const [thumbToken] = await db
        .select()
        .from(presignTokens)
        .where(and(eq(presignTokens.key, thumbnail_r2_key), eq(presignTokens.userId, req.user!.id)))
        .limit(1);
      if (!thumbToken) {
        return res.status(400).json({ error: 'Invalid or unrecognized thumbnail_r2_key' });
      }
      await db.delete(presignTokens).where(eq(presignTokens.key, thumbnail_r2_key));
      thumbnailKey = thumbnail_r2_key;
    } else {
      thumbnailKey = await generateThumbnail(r2_key);
    }

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
        mediaType: media_type,
        source,
        durationMs: media_type === 'video' ? duration_ms : null,
      })
      .returning();

    // Push notification
    const recipients = await db
      .select({ token: users.apnsToken })
      .from(users)
      .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
      .where(and(
        eq(albumMembers.albumId, album_id),
        isNotNull(users.apnsToken),
        ne(users.id, req.user!.id)
      ));
    const tokens = recipients.map((r) => r.token!).filter(Boolean);
    const pushTitle = source === 'capture' ? 'Khoảnh khắc mới' : 'Ảnh mới';
    const pushBody = source === 'capture'
      ? `${req.user!.displayName} vừa gửi một khoảnh khắc`
      : `${req.user!.displayName} đã thêm ảnh mới`;
    sendPush(tokens, pushTitle, pushBody, { photoId: photo.id }).catch(console.error);

    return res.status(201).json(toSnakePhoto(photo));
  } catch (err) {
    next(err);
  }
});

export = router;
