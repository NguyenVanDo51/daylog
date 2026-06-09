import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { users, albums, albumMembers } from '../db/schema';
import { verifyAppleToken } from '../services/appleAuth';
import { verifyGoogleToken } from '../services/googleAuth';
import { requireAuth } from '../middleware/auth';

const router = Router();

async function ensureDefaultAlbum(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [album] = await tx
      .insert(albums)
      .values({ name: 'Ảnh của tôi', createdBy: userId, isPrivate: true })
      .onConflictDoNothing()
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

function toSnakeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    apple_sub: u.appleSub,
    google_sub: u.googleSub,
    display_name: u.displayName,
    avatar_url: u.avatarUrl,
    push_token: u.pushToken,
    created_at: u.createdAt,
  };
}

router.post('/apple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, pushToken } = req.body ?? {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const { sub, name } = await verifyAppleToken(idToken);
    const displayName = name || 'Family Member';

    const [user] = await db
      .insert(users)
      .values({
        appleSub: sub,
        displayName,
        avatarUrl: null,
        pushToken: pushToken ?? null,
      })
      .onConflictDoUpdate({
        target: users.appleSub,
        set: {
          displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
          avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${users.avatarUrl})`,
          pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
        },
      })
      .returning();

    await ensureDefaultAlbum(user.id);
    res.json({ token: signJwt(user.id), user: toSnakeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, pushToken } = req.body ?? {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const { sub, name, picture } = await verifyGoogleToken(idToken);
    const displayName = name || 'Family Member';

    const [user] = await db
      .insert(users)
      .values({
        googleSub: sub,
        displayName,
        avatarUrl: picture ?? null,
        pushToken: pushToken ?? null,
      })
      .onConflictDoUpdate({
        target: users.googleSub,
        set: {
          displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
          avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${users.avatarUrl})`,
          pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
        },
      })
      .returning();

    await ensureDefaultAlbum(user.id);
    res.json({ token: signJwt(user.id), user: toSnakeUser(user) });
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
