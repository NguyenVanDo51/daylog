import express, { Request, Response, NextFunction } from 'express';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, albumMembers, photos, presignTokens, albumPhotos, albums } from '../db/schema';
import { getPresignedPutUrl, getObjectBuffer, deleteObject } from '../services/r2';
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
    width: p.width,
    height: p.height,
  };
}

router.post('/presign', presignLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id, content_type = 'image/webp' } = req.body ?? {};
    if (album_id) {
      if (!isValidUUID(album_id)) {
        return res.status(400).json({ error: 'album_id must be a valid UUID' });
      }
      if (!(await requireMember(album_id, req.user!.id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(content_type)) {
      return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` });
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
      album_ids, r2_key, taken_at, caption, local_asset_id,
      media_type = 'photo', source = 'upload',
      duration_ms, thumbnail_r2_key,
      width: clientWidth, height: clientHeight,
    } = req.body ?? {};

    if (!Array.isArray(album_ids) || album_ids.length === 0) {
      return res.status(400).json({ error: 'album_ids must be a non-empty array' });
    }
    if (!r2_key || !taken_at) {
      return res.status(400).json({ error: 'album_ids, r2_key, taken_at required' });
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

    const typedMediaType = media_type as 'photo' | 'video';
    const typedSource = source as 'capture' | 'upload';

    // Video-specific validation
    if (typedMediaType === 'video') {
      if (duration_ms == null) {
        return res.status(400).json({ error: 'duration_ms required for video' });
      }
      if (typeof duration_ms !== 'number' || !Number.isInteger(duration_ms) || duration_ms > 2000 || duration_ms < 1) {
        return res.status(400).json({ error: 'duration_ms must be between 1 and 2000' });
      }
      if (!thumbnail_r2_key) {
        return res.status(400).json({ error: 'thumbnail_r2_key required for video' });
      }
    }

    // Check membership for all album_ids
    const memberChecks = await Promise.all(
      (album_ids as string[]).map((albumId) => requireMember(albumId, req.user!.id))
    );
    if (memberChecks.some((isMember) => !isMember)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const primaryAlbumId = (album_ids as string[])[0];

    // Idempotency check first — before consuming a presign token
    if (local_asset_id) {
      const existing = await db
        .select()
        .from(photos)
        .where(and(
          eq(photos.albumId, primaryAlbumId),
          eq(photos.localAssetId, local_asset_id),
          eq(photos.uploadedBy, req.user!.id)
        ))
        .limit(1);
      if (existing[0]) return res.status(200).json(toSnakePhoto(existing[0]));
    }

    // Verify main r2_key ownership (outside tx — bail early before opening a transaction)
    const [token] = await db
      .select()
      .from(presignTokens)
      .where(and(eq(presignTokens.key, r2_key), eq(presignTokens.userId, req.user!.id)))
      .limit(1);
    if (!token) {
      return res.status(400).json({ error: 'Invalid or unrecognized r2_key' });
    }

    // Verify thumbnail token for videos before opening the transaction
    let thumbTokenValid = true;
    if (typedMediaType === 'video') {
      const [thumbToken] = await db
        .select()
        .from(presignTokens)
        .where(and(eq(presignTokens.key, thumbnail_r2_key), eq(presignTokens.userId, req.user!.id)))
        .limit(1);
      if (!thumbToken) {
        thumbTokenValid = false;
      }
    }
    if (!thumbTokenValid) {
      return res.status(400).json({ error: 'Invalid or unrecognized thumbnail_r2_key' });
    }

    // Wrap token deletions + insert in a transaction so a failed insert doesn't consume tokens
    const [photo] = await db.transaction(async (tx) => {
      await tx.delete(presignTokens).where(eq(presignTokens.key, r2_key));

      // Thumbnail: server-generated for photos, client-provided for videos
      let thumbnailKey: string | null;
      let photoWidth: number | null = null;
      let photoHeight: number | null = null;

      if (typedMediaType === 'video') {
        await tx.delete(presignTokens).where(eq(presignTokens.key, thumbnail_r2_key));
        thumbnailKey = thumbnail_r2_key;
        photoWidth = Number.isInteger(clientWidth) && clientWidth > 0 ? clientWidth : null;
        photoHeight = Number.isInteger(clientHeight) && clientHeight > 0 ? clientHeight : null;
      } else {
        const result = await generateThumbnail(r2_key);
        thumbnailKey = result.key;
        photoWidth = result.width;
        photoHeight = result.height;
      }

      const inserted = await tx
        .insert(photos)
        .values({
          albumId: primaryAlbumId,
          uploadedBy: req.user!.id,
          r2Key: r2_key,
          thumbnailKey,
          takenAt: new Date(taken_at),
          caption: caption ?? null,
          localAssetId: local_asset_id ?? null,
          mediaType: typedMediaType,
          source: typedSource,
          durationMs: typedMediaType === 'video' ? duration_ms : null,
          width: photoWidth,
          height: photoHeight,
        })
        .returning();

      // Insert join-table rows for all album_ids
      await tx.insert(albumPhotos).values(
        (album_ids as string[]).map((albumId) => ({
          photoId: inserted[0].id,
          albumId: albumId,
        }))
      );

      return inserted;
    });

    // Push notification (send to primary album members)
    const recipients = await db
      .select({ token: users.apnsToken })
      .from(users)
      .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
      .where(and(
        eq(albumMembers.albumId, primaryAlbumId),
        isNotNull(users.apnsToken),
        ne(users.id, req.user!.id)
      ));
    const tokens = recipients.map((r) => r.token!).filter(Boolean);
    const pushTitle = typedSource === 'capture' ? 'Khoảnh khắc mới' : 'Ảnh mới';
    const pushBody = typedSource === 'capture'
      ? `${req.user!.displayName} vừa gửi một khoảnh khắc`
      : `${req.user!.displayName} đã thêm ảnh mới`;
    sendPush(tokens, pushTitle, pushBody, { photoId: photo.id }).catch(console.error);

    return res.status(201).json(toSnakePhoto(photo));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/full', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id as string;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select({ r2Key: photos.r2Key, mediaType: photos.mediaType })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Not found' });

    const [member] = await db
      .select({ x: sql<number>`1` })
      .from(albumPhotos)
      .innerJoin(
        albumMembers,
        and(
          eq(albumMembers.albumId, albumPhotos.albumId),
          eq(albumMembers.userId, req.user!.id),
        ),
      )
      .where(eq(albumPhotos.photoId, photoId))
      .limit(1);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const ext = photo.r2Key.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'mp4' ? 'video/mp4' : ext === 'jpg' ? 'image/jpeg' : 'image/webp';

    const buffer = await getObjectBuffer(photo.r2Key);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/thumb', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id as string;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select({ thumbnailKey: photos.thumbnailKey })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo || !photo.thumbnailKey) return res.status(404).json({ error: 'Not found' });

    const [member] = await db
      .select({ x: sql<number>`1` })
      .from(albumPhotos)
      .innerJoin(
        albumMembers,
        and(
          eq(albumMembers.albumId, albumPhotos.albumId),
          eq(albumMembers.userId, req.user!.id),
        ),
      )
      .where(eq(albumPhotos.photoId, photoId))
      .limit(1);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const buffer = await getObjectBuffer(photo.thumbnailKey);
    const thumbExt = photo.thumbnailKey.split('.').pop()?.toLowerCase();
    const thumbContentType = thumbExt === 'jpg' ? 'image/jpeg' : 'image/webp';
    res.setHeader('Content-Type', thumbContentType);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id as string;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (photo.uploadedBy !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

    const { caption } = req.body ?? {};
    const newCaption = (typeof caption === 'string' && caption.length > 0) ? caption : null;

    const [updated] = await db
      .update(photos)
      .set({ caption: newCaption })
      .where(eq(photos.id, photoId))
      .returning();

    return res.json(toSnakePhoto(updated));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id as string;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (photo.uploadedBy !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

    // Clear album cover reference before deleting — avoids FK orphan
    await db
      .update(albums)
      .set({ coverPhotoId: null })
      .where(eq(albums.coverPhotoId, photoId));

    // Delete DB record — cascades album_photos and reactions
    await db.delete(photos).where(eq(photos.id, photoId));

    // Delete R2 objects after DB delete succeeds
    await deleteObject(photo.r2Key);
    if (photo.thumbnailKey) await deleteObject(photo.thumbnailKey);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export = router;


