import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { getPresignedPutUrl } from '../services/r2';
import { resolveAvatarUrl } from '../lib/mediaUtils';

const router = Router();

async function toClientUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    display_name: u.displayName,
    email: u.email ?? '',
    avatar_url: await resolveAvatarUrl(u.avatarUrl),
    push_token: u.pushToken,
  };
}

function signJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

function signRestoreJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId, purpose: 'restore' }, secret, { expiresIn: '30m' });
}

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await toClientUser(req.user!));
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    const updates: Partial<typeof users.$inferInsert> = {};
    if ('push_token' in body) updates.pushToken = typeof body.push_token === 'string' ? body.push_token : null;
    if ('display_name' in body && typeof body.display_name === 'string') {
      updates.displayName = body.display_name.trim() || req.user!.displayName;
    }
    if ('avatar_url' in body && (typeof body.avatar_url === 'string' || body.avatar_url === null)) {
      updates.avatarUrl = body.avatar_url;
    }
    if (Object.keys(updates).length === 0) return res.status(204).send();
    const [updated] = await db.update(users).set(updates).where(eq(users.id, req.user!.id)).returning();
    res.json(await toClientUser(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/me/avatar-presign', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, key } = await getPresignedPutUrl('image/jpeg');
    res.json({ upload_url: url, key });
  } catch (err) {
    next(err);
  }
});

router.delete('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, req.user!.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/me/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restore_token } = req.body ?? {};
    if (!restore_token) return res.status(401).json({ error: 'Unauthorized' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfigured' });
    let claims: { userId: string; purpose: string };
    try {
      claims = jwt.verify(restore_token, secret) as { userId: string; purpose: string };
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (claims.purpose !== 'restore') return res.status(401).json({ error: 'Unauthorized' });
    const [found] = await db.select().from(users).where(eq(users.id, claims.userId)).limit(1);
    if (!found) return res.status(401).json({ error: 'Unauthorized' });
    const [updated] = await db.update(users).set({ deletedAt: null }).where(eq(users.id, claims.userId)).returning();
    res.json({ token: signJwt(updated.id), user: await toClientUser(updated) });
  } catch (err) {
    next(err);
  }
});

router.get('/me/export', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: integrate email service to send actual data export link
    res.status(202).json({ message: `Export request received. We will email ${req.user!.email ?? 'you'} a download link.` });
  } catch (err) {
    next(err);
  }
});

export = router;
