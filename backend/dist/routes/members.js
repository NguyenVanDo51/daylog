"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router({ mergeParams: true });
router.use(auth_1.requireAuth);
router.get('/', async (req, res, next) => {
    try {
        const albumId = req.params.id;
        const membership = await db_1.db
            .select({ x: (0, drizzle_orm_1.sql) `1` })
            .from(schema_1.albumMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!membership[0])
            return res.status(403).json({ error: 'Forbidden' });
        const rows = await db_1.db
            .select({
            id: schema_1.users.id,
            display_name: schema_1.users.displayName,
            avatar_url: schema_1.users.avatarUrl,
            role: schema_1.albumMembers.role,
            joined_at: schema_1.albumMembers.joinedAt,
        })
            .from(schema_1.users)
            .innerJoin(schema_1.albumMembers, (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.albumMembers.joinedAt));
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=members.js.map