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
const router = express_1.default.Router();
router.use(auth_1.requireAuth);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    };
}
router.post('/presign', async (req, res, next) => {
    try {
        const { album_id } = req.body ?? {};
        if (!album_id)
            return res.status(400).json({ error: 'album_id required' });
        if (!UUID_RE.test(album_id)) {
            return res.status(400).json({ error: 'album_id must be a valid UUID' });
        }
        if (!(await requireMember(album_id, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { url, key } = await (0, r2_1.getPresignedPutUrl)();
        return res.json({ url, key });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { album_id, r2_key, taken_at, caption, local_asset_id } = req.body ?? {};
        if (!album_id || !r2_key || !taken_at) {
            return res.status(400).json({ error: 'album_id, r2_key, taken_at required' });
        }
        if (!UUID_RE.test(album_id)) {
            return res.status(400).json({ error: 'album_id must be a valid UUID' });
        }
        if (!(await requireMember(album_id, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (local_asset_id) {
            const existing = await db_1.db
                .select()
                .from(schema_1.photos)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photos.albumId, album_id), (0, drizzle_orm_1.eq)(schema_1.photos.localAssetId, local_asset_id), (0, drizzle_orm_1.eq)(schema_1.photos.uploadedBy, req.user.id)))
                .limit(1);
            if (existing[0])
                return res.status(200).json(toSnakePhoto(existing[0]));
        }
        const thumbnailKey = await (0, thumbnail_1.generateThumbnail)(r2_key);
        const [photo] = await db_1.db
            .insert(schema_1.photos)
            .values({
            albumId: album_id,
            uploadedBy: req.user.id,
            r2Key: r2_key,
            thumbnailKey,
            takenAt: new Date(taken_at),
            caption: caption ?? null,
            localAssetId: local_asset_id ?? null,
        })
            .returning();
        const recipients = await db_1.db
            .select({ token: schema_1.users.apnsToken })
            .from(schema_1.users)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, album_id), (0, drizzle_orm_1.isNotNull)(schema_1.users.apnsToken), (0, drizzle_orm_1.ne)(schema_1.users.id, req.user.id)));
        const tokens = recipients.map((r) => r.token).filter(Boolean);
        (0, apns_1.sendPush)(tokens, 'New photo added', `${req.user.displayName} added a new photo`, { photoId: photo.id }).catch(console.error);
        return res.status(201).json(toSnakePhoto(photo));
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=photos.js.map