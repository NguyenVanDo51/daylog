"use strict";
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const apns_1 = require("../services/apns");
const validation_1 = require("../lib/validation");
const router = (0, express_1.Router)({ mergeParams: true });
const VALID_EMOJIS = ['❤️', '😂', '😍', '🥹'];
async function requirePhotoMember(photoId, userId) {
    const rows = await db_1.db
        .select({ x: (0, drizzle_orm_1.sql) `1` })
        .from(schema_1.photos)
        .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.photos.albumId))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, userId)))
        .limit(1);
    return rows.length > 0;
}
router.get('/', auth_1.requireAuth, async (req, res) => {
    const photoId = req.params.photoId;
    if (!(0, validation_1.isValidUUID)(photoId))
        return res.status(400).json({ error: 'Invalid photoId' });
    if (!(await requirePhotoMember(photoId, req.user.id))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const rows = await db_1.db
            .select({ emoji: schema_1.reactions.emoji, count: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(schema_1.reactions)
            .where((0, drizzle_orm_1.eq)(schema_1.reactions.photoId, photoId))
            .groupBy(schema_1.reactions.emoji);
        res.json(rows);
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch reactions' });
    }
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    const photoId = req.params.photoId;
    const userId = req.user.id;
    const { emoji } = req.body;
    if (!(0, validation_1.isValidUUID)(photoId))
        return res.status(400).json({ error: 'Invalid photoId' });
    if (!VALID_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: 'Invalid emoji' });
    }
    if (!(await requirePhotoMember(photoId, userId))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        await db_1.db
            .insert(schema_1.reactions)
            .values({ photoId, userId, emoji })
            .onConflictDoUpdate({
            target: [schema_1.reactions.photoId, schema_1.reactions.userId],
            set: { emoji },
        });
        const [photo] = await db_1.db
            .select({ uploadedBy: schema_1.photos.uploadedBy })
            .from(schema_1.photos)
            .where((0, drizzle_orm_1.eq)(schema_1.photos.id, photoId));
        if (photo && photo.uploadedBy && photo.uploadedBy !== userId) {
            const [uploader] = await db_1.db
                .select({ apnsToken: schema_1.users.apnsToken })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, photo.uploadedBy));
            if (uploader?.apnsToken) {
                (0, apns_1.sendPush)([uploader.apnsToken], 'Có reaction mới!', `Ai đó đã gửi ${emoji} cho ảnh của bé`, { photoId }).catch(() => { });
            }
        }
        return res.status(201).json({ ok: true });
    }
    catch {
        return res.status(500).json({ error: 'Failed to upsert reaction' });
    }
});
router.delete('/', auth_1.requireAuth, async (req, res) => {
    const photoId = req.params.photoId;
    const userId = req.user.id;
    if (!(0, validation_1.isValidUUID)(photoId))
        return res.status(400).json({ error: 'Invalid photoId' });
    if (!(await requirePhotoMember(photoId, userId))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        await db_1.db.delete(schema_1.reactions).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reactions.photoId, photoId), (0, drizzle_orm_1.eq)(schema_1.reactions.userId, userId)));
        res.status(204).send();
    }
    catch {
        res.status(500).json({ error: 'Failed to delete reaction' });
    }
});
module.exports = router;
//# sourceMappingURL=reactions.js.map