import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

// Augment Express's Request to include `user`. Put this in a global declaration so
// route handlers can use `req.user.id` without casting.
declare global {
  namespace Express {
    interface Request {
      user?: typeof users.$inferSelect;
    }
  }
}

interface JwtClaims {
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice('Bearer '.length);

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  let claims: JwtClaims;
  try {
    claims = jwt.verify(token, secret) as JwtClaims;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const found = await db
    .select()
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);

  if (!found[0]) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.user = found[0];
  Sentry.setUser({ id: found[0].id });
  next();
}
