import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
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

export = router;
