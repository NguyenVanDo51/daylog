"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = express_1.default.Router();
router.use(auth_1.requireAuth);
// Shape of an album row returned by these endpoints. Keys match the snake_case
// columns the original raw-SQL routes returned, since tests assert on them.
const albumSelect = {
    id: schema_1.albums.id,
    name: schema_1.albums.name,
    child_birthdate: schema_1.albums.childBirthdate,
    cover_photo_id: schema_1.albums.coverPhotoId,
    created_by: schema_1.albums.createdBy,
    created_at: schema_1.albums.createdAt,
};
router.post('/', async (req, res, next) => {
    try {
        const { name, child_birthdate } = req.body ?? {};
        if (!name) {
            res.status(400).json({ error: 'name required' });
            return;
        }
        const album = await db_1.db.transaction(async (tx) => {
            const [created] = await tx
                .insert(schema_1.albums)
                .values({
                name,
                childBirthdate: child_birthdate || null,
                createdBy: req.user.id,
            })
                .returning(albumSelect);
            await tx.insert(schema_1.albumMembers).values({
                albumId: created.id,
                userId: req.user.id,
                role: 'admin',
            });
            return created;
        });
        res.status(201).json(album);
    }
    catch (err) {
        next(err);
    }
});
router.get('/', async (req, res, next) => {
    try {
        const rows = await db_1.db
            .select(albumSelect)
            .from(schema_1.albums)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.albums.id))
            .where((0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.albums.createdAt));
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        const membership = await db_1.db
            .select()
            .from(schema_1.albumMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!membership[0]) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const rows = await db_1.db
            .select({
            ...albumSelect,
            member_count: (0, drizzle_orm_1.sql) `count(${schema_1.albumMembers.id})::int`,
        })
            .from(schema_1.albums)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, schema_1.albums.id))
            .where((0, drizzle_orm_1.eq)(schema_1.albums.id, albumId))
            .groupBy(schema_1.albums.id);
        if (!rows[0]) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        const membership = await db_1.db
            .select()
            .from(schema_1.albumMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!membership[0]) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { name, child_birthdate, cover_photo_id } = req.body ?? {};
        if (cover_photo_id) {
            const matchingPhotos = await db_1.db
                .select({ id: schema_1.photos.id })
                .from(schema_1.photos)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photos.id, cover_photo_id), (0, drizzle_orm_1.eq)(schema_1.photos.albumId, albumId)))
                .limit(1);
            if (!matchingPhotos[0]) {
                res.status(400).json({ error: 'cover_photo_id does not belong to this album' });
                return;
            }
        }
        // Mirror the original SQL's COALESCE semantics: only overwrite when a
        // truthy value is supplied. This matches `COALESCE($n, col)` with the JS
        // `value || null` argument coercion the old route used.
        const patch = {};
        if (name)
            patch.name = name;
        if (child_birthdate)
            patch.childBirthdate = child_birthdate;
        if (cover_photo_id)
            patch.coverPhotoId = cover_photo_id;
        let updated;
        if (Object.keys(patch).length === 0) {
            // No-op update: original SQL still executed UPDATE and RETURNING because
            // COALESCE(null, col) === col. Replicate by returning the current row.
            const rows = await db_1.db
                .select(albumSelect)
                .from(schema_1.albums)
                .where((0, drizzle_orm_1.eq)(schema_1.albums.id, albumId))
                .limit(1);
            updated = rows[0];
        }
        else {
            const rows = await db_1.db
                .update(schema_1.albums)
                .set(patch)
                .where((0, drizzle_orm_1.eq)(schema_1.albums.id, albumId))
                .returning(albumSelect);
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
module.exports = router;
//# sourceMappingURL=albums.js.map