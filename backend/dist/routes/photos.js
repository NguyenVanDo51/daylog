"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const r2_1 = require("../services/r2");
const thumbnail_1 = require("../services/thumbnail");
const push_1 = require("../services/push");
const validation_1 = require("../lib/validation");
const albumGuards_1 = require("../lib/albumGuards");
const rateLimit_1 = require("../lib/rateLimit");
const router = express_1.default.Router();
router.use(auth_1.requireAuth);
const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'video/mp4'];
async function requireMember(albumId, userId) {
    const rows = await db_1.db
        .select({ x: (0, drizzle_orm_1.sql) `1` })
        .from(schema_1.albumMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, userId)))
        .limit(1);
    return rows.length > 0;
}
function toSnakePhoto(p) {
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
router.post('/presign', rateLimit_1.presignLimiter, async (req, res, next) => {
    try {
        const { album_id, content_type = 'image/webp' } = req.body ?? {};
        if (album_id) {
            if (!(0, validation_1.isValidUUID)(album_id)) {
                return res.status(400).json({ error: 'album_id must be a valid UUID' });
            }
            if (!(await requireMember(album_id, req.user.id))) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }
        if (!ALLOWED_CONTENT_TYPES.includes(content_type)) {
            return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` });
        }
        const { url, key } = await (0, r2_1.getPresignedPutUrl)(content_type);
        await db_1.db.insert(schema_1.presignTokens).values({ key, userId: req.user.id });
        return res.json({ url, key });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { album_ids, r2_key, taken_at, caption, local_asset_id, media_type = 'photo', source = 'upload', duration_ms, thumbnail_r2_key, width: clientWidth, height: clientHeight, } = req.body ?? {};
        if (!Array.isArray(album_ids) || album_ids.length === 0) {
            return res.status(400).json({ error: 'album_ids must be a non-empty array' });
        }
        if (!r2_key || !taken_at) {
            return res.status(400).json({ error: 'album_ids, r2_key, taken_at required' });
        }
        if (!(0, validation_1.isValidDate)(taken_at)) {
            return res.status(400).json({ error: 'taken_at must be a valid ISO date' });
        }
        if (!['photo', 'video'].includes(media_type)) {
            return res.status(400).json({ error: 'media_type must be photo or video' });
        }
        if (!['capture', 'upload'].includes(source)) {
            return res.status(400).json({ error: 'source must be capture or upload' });
        }
        const typedMediaType = media_type;
        const typedSource = source;
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
        const memberChecks = await Promise.all(album_ids.map((albumId) => requireMember(albumId, req.user.id)));
        if (memberChecks.some((isMember) => !isMember)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const archiveChecks = await Promise.all(album_ids.map((albumId) => (0, albumGuards_1.isAlbumArchived)(albumId)));
        if (archiveChecks.some((archived) => archived)) {
            return res.status(409).json({ error: 'Album is archived' });
        }
        const primaryAlbumId = album_ids[0];
        // Idempotency check first — before consuming a presign token
        if (local_asset_id) {
            const existing = await db_1.db
                .select()
                .from(schema_1.photos)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photos.albumId, primaryAlbumId), (0, drizzle_orm_1.eq)(schema_1.photos.localAssetId, local_asset_id), (0, drizzle_orm_1.eq)(schema_1.photos.uploadedBy, req.user.id)))
                .limit(1);
            if (existing[0])
                return res.status(200).json(toSnakePhoto(existing[0]));
        }
        // Verify main r2_key ownership (outside tx — bail early before opening a transaction)
        const [token] = await db_1.db
            .select()
            .from(schema_1.presignTokens)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.presignTokens.key, r2_key), (0, drizzle_orm_1.eq)(schema_1.presignTokens.userId, req.user.id)))
            .limit(1);
        if (!token) {
            return res.status(400).json({ error: 'Invalid or unrecognized r2_key' });
        }
        // Verify thumbnail token for videos before opening the transaction
        let thumbTokenValid = true;
        if (typedMediaType === 'video') {
            const [thumbToken] = await db_1.db
                .select()
                .from(schema_1.presignTokens)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.presignTokens.key, thumbnail_r2_key), (0, drizzle_orm_1.eq)(schema_1.presignTokens.userId, req.user.id)))
                .limit(1);
            if (!thumbToken) {
                thumbTokenValid = false;
            }
        }
        if (!thumbTokenValid) {
            return res.status(400).json({ error: 'Invalid or unrecognized thumbnail_r2_key' });
        }
        // Wrap token deletions + insert in a transaction so a failed insert doesn't consume tokens
        const [photo] = await db_1.db.transaction(async (tx) => {
            await tx.delete(schema_1.presignTokens).where((0, drizzle_orm_1.eq)(schema_1.presignTokens.key, r2_key));
            // Thumbnail: server-generated for photos, client-provided for videos
            let thumbnailKey;
            let photoWidth = null;
            let photoHeight = null;
            if (typedMediaType === 'video') {
                await tx.delete(schema_1.presignTokens).where((0, drizzle_orm_1.eq)(schema_1.presignTokens.key, thumbnail_r2_key));
                thumbnailKey = thumbnail_r2_key;
                photoWidth = Number.isInteger(clientWidth) && clientWidth > 0 ? clientWidth : null;
                photoHeight = Number.isInteger(clientHeight) && clientHeight > 0 ? clientHeight : null;
            }
            else {
                const result = await (0, thumbnail_1.generateThumbnail)(r2_key);
                thumbnailKey = result.key;
                photoWidth = result.width;
                photoHeight = result.height;
            }
            const inserted = await tx
                .insert(schema_1.photos)
                .values({
                albumId: primaryAlbumId,
                uploadedBy: req.user.id,
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
            await tx.insert(schema_1.albumPhotos).values(album_ids.map((albumId) => ({
                photoId: inserted[0].id,
                albumId: albumId,
            })));
            return inserted;
        });
        // Push notification (send to primary album members)
        const recipients = await db_1.db
            .select({ token: schema_1.users.pushToken })
            .from(schema_1.users)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, primaryAlbumId), (0, drizzle_orm_1.isNotNull)(schema_1.users.pushToken), (0, drizzle_orm_1.ne)(schema_1.users.id, req.user.id)));
        const tokens = recipients.map((r) => r.token).filter(Boolean);
        const pushTitle = typedSource === 'capture' ? 'Khoảnh khắc mới' : 'Ảnh mới';
        const pushBody = typedSource === 'capture'
            ? `${req.user.displayName} vừa gửi một khoảnh khắc`
            : `${req.user.displayName} đã thêm ảnh mới`;
        (0, push_1.sendPush)(tokens, pushTitle, pushBody, { photoId: photo.id }).catch(console.error);
        return res.status(201).json(toSnakePhoto(photo));
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/full', async (req, res, next) => {
    try {
        const photoId = req.params.id;
        if (!(0, validation_1.isValidUUID)(photoId))
            return res.status(404).json({ error: 'Not found' });
        const [photo] = await db_1.db
            .select({ r2Key: schema_1.photos.r2Key, mediaType: schema_1.photos.mediaType })
            .from(schema_1.photos)
            .where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId))
            .limit(1);
        if (!photo)
            return res.status(404).json({ error: 'Not found' });
        const [member] = await db_1.db
            .select({ x: (0, drizzle_orm_1.sql) `1` })
            .from(schema_1.albumPhotos)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.albumPhotos.albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.albumPhotos.photoId, photoId))
            .limit(1);
        if (!member)
            return res.status(403).json({ error: 'Forbidden' });
        const ext = photo.r2Key.split('.').pop()?.toLowerCase();
        const contentType = ext === 'mp4' ? 'video/mp4' : ext === 'jpg' ? 'image/jpeg' : 'image/webp';
        const buffer = await (0, r2_1.getObjectBuffer)(photo.r2Key);
        res.setHeader('Content-Type', contentType);
        res.send(buffer);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/thumb', async (req, res, next) => {
    try {
        const photoId = req.params.id;
        if (!(0, validation_1.isValidUUID)(photoId))
            return res.status(404).json({ error: 'Not found' });
        const [photo] = await db_1.db
            .select({ thumbnailKey: schema_1.photos.thumbnailKey })
            .from(schema_1.photos)
            .where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId))
            .limit(1);
        if (!photo || !photo.thumbnailKey)
            return res.status(404).json({ error: 'Not found' });
        const [member] = await db_1.db
            .select({ x: (0, drizzle_orm_1.sql) `1` })
            .from(schema_1.albumPhotos)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.albumPhotos.albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.albumPhotos.photoId, photoId))
            .limit(1);
        if (!member)
            return res.status(403).json({ error: 'Forbidden' });
        const buffer = await (0, r2_1.getObjectBuffer)(photo.thumbnailKey);
        const thumbExt = photo.thumbnailKey.split('.').pop()?.toLowerCase();
        const thumbContentType = thumbExt === 'jpg' ? 'image/jpeg' : 'image/webp';
        res.setHeader('Content-Type', thumbContentType);
        res.send(buffer);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id', async (req, res, next) => {
    try {
        const photoId = req.params.id;
        if (!(0, validation_1.isValidUUID)(photoId))
            return res.status(404).json({ error: 'Not found' });
        const [photo] = await db_1.db
            .select()
            .from(schema_1.photos)
            .where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId))
            .limit(1);
        if (!photo)
            return res.status(404).json({ error: 'Not found' });
        if (photo.uploadedBy !== req.user.id)
            return res.status(403).json({ error: 'Forbidden' });
        if (await (0, albumGuards_1.isAlbumArchived)(photo.albumId)) {
            return res.status(409).json({ error: 'Album is archived' });
        }
        const { caption } = req.body ?? {};
        const newCaption = (typeof caption === 'string' && caption.length > 0) ? caption : null;
        const [updated] = await db_1.db
            .update(schema_1.photos)
            .set({ caption: newCaption })
            .where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId))
            .returning();
        return res.json(toSnakePhoto(updated));
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const photoId = req.params.id;
        if (!(0, validation_1.isValidUUID)(photoId))
            return res.status(404).json({ error: 'Not found' });
        const [photo] = await db_1.db
            .select()
            .from(schema_1.photos)
            .where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId))
            .limit(1);
        if (!photo)
            return res.status(404).json({ error: 'Not found' });
        if (photo.uploadedBy !== req.user.id)
            return res.status(403).json({ error: 'Forbidden' });
        // Clear album cover reference before deleting — avoids FK orphan
        await db_1.db
            .update(schema_1.albums)
            .set({ coverPhotoId: null })
            .where((0, drizzle_orm_1.eq)(schema_1.albums.coverPhotoId, photoId));
        // Delete DB record — cascades album_photos and reactions
        await db_1.db.delete(schema_1.photos).where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId));
        // Delete R2 objects after DB delete succeeds
        await (0, r2_1.deleteObject)(photo.r2Key);
        if (photo.thumbnailKey)
            await (0, r2_1.deleteObject)(photo.thumbnailKey);
        return res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=photos.js.map