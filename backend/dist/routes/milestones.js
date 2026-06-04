"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const apns_1 = require("../services/apns");
const router = express_1.default.Router();
// Selecting these columns aliased to snake_case keeps the response shape that
// the existing tests assert on (id, album_id, created_by, title, note,
// occurred_at, cover_photo_id, created_at).
const milestoneSelect = {
    id: schema_1.milestones.id,
    album_id: schema_1.milestones.albumId,
    created_by: schema_1.milestones.createdBy,
    title: schema_1.milestones.title,
    note: schema_1.milestones.note,
    occurred_at: schema_1.milestones.occurredAt,
    cover_photo_id: schema_1.milestones.coverPhotoId,
    created_at: schema_1.milestones.createdAt,
};
async function isAlbumMember(albumId, userId) {
    const rows = await db_1.db
        .select({ x: (0, drizzle_orm_1.sql) `1` })
        .from(schema_1.albumMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, userId)))
        .limit(1);
    return rows.length > 0;
}
router.post('/albums/:albumId/milestones', auth_1.requireAuth, async (req, res, next) => {
    try {
        const albumId = req.params.albumId;
        const { title, note, occurred_at, cover_photo_id } = req.body ?? {};
        if (!title || !occurred_at) {
            res.status(400).json({ error: 'title and occurred_at required' });
            return;
        }
        if (!(await isAlbumMember(albumId, req.user.id))) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const [milestone] = await db_1.db
            .insert(schema_1.milestones)
            .values({
            albumId,
            createdBy: req.user.id,
            title,
            note: note ?? null,
            occurredAt: new Date(occurred_at),
            coverPhotoId: cover_photo_id ?? null,
        })
            .returning(milestoneSelect);
        const recipients = await db_1.db
            .select({ token: schema_1.users.apnsToken })
            .from(schema_1.users)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.isNotNull)(schema_1.users.apnsToken), (0, drizzle_orm_1.ne)(schema_1.users.id, req.user.id)));
        const tokens = recipients.map((r) => r.token).filter(Boolean);
        (0, apns_1.sendPush)(tokens, 'New milestone!', `${req.user.displayName} added: ${title}`, {
            milestoneId: milestone.id,
        }).catch(console.error);
        res.status(201).json(milestone);
    }
    catch (err) {
        next(err);
    }
});
router.get('/albums/:albumId/milestones', auth_1.requireAuth, async (req, res, next) => {
    try {
        const albumId = req.params.albumId;
        if (!(await isAlbumMember(albumId, req.user.id))) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const rows = await db_1.db
            .select(milestoneSelect)
            .from(schema_1.milestones)
            .where((0, drizzle_orm_1.eq)(schema_1.milestones.albumId, albumId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.milestones.occurredAt));
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/milestones/:id', auth_1.requireAuth, async (req, res, next) => {
    try {
        const milestoneId = req.params.id;
        // Access check: caller must be a member of the milestone's owning album.
        const existing = await db_1.db
            .select({ id: schema_1.milestones.id })
            .from(schema_1.milestones)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.milestones.albumId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.milestones.id, milestoneId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
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
        const patch = {};
        if (title !== undefined && title !== null)
            patch.title = title;
        if (note !== undefined && note !== null)
            patch.note = note;
        if (occurred_at !== undefined && occurred_at !== null) {
            patch.occurredAt = new Date(occurred_at);
        }
        if (cover_photo_id !== undefined && cover_photo_id !== null) {
            patch.coverPhotoId = cover_photo_id;
        }
        let updated;
        if (Object.keys(patch).length === 0) {
            const rows = await db_1.db
                .select(milestoneSelect)
                .from(schema_1.milestones)
                .where((0, drizzle_orm_1.eq)(schema_1.milestones.id, milestoneId))
                .limit(1);
            updated = rows[0];
        }
        else {
            const rows = await db_1.db
                .update(schema_1.milestones)
                .set(patch)
                .where((0, drizzle_orm_1.eq)(schema_1.milestones.id, milestoneId))
                .returning(milestoneSelect);
            updated = rows[0];
        }
        if (!updated) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/milestones/:id', auth_1.requireAuth, async (req, res, next) => {
    try {
        const milestoneId = req.params.id;
        const existing = await db_1.db
            .select({ id: schema_1.milestones.id })
            .from(schema_1.milestones)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.milestones.albumId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.milestones.id, milestoneId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!existing[0]) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        await db_1.db.delete(schema_1.milestones).where((0, drizzle_orm_1.eq)(schema_1.milestones.id, milestoneId));
        res.status(204).end();
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=milestones.js.map