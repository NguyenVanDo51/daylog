import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { users, albums, albumMembers } from '../db/schema';
import { verifyAppleToken } from '../services/appleAuth';
import { verifyGoogleToken } from '../services/googleAuth';
import { requireAuth } from '../middleware/auth';
import { resolveAvatarUrl } from '../lib/mediaUtils';

const router = Router();

async function ensureDefaultAlbum(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [album] = await tx
      .insert(albums)
      .values({ name: 'Ảnh của tôi', createdBy: userId, isPrivate: true })
      .onConflictDoNothing() // check conflict by albums_created_by_private_uniq, if adding a new private album => album.created must be unique
      .returning({ id: albums.id });
    if (!album) return; // already existed
    await tx.insert(albumMembers).values({ albumId: album.id, userId, role: 'admin' });
  });
}

function signJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

async function toSnakeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    apple_sub: u.appleSub,
    google_sub: u.googleSub,
    display_name: u.displayName,
    email: u.email ?? '',
    avatar_url: await resolveAvatarUrl(u.avatarUrl),
    push_token: u.pushToken,
    created_at: u.createdAt,
  };
}

router.post('/apple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, pushToken } = req.body ?? {};
    if (!idToken) return next(Object.assign(new Error('idToken required'), { status: 400 }));

    const { sub, name, email } = await verifyAppleToken(idToken);
    const displayName = name || 'Member';

    let user: typeof users.$inferSelect;

    // Fast path: already linked to this Apple account
    const [bySub] = await db.select().from(users).where(eq(users.appleSub, sub));
    if (bySub) {
      const [updated] = await db.update(users).set({
        displayName,
        // Only fill in email if the user doesn't have one yet — avoids unique
        // constraint collision when the new email already belongs to another account
        email: bySub.email ?? email,
        pushToken: pushToken ?? bySub.pushToken,
      }).where(eq(users.id, bySub.id)).returning();
      user = updated;
    } else if (email) {
      // Upsert by email — links cross-provider accounts or creates new user
      const [upserted] = await db.insert(users)
        .values({ appleSub: sub, displayName, avatarUrl: null, pushToken: pushToken ?? null, email })
        .onConflictDoUpdate({
          target: users.email,
          targetWhere: sql`email IS NOT NULL`,
          set: {
            appleSub: sub,
            displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
            pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
          },
        })
        .returning();
      user = upserted;
    } else {
      // No email available: fall back to apple_sub upsert
      const [upserted] = await db.insert(users)
        .values({ appleSub: sub, displayName, avatarUrl: null, pushToken: pushToken ?? null })
        .onConflictDoUpdate({
          target: users.appleSub,
          set: {
            displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
            pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
          },
        })
        .returning();
      user = upserted;
    }

    await ensureDefaultAlbum(user.id);
    res.json({ token: signJwt(user.id), user: await toSnakeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, pushToken } = req.body ?? {};
    if (!idToken) return next(Object.assign(new Error('idToken required'), { status: 400 }));

    const { sub, name, picture, email } = await verifyGoogleToken(idToken);
    const displayName = name || 'Member';

    let user: typeof users.$inferSelect;

    // Fast path: already linked to this Google account
    const [bySub] = await db.select().from(users).where(eq(users.googleSub, sub));
    if (bySub) {
      const [updated] = await db.update(users).set({
        displayName,
        avatarUrl: picture ?? bySub.avatarUrl,
        // Only fill in email if the user doesn't have one yet — avoids unique
        // constraint collision when the new email already belongs to another account
        email: bySub.email ?? email,
        pushToken: pushToken ?? bySub.pushToken,
      }).where(eq(users.id, bySub.id)).returning();
      user = updated;
    } else if (email) {
      // Upsert by email — links cross-provider accounts or creates new user
      const [upserted] = await db.insert(users)
        .values({ googleSub: sub, displayName, avatarUrl: picture ?? null, pushToken: pushToken ?? null, email })
        .onConflictDoUpdate({
          target: users.email,
          targetWhere: sql`email IS NOT NULL`,
          set: {
            googleSub: sub,
            displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
            avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${users.avatarUrl})`,
            pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
          },
        })
        .returning();
      user = upserted;
    } else {
      // No email: fall back to google_sub upsert (Google always returns email, so rarely hit)
      const [upserted] = await db.insert(users)
        .values({ googleSub: sub, displayName, avatarUrl: picture ?? null, pushToken: pushToken ?? null })
        .onConflictDoUpdate({
          target: users.googleSub,
          set: {
            displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
            avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${users.avatarUrl})`,
            pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
          },
        })
        .returning();
      user = upserted;
    }

    await ensureDefaultAlbum(user.id);
    res.json({ token: signJwt(user.id), user: await toSnakeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.update(users).set({ pushToken: null }).where(eq(users.id, req.user!.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export = router;
