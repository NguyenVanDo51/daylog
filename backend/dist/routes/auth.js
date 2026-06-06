"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const appleAuth_1 = require("../services/appleAuth");
const googleAuth_1 = require("../services/googleAuth");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
async function ensureDefaultAlbum(userId) {
    await db_1.db.transaction(async (tx) => {
        const [album] = await tx
            .insert(schema_1.albums)
            .values({ name: 'Ảnh của tôi', createdBy: userId, isPrivate: true })
            .onConflictDoNothing()
            .returning({ id: schema_1.albums.id });
        if (!album)
            return; // already existed
        await tx.insert(schema_1.albumMembers).values({ albumId: album.id, userId, role: 'admin' });
    });
}
function signJwt(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET env var is required');
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: '7d' });
}
function toSnakeUser(u) {
    return {
        id: u.id,
        apple_sub: u.appleSub,
        google_sub: u.googleSub,
        display_name: u.displayName,
        avatar_url: u.avatarUrl,
        apns_token: u.apnsToken,
        created_at: u.createdAt,
    };
}
router.post('/apple', async (req, res, next) => {
    try {
        const { idToken, apnsToken } = req.body ?? {};
        if (!idToken)
            return res.status(400).json({ error: 'idToken required' });
        const { sub, name } = await (0, appleAuth_1.verifyAppleToken)(idToken);
        const displayName = name || 'Family Member';
        const [user] = await db_1.db
            .insert(schema_1.users)
            .values({
            appleSub: sub,
            displayName,
            avatarUrl: null,
            apnsToken: apnsToken ?? null,
        })
            .onConflictDoUpdate({
            target: schema_1.users.appleSub,
            set: {
                displayName: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.display_name, ${schema_1.users.displayName})`,
                avatarUrl: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.avatar_url, ${schema_1.users.avatarUrl})`,
                apnsToken: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.apns_token, ${schema_1.users.apnsToken})`,
            },
        })
            .returning();
        await ensureDefaultAlbum(user.id);
        res.json({ token: signJwt(user.id), user: toSnakeUser(user) });
    }
    catch (err) {
        next(err);
    }
});
router.post('/google', async (req, res, next) => {
    try {
        const { idToken, apnsToken } = req.body ?? {};
        if (!idToken)
            return res.status(400).json({ error: 'idToken required' });
        const { sub, name, picture } = await (0, googleAuth_1.verifyGoogleToken)(idToken);
        const displayName = name || 'Family Member';
        const [user] = await db_1.db
            .insert(schema_1.users)
            .values({
            googleSub: sub,
            displayName,
            avatarUrl: picture ?? null,
            apnsToken: apnsToken ?? null,
        })
            .onConflictDoUpdate({
            target: schema_1.users.googleSub,
            set: {
                displayName: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.display_name, ${schema_1.users.displayName})`,
                avatarUrl: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.avatar_url, ${schema_1.users.avatarUrl})`,
                apnsToken: (0, drizzle_orm_1.sql) `COALESCE(EXCLUDED.apns_token, ${schema_1.users.apnsToken})`,
            },
        })
            .returning();
        await ensureDefaultAlbum(user.id);
        res.json({ token: signJwt(user.id), user: toSnakeUser(user) });
    }
    catch (err) {
        next(err);
    }
});
router.post('/logout', auth_1.requireAuth, async (req, res, next) => {
    try {
        await db_1.db.update(schema_1.users).set({ apnsToken: null }).where((0, drizzle_orm_1.eq)(schema_1.users.id, req.user.id));
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=auth.js.map