"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../lib/validation");
const router = express_1.default.Router({ mergeParams: true });
router.use(auth_1.requireAuth);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
async function isAlbumMember(albumId, userId) {
    const rows = await db_1.db
        .select({ x: (0, drizzle_orm_1.sql) `1` })
        .from(schema_1.albumMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, userId)))
        .limit(1);
    return rows.length > 0;
}
router.get('/', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        if (!(0, validation_1.isValidUUID)(albumId))
            return res.status(400).json({ error: 'Invalid albumId' });
        const from = req.query.from;
        const to = req.query.to;
        if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
            return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
        }
        if (from > to)
            return res.status(400).json({ error: 'from must be ≤ to' });
        if (!(await isAlbumMember(albumId, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const rows = await db_1.db
            .select({
            date: schema_1.dayLabels.date,
            label: schema_1.dayLabels.label,
            updated_at: schema_1.dayLabels.updatedAt,
            updated_by: schema_1.dayLabels.updatedBy,
        })
            .from(schema_1.dayLabels)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.dayLabels.albumId, albumId), (0, drizzle_orm_1.between)(schema_1.dayLabels.date, from, to)))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.dayLabels.date));
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:date', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        const date = req.params.date;
        if (!(0, validation_1.isValidUUID)(albumId))
            return res.status(400).json({ error: 'Invalid albumId' });
        if (!dateRegex.test(date))
            return res.status(400).json({ error: 'Invalid date' });
        const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
        if (!label)
            return res.status(400).json({ error: 'label required' });
        if (label.length > 60)
            return res.status(400).json({ error: 'label too long (max 60 chars)' });
        if (!(await isAlbumMember(albumId, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const [row] = await db_1.db
            .insert(schema_1.dayLabels)
            .values({ albumId, date, label, updatedBy: req.user.id, updatedAt: new Date() })
            .onConflictDoUpdate({
            target: [schema_1.dayLabels.albumId, schema_1.dayLabels.date],
            set: { label, updatedBy: req.user.id, updatedAt: new Date() },
        })
            .returning({
            date: schema_1.dayLabels.date,
            label: schema_1.dayLabels.label,
            updated_at: schema_1.dayLabels.updatedAt,
            updated_by: schema_1.dayLabels.updatedBy,
        });
        res.json(row);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:date', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        const date = req.params.date;
        if (!(0, validation_1.isValidUUID)(albumId))
            return res.status(400).json({ error: 'Invalid albumId' });
        if (!dateRegex.test(date))
            return res.status(400).json({ error: 'Invalid date' });
        if (!(await isAlbumMember(albumId, req.user.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await db_1.db.delete(schema_1.dayLabels).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.dayLabels.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.dayLabels.date, date)));
        res.status(204).end();
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=day-labels.js.map