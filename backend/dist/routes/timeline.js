"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = express_1.default.Router({ mergeParams: true });
router.use(auth_1.requireAuth);
router.get('/', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        const raw = Number(req.query.limit);
        const limit = Math.min(!isNaN(raw) && raw > 0 ? Math.floor(raw) : 20, 100);
        let cursor = null;
        if (req.query.cursor) {
            try {
                cursor = JSON.parse(Buffer.from(req.query.cursor, 'base64').toString());
            }
            catch {
                return res.status(400).json({ error: 'Invalid cursor' });
            }
        }
        const membership = await db_1.db
            .select({ x: (0, drizzle_orm_1.sql) `1` })
            .from(schema_1.albumMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!membership[0])
            return res.status(403).json({ error: 'Forbidden' });
        // Build the per-subquery cursor predicates. When no cursor, these collapse
        // to empty SQL fragments so the WHERE keeps just the album_id filter.
        const photoCursorClause = cursor
            ? (0, drizzle_orm_1.sql) `AND (taken_at < ${cursor.event_time} OR (taken_at = ${cursor.event_time} AND id < ${cursor.id}))`
            : (0, drizzle_orm_1.sql) ``;
        const milestoneCursorClause = cursor
            ? (0, drizzle_orm_1.sql) `AND (occurred_at < ${cursor.event_time} OR (occurred_at = ${cursor.event_time} AND id < ${cursor.id}))`
            : (0, drizzle_orm_1.sql) ``;
        const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
      SELECT id, 'photo' AS type, taken_at AS event_time,
             r2_key, thumbnail_key, caption, uploaded_by AS user_id,
             local_asset_id, NULL AS title, NULL AS note
      FROM photos
      WHERE album_id = ${albumId} ${photoCursorClause}

      UNION ALL

      SELECT id, 'milestone' AS type, occurred_at AS event_time,
             NULL, NULL, NULL, created_by AS user_id,
             NULL, title, note
      FROM milestones
      WHERE album_id = ${albumId} ${milestoneCursorClause}

      ORDER BY event_time DESC, id DESC
      LIMIT ${limit + 1}
    `);
        const rows = result.rows;
        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore
            ? Buffer.from(JSON.stringify({
                event_time: items[items.length - 1].event_time,
                id: items[items.length - 1].id,
            })).toString('base64')
            : null;
        res.json({ items, next_cursor: nextCursor });
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=timeline.js.map