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
const apns_1 = require("../services/apns");
const validation_1 = require("../lib/validation");
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
        if (!album_id)
            return res.status(400).json({ error: 'album_id required' });
        if (!(0, validation_1.isValidUUID)(album_id)) {
            return res.status(400).json({ error: 'album_id must be a valid UUID' });
        }
        if (!ALLOWED_CONTENT_TYPES.includes(content_type)) {
            return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` });
        }
        if (!(await requireMember(album_id, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
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
        const { album_id, r2_key, taken_at, caption, local_asset_id, media_type = 'photo', source = 'upload', duration_ms, thumbnail_r2_key, width: clientWidth, height: clientHeight, } = req.body ?? {};
        if (!album_id || !r2_key || !taken_at) {
            return res.status(400).json({ error: 'album_id, r2_key, taken_at required' });
        }
        if (!(0, validation_1.isValidUUID)(album_id)) {
            return res.status(400).json({ error: 'album_id must be a valid UUID' });
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
        if (!(await requireMember(album_id, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Rate limit: 30 min between captures per user
        if (typedSource === 'capture') {
            const [lastCapture] = await db_1.db
                .select({ createdAt: schema_1.photos.createdAt })
                .from(schema_1.photos)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photos.uploadedBy, req.user.id), (0, drizzle_orm_1.eq)(schema_1.photos.source, 'capture')))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.photos.createdAt))
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
            const existing = await db_1.db
                .select()
                .from(schema_1.photos)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photos.albumId, album_id), (0, drizzle_orm_1.eq)(schema_1.photos.localAssetId, local_asset_id), (0, drizzle_orm_1.eq)(schema_1.photos.uploadedBy, req.user.id)))
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
            return tx
                .insert(schema_1.photos)
                .values({
                albumId: album_id,
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
        });
        // Push notification
        const recipients = await db_1.db
            .select({ token: schema_1.users.apnsToken })
            .from(schema_1.users)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, album_id), (0, drizzle_orm_1.isNotNull)(schema_1.users.apnsToken), (0, drizzle_orm_1.ne)(schema_1.users.id, req.user.id)));
        const tokens = recipients.map((r) => r.token).filter(Boolean);
        const pushTitle = typedSource === 'capture' ? 'Khoảnh khắc mới' : 'Ảnh mới';
        const pushBody = typedSource === 'capture'
            ? `${req.user.displayName} vừa gửi một khoảnh khắc`
            : `${req.user.displayName} đã thêm ảnh mới`;
        (0, apns_1.sendPush)(tokens, pushTitle, pushBody, { photoId: photo.id }).catch(console.error);
        return res.status(201).json(toSnakePhoto(photo));
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=photos.js.map