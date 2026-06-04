"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const token = header.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ error: 'Server misconfigured' });
        return;
    }
    let claims;
    try {
        claims = jsonwebtoken_1.default.verify(token, secret);
    }
    catch {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const found = await db_1.db
        .select()
        .from(schema_1.users)
        .where((0, drizzle_orm_1.eq)(schema_1.users.id, claims.userId))
        .limit(1);
    if (!found[0]) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    req.user = found[0];
    next();
}
//# sourceMappingURL=auth.js.map