import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { getPresignedGetUrl, getPresignedPutUrl } from '../services/r2';

const router = Router();

async function resolveAvatarUrl(url: string | null): Promise<string | null> {
  if (!url || url.startsWith('https://')) return url;
  return getPresignedGetUrl(url, 3600);
}

async function toClientUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    display_name: u.displayName,
    email: u.email ?? '',
    avatar_url: await resolveAvatarUrl(u.avatarUrl),
    push_token: u.pushToken,
  };
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
    if (!('push_token' in body)) {
      return res.status(204).send();
    }
    const token = typeof body.push_token === 'string' ? body.push_token : null;
    await db.update(users).set({ pushToken: token }).where(eq(users.id, req.user!.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export = router;
