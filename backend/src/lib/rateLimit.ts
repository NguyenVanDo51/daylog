import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// 10 req/min per IP — for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

// 30 req/min per authenticated user — for presign endpoint
// Applied after requireAuth so req.user is available
export const presignLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) =>
    (req as Express.Request).user?.id ?? (req.ip ? ipKeyGenerator(req.ip) : 'anonymous'),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  validate: { trustProxy: false },
});

// 5 req/min per IP — for unauthenticated invite lookup
export const inviteLookupLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

// 100 req/min per IP — global fallback
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
