import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { inviteLookupLimiter } from '../lib/rateLimit';
import { db } from '../db';
import { invites, albums, albumMembers } from '../db/schema';
import { generateQRCode } from '../services/qrcode';
import { isValidUUID } from '../lib/validation';
import { isAlbumArchived } from '../lib/albumGuards';

const router = Router();

const DEFAULT_INVITE_EXPIRES_DAYS = 7;
const DEFAULT_INVITE_MAX_USES = 1000;

function generateToken(): string {
  return randomBytes(16).toString('base64url');
}

interface CreateInviteBody {
  expires_in_days?: number;
  max_uses?: number;
}

router.post(
  '/albums/:albumId/invites',
  requireAuth,
  async (req: Request<{ albumId: string }, unknown, CreateInviteBody>, res: Response, next: NextFunction) => {
    try {
      const { albumId } = req.params;
      if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
      const { expires_in_days, max_uses } = req.body ?? {};

      const membership = await db
        .select({ x: sql<number>`1` })
        .from(albumMembers)
        .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
        .limit(1);
      if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

      if (await isAlbumArchived(albumId)) {
        return res.status(409).json({ error: 'Album is archived' });
      }

      const [albumRow] = await db
        .select({ isPrivate: albums.isPrivate })
        .from(albums)
        .where(eq(albums.id, albumId))
        .limit(1);
      if (!albumRow) return res.status(404).json({ error: 'Album not found' });
      if (albumRow.isPrivate) return res.status(403).json({ error: 'Cannot invite to a private album' });

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

      await db.insert(invites).values({
        albumId,
        token,
        createdBy: req.user!.id,
        expiresAt: expiresAt ?? null,
        maxUses: max_uses ?? DEFAULT_INVITE_MAX_USES,
      });

      const deepLink = `familyguy://join/${token}`;
      const qrCode = await generateQRCode(deepLink);

      return res.status(201).json({
        token,
        deep_link: deepLink,
        qr_code: qrCode,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/invites/:token', inviteLookupLimiter, async (req: Request<{ token: string }>, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select({
        id: invites.id,
        album_id: invites.albumId,
        album_name: albums.name,
        token: invites.token,
        expires_at: invites.expiresAt,
        max_uses: invites.maxUses,
        use_count: invites.useCount,
        created_by: invites.createdBy,
      })
      .from(invites)
      .innerJoin(albums, eq(albums.id, invites.albumId))
      .where(eq(invites.token, req.params.token))
      .limit(1);

    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

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
  } catch (err) {
    next(err);
  }
});

router.post(
  '/invites/:token/join',
  requireAuth,
  async (req: Request<{ token: string }>, res: Response, next: NextFunction) => {
    try {
      const rows = await db
        .select()
        .from(invites)
        .where(eq(invites.token, req.params.token))
        .limit(1);
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });

      const invite = rows[0];
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'Invite expired' });
      }
      if (invite.maxUses && invite.useCount >= invite.maxUses) {
        return res.status(410).json({ error: 'Invite limit reached' });
      }

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(albumMembers)
          .values({ albumId: invite.albumId, userId: req.user!.id, role: 'member' })
          .onConflictDoNothing()
          .returning({ id: albumMembers.id });
        if (inserted.length > 0) {
          await tx
            .update(invites)
            .set({ useCount: sql`${invites.useCount} + 1` })
            .where(eq(invites.id, invite.id));
        }
      });

      return res.json({ album_id: invite.albumId });
    } catch (err) {
      next(err);
    }
  }
);

export = router;
