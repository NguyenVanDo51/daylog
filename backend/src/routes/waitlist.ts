import { Router } from 'express';
import { db } from '../db';
import { waitlist } from '../db/schema';
import { inviteLookupLimiter } from '../lib/rateLimit';

const router = Router();

router.post('/', inviteLookupLimiter, async (req, res) => {
  const { email } = req.body as { email?: unknown };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const normalized = email.trim().toLowerCase();

  try {
    await db.insert(waitlist).values({ email: normalized });
    return res.status(201).json({ message: 'ok' });
  } catch (err: unknown) {
    const pgCode = (err as { cause?: { code?: string } }).cause?.code;
    if (pgCode === '23505') {
      return res.status(409).json({ error: 'already_registered' });
    }
    throw err;
  }
});

export default router;
