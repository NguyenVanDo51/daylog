import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { verifyAppleToken } from '../services/appleAuth';
import { verifyGoogleToken } from '../services/googleAuth';

const router = Router();

function signJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId }, secret, { expiresIn: '30d' });
}

function toSnakeUser(u: typeof users.$inferSelect) {
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

router.post('/apple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, apnsToken } = req.body ?? {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const { sub, name } = await verifyAppleToken(idToken);
    const displayName = name || 'Family Member';

    const [user] = await db
      .insert(users)
      .values({
        appleSub: sub,
        displayName,
        avatarUrl: null,
        apnsToken: apnsToken ?? null,
      })
      .onConflictDoUpdate({
        target: users.appleSub,
        set: {
          displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
          avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${users.avatarUrl})`,
          apnsToken: sql`COALESCE(EXCLUDED.apns_token, ${users.apnsToken})`,
        },
      })
      .returning();

    res.json({ token: signJwt(user.id), user: toSnakeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, apnsToken } = req.body ?? {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const { sub, name, picture } = await verifyGoogleToken(idToken);
    const displayName = name || 'Family Member';

    const [user] = await db
      .insert(users)
      .values({
        googleSub: sub,
        displayName,
        avatarUrl: picture ?? null,
        apnsToken: apnsToken ?? null,
      })
      .onConflictDoUpdate({
        target: users.googleSub,
        set: {
          displayName: sql`COALESCE(EXCLUDED.display_name, ${users.displayName})`,
          avatarUrl: sql`COALESCE(EXCLUDED.avatar_url, ${users.avatarUrl})`,
          apnsToken: sql`COALESCE(EXCLUDED.apns_token, ${users.apnsToken})`,
        },
      })
      .returning();

    res.json({ token: signJwt(user.id), user: toSnakeUser(user) });
  } catch (err) {
    next(err);
  }
});

export = router;
