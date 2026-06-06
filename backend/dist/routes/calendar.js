"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const validation_1 = require("../lib/validation");
const router = express_1.default.Router({ mergeParams: true });
router.use(auth_1.requireAuth);
router.get('/', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        if (!(0, validation_1.isValidUUID)(albumId))
            return res.status(400).json({ error: 'Invalid albumId' });
        const year = parseInt(req.query.year, 10);
        const month = parseInt(req.query.month, 10);
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Invalid year or month' });
        }
        const membership = await db_1.db
            .select({ x: (0, drizzle_orm_1.sql) `1` })
            .from(schema_1.albumMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!membership[0])
            return res.status(403).json({ error: 'Forbidden' });
        const rows = await db_1.db.execute((0, drizzle_orm_1.sql) `
      SELECT
        TO_CHAR(taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
        BOOL_OR(source = 'upload')  AS has_upload,
        BOOL_OR(source = 'capture') AS has_capture
      FROM photos
      WHERE album_id = ${albumId}
        AND EXTRACT(YEAR  FROM taken_at AT TIME ZONE 'UTC') = ${year}
        AND EXTRACT(MONTH FROM taken_at AT TIME ZONE 'UTC') = ${month}
      GROUP BY day
      ORDER BY day
    `);
        const result = {};
        for (const row of rows.rows) {
            result[row.day] = { photo: row.has_upload, capture: row.has_capture };
        }
        const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const labelRows = await db_1.db
            .select({ date: schema_1.dayLabels.date, label: schema_1.dayLabels.label })
            .from(schema_1.dayLabels)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.dayLabels.albumId, albumId), (0, drizzle_orm_1.between)(schema_1.dayLabels.date, fromDate, toDate)));
        for (const r of labelRows) {
            if (!result[r.date]) {
                result[r.date] = { photo: false, capture: false };
            }
            result[r.date].label = r.label;
        }
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=calendar.js.map