import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { push_token } = req.body ?? {};
    const token = typeof push_token === 'string' ? push_token : null;
    await db.update(users).set({ pushToken: token }).where(eq(users.id, req.user!.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export = router;
