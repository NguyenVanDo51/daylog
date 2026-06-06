"use strict";
const express_1 = require("express");
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../lib/rateLimit");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const qrcode_1 = require("../services/qrcode");
const validation_1 = require("../lib/validation");
const router = (0, express_1.Router)();
const DEFAULT_INVITE_EXPIRES_DAYS = 7;
function generateToken() {
    return (0, crypto_1.randomBytes)(16).toString('base64url');
}
router.post('/albums/:albumId/invites', auth_1.requireAuth, async (req, res, next) => {
    try {
        const { albumId } = req.params;
        if (!(0, validation_1.isValidUUID)(albumId))
            return res.status(400).json({ error: 'Invalid albumId' });
        const { expires_in_days, max_uses } = req.body ?? {};
        const membership = await db_1.db
            .select({ x: (0, drizzle_orm_1.sql) `1` })
            .from(schema_1.albumMembers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.albumMembers.albumId, albumId), (0, drizzle_orm_1.eq)(schema_1.albumMembers.userId, req.user.id)))
            .limit(1);
        if (!membership[0])
            return res.status(403).json({ error: 'Forbidden' });
        const [albumRow] = await db_1.db
            .select({ isPrivate: schema_1.albums.isPrivate })
            .from(schema_1.albums)
            .where((0, drizzle_orm_1.eq)(schema_1.albums.id, albumId))
            .limit(1);
        if (!albumRow)
            return res.status(404).json({ error: 'Album not found' });
        if (albumRow.isPrivate)
            return res.status(403).json({ error: 'Cannot invite to a private album' });
        if (expires_in_days !== undefined) {
            const days = Number(expires_in_days);
            if (!Number.isInteger(days) || days < 1) {
                return res.status(400).json({ error: 'expires_in_days must be a positive integer' });
            }
        }
        if (max_uses !== undefined) {
            const uses = Number(max_uses);
            if (!Number.isInteger(uses) || uses < 1) {
                return res.status(400).json({ error: 'max_uses must be a positive integer' });
            }
        }
        const token = generateToken();
        const days = expires_in_days ?? DEFAULT_INVITE_EXPIRES_DAYS;
        const expiresAt = new Date(Date.now() + days * 86400000);
        await db_1.db.insert(schema_1.invites).values({
            albumId,
            token,
            createdBy: req.user.id,
            expiresAt: expiresAt ?? null,
            maxUses: max_uses ?? null,
        });
        const deepLink = `familyguy://join/${token}`;
        const qrCode = await (0, qrcode_1.generateQRCode)(deepLink);
        return res.status(201).json({
            token,
            deep_link: deepLink,
            qr_code: qrCode,
            expires_at: expiresAt ? expiresAt.toISOString() : null,
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/invites/:token', rateLimit_1.inviteLookupLimiter, async (req, res, next) => {
    try {
        const rows = await db_1.db
            .select({
            id: schema_1.invites.id,
            album_id: schema_1.invites.albumId,
            album_name: schema_1.albums.name,
            token: schema_1.invites.token,
            expires_at: schema_1.invites.expiresAt,
            max_uses: schema_1.invites.maxUses,
            use_count: schema_1.invites.useCount,
            created_by: schema_1.invites.createdBy,
        })
            .from(schema_1.invites)
            .innerJoin(schema_1.albums, (0, drizzle_orm_1.eq)(schema_1.albums.id, schema_1.invites.albumId))
            .where((0, drizzle_orm_1.eq)(schema_1.invites.token, req.params.token))
            .limit(1);
        if (!rows[0])
            return res.status(404).json({ error: 'Not found' });
        const invite = rows[0];
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Invite expired' });
        }
        if (invite.max_uses && invite.use_count >= invite.max_uses) {
            return res.status(410).json({ error: 'Invite limit reached' });
        }
        return res.json({
            album_id: invite.album_id,
            album_name: invite.album_name,
            expires_at: invite.expires_at,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/invites/:token/join', auth_1.requireAuth, async (req, res, next) => {
    try {
        const rows = await db_1.db
            .select()
            .from(schema_1.invites)
            .where((0, drizzle_orm_1.eq)(schema_1.invites.token, req.params.token))
            .limit(1);
        if (!rows[0])
            return res.status(404).json({ error: 'Not found' });
        const invite = rows[0];
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
            return res.status(410).json({ error: 'Invite expired' });
        }
        if (invite.maxUses && invite.useCount >= invite.maxUses) {
            return res.status(410).json({ error: 'Invite limit reached' });
        }
        await db_1.db.transaction(async (tx) => {
            const inserted = await tx
                .insert(schema_1.albumMembers)
                .values({ albumId: invite.albumId, userId: req.user.id, role: 'member' })
                .onConflictDoNothing()
                .returning({ id: schema_1.albumMembers.id });
            if (inserted.length > 0) {
                await tx
                    .update(schema_1.invites)
                    .set({ useCount: (0, drizzle_orm_1.sql) `${schema_1.invites.useCount} + 1` })
                    .where((0, drizzle_orm_1.eq)(schema_1.invites.id, invite.id));
            }
        });
        return res.json({ album_id: invite.albumId });
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
//# sourceMappingURL=invites.js.map