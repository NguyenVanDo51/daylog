# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 14 security vulnerabilities across authorization bypass, missing input validation, missing API hardening, and internal error leakage — all in the Express backend.

**Architecture:** All changes are in `backend/`. One new Drizzle table (`presign_tokens`) tracking issued presign keys per user. Authorization checks added inline in route handlers. Rate limiting and security headers applied in `app.ts`. No mobile changes.

**Tech Stack:** Express, helmet, cors, express-rate-limit, Drizzle ORM, Jest + supertest

**Spec:** `docs/superpowers/specs/2026-06-04-security-hardening-design.md`

---

## File Map

### New
- `backend/src/lib/validation.ts` — `isValidUUID`, `isValidDate` helpers (extracted from `photos.ts`)
- `backend/src/lib/rateLimit.ts` — rate limiter instances (auth, presign, invite, global)

### Modified
- `backend/package.json` — add helmet, cors, express-rate-limit; add @types/cors to devDeps
- `backend/src/app.ts` — helmet, cors, body limit, rate limiters, sanitized error handler
- `backend/src/db/schema.ts` — add `presignTokens` table
- `backend/src/middleware/auth.ts` — add `requireAlbumAdmin` helper
- `backend/src/routes/auth.ts` — JWT lifetime 30d→7d, add `POST /auth/logout`
- `backend/src/routes/photos.ts` — r2_key ownership check, UUID+date validation, import from lib/validation; reorder idempotency check before presign check
- `backend/src/routes/reactions.ts` — album membership check on all three handlers, UUID validation
- `backend/src/routes/albums.ts` — admin check on PATCH, UUID validation
- `backend/src/routes/members.ts` — UUID validation
- `backend/src/routes/milestones.ts` — UUID validation, cover_photo_id ownership check, admin check on DELETE
- `backend/src/routes/timeline.ts` — UUID validation
- `backend/src/routes/invites.ts` — expires_in_days/max_uses validation, UUID validation
- `backend/tests/setup.ts` — add `presign_tokens` to TRUNCATE, add `createTestAlbumMember` and `createPresignToken` helpers

---

## Task 1: Security middleware — helmet, cors, body limit, error handler

**Files:**
- Install: `backend/package.json`
- Modify: `backend/src/app.ts`
- Update test: `backend/src/routes/auth.test.ts` (two 500-body assertions must change)

- [ ] **Step 1: Install packages**

```bash
cd backend && npm install helmet cors express-rate-limit && npm install -D @types/cors
```

Expected: packages appear in `package.json` dependencies.

- [ ] **Step 2: Write failing tests for security headers and sanitized 500 error**

Add this new describe block at the top of `backend/src/routes/auth.test.ts`, right after the existing imports:

```ts
describe('Security middleware', () => {
  it('sets X-Content-Type-Options: nosniff header on all responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
```

Also update the two existing tests that assert on 500 error body — they currently assert the raw error message will be returned but after our fix they should see `'Internal server error'`:

In `describe('POST /auth/apple')`, change:
```ts
  it('returns 500 when verifyAppleToken rejects', async () => {
    mockVerifyApple.mockRejectedValueOnce(new Error('token expired'));
    const res = await request(app).post('/auth/apple').send({ idToken: 'bad-token' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');  // was: 'token expired'
  });
```

In `describe('POST /auth/google')`, change:
```ts
  it('returns 500 when verifyGoogleToken rejects', async () => {
    mockVerifyGoogle.mockRejectedValueOnce(new Error('invalid audience'));
    const res = await request(app).post('/auth/google').send({ idToken: 'bad-token' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');  // was: 'invalid audience'
  });
```

- [ ] **Step 3: Run failing tests**

```bash
cd backend && npx jest --testPathPattern="auth.test" --runInBand --forceExit
```

Expected: `Security middleware` block FAILS (X-Content-Type-Options header missing), two updated 500-body tests FAIL.

- [ ] **Step 4: Update app.ts**

Replace the full contents of `backend/src/app.ts`:

```ts
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/auth';
import albumsRoutes from './routes/albums';
import photosRoutes from './routes/photos';
import milestonesRoutes from './routes/milestones';
import invitesRoutes from './routes/invites';
import timelineRoutes from './routes/timeline';
import membersRoutes from './routes/members';
import reactionsRoutes from './routes/reactions';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/albums', albumsRoutes);
app.use('/photos', photosRoutes);
app.use('/', milestonesRoutes);
app.use('/', invitesRoutes);
app.use('/albums/:id/timeline', timelineRoutes);
app.use('/albums/:id/members', membersRoutes);
app.use('/photos/:photoId/reactions', reactionsRoutes);

interface HttpError extends Error {
  status?: number;
}

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  const message = status < 500 ? (err.message || 'Error') : 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

export = app;
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npx jest --testPathPattern="auth.test" --runInBand --forceExit
```

Expected: all tests PASS including the new security middleware block and the two updated 500-body tests.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/app.ts src/routes/auth.test.ts package.json package-lock.json && git commit -m "feat(backend): add helmet, cors, body limit, sanitize 500 errors"
```

---

## Task 2: Validation helpers

**Files:**
- Create: `backend/src/lib/validation.ts`
- Create: `backend/src/lib/validation.test.ts`
- Modify: `backend/src/routes/photos.ts` (remove duplicate `UUID_RE`, import from lib instead)

- [ ] **Step 1: Write failing tests**

Create `backend/src/lib/validation.test.ts`:

```ts
import { isValidUUID, isValidDate } from './validation';

describe('isValidUUID', () => {
  it('returns true for a valid lowercase UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for a valid uppercase UUID', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('returns false for a UUID missing a segment', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });
});

describe('isValidDate', () => {
  it('returns true for an ISO date string', () => {
    expect(isValidDate('2024-06-01T10:00:00Z')).toBe(true);
  });

  it('returns true for a date-only string', () => {
    expect(isValidDate('2024-06-01')).toBe(true);
  });

  it('returns false for a garbage string', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidDate('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && npx jest --testPathPattern="lib/validation.test" --runInBand --forceExit
```

Expected: FAIL — `Cannot find module './validation'`.

- [ ] **Step 3: Create the validation module**

Create `backend/src/lib/validation.ts`:

```ts
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(s: string): boolean {
  return UUID_RE.test(s);
}

export function isValidDate(s: string): boolean {
  if (!s) return false;
  return !isNaN(new Date(s).getTime());
}
```

- [ ] **Step 4: Update photos.ts to import from lib instead of re-defining**

In `backend/src/routes/photos.ts`, remove the local `UUID_RE` declaration and add the import:

Remove this line:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

Add after the existing imports:
```ts
import { isValidUUID } from '../lib/validation';
```

Then replace every occurrence of `UUID_RE.test(album_id)` with `isValidUUID(album_id)` and `UUID_RE.test(r2_key)` (if any) appropriately. The two locations in photos.ts are:

```ts
// presign route — replace:
if (!UUID_RE.test(album_id)) {
// with:
if (!isValidUUID(album_id)) {

// POST / route — replace:
if (!UUID_RE.test(album_id)) {
// with:
if (!isValidUUID(album_id)) {
```

- [ ] **Step 5: Run all tests to confirm nothing broke**

```bash
cd backend && npx jest --testPathPattern="(lib/validation|photos)" --runInBand --forceExit
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/lib/validation.ts src/lib/validation.test.ts src/routes/photos.ts && git commit -m "feat(backend): add isValidUUID and isValidDate helpers, remove duplicate UUID_RE"
```

---

## Task 3: Rate limiting

**Files:**
- Create: `backend/src/lib/rateLimit.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/photos.ts`

Rate limiters are skipped in `NODE_ENV=test` (via the `skip` option) so they don't interfere with the test suite, which sends many requests.

- [ ] **Step 1: Create rate limiter module**

Create `backend/src/lib/rateLimit.ts`:

```ts
import rateLimit from 'express-rate-limit';

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
  keyGenerator: (req) => (req as Express.Request).user?.id ?? req.ip ?? 'anonymous',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
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
```

- [ ] **Step 2: Apply global and auth limiters in app.ts**

In `backend/src/app.ts`, add the import and apply limiters after `express.json()`:

Add after the `cors` import:
```ts
import { authLimiter, globalLimiter } from './lib/rateLimit';
```

Add after `app.use(express.json({ limit: '100kb' }));`:
```ts
app.use(globalLimiter);
app.use('/auth', authLimiter);
```

The `/auth` limiter stacks on top of the global limiter for auth routes — that's intentional.

- [ ] **Step 3: Apply presign and invite limiters in their routes**

In `backend/src/routes/photos.ts`, add the import:
```ts
import { presignLimiter } from '../lib/rateLimit';
```

Update the presign route signature to include the limiter after `requireAuth`:
```ts
router.post('/presign', requireAuth, presignLimiter, async (req: Request, res: Response, next: NextFunction) => {
```

In `backend/src/routes/invites.ts`, add the import:
```ts
import { inviteLookupLimiter } from '../lib/rateLimit';
```

Apply to the unauthenticated GET route:
```ts
router.get('/invites/:token', inviteLookupLimiter, async (req: Request<{ token: string }>, res: Response, next: NextFunction) => {
```

- [ ] **Step 4: Run full test suite to confirm nothing broke**

```bash
cd backend && npm test
```

Expected: all tests PASS (rate limiters are skipped in test env).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/lib/rateLimit.ts src/app.ts src/routes/photos.ts src/routes/invites.ts && git commit -m "feat(backend): add rate limiting on auth, presign, invite, and global routes"
```

---

## Task 4: presign_tokens schema + Drizzle migration

**Files:**
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/tests/setup.ts`
- Run: drizzle-kit generate + migrate

- [ ] **Step 1: Add presignTokens to schema**

In `backend/src/db/schema.ts`, add after the `invites` table definition (at the end of the file):

```ts
export const presignTokens = pgTable('presign_tokens', {
  key: text('key').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 2: Generate and run migration**

```bash
cd backend && npm run migrate:generate && npm run migrate:push
```

Expected: a new migration file appears in `src/db/migrations/` and the `presign_tokens` table is created in the database.

- [ ] **Step 3: Add presign_tokens to test TRUNCATE and add helpers**

In `backend/tests/setup.ts`, update the TRUNCATE to include the new table:

```ts
// Change this line:
await db.execute(sql`TRUNCATE invites, milestones, photos, album_members, albums, users CASCADE`);
// To:
await db.execute(sql`TRUNCATE presign_tokens, invites, milestones, photos, album_members, albums, users CASCADE`);
```

Then add two new exports at the bottom of `backend/tests/setup.ts`. Add the missing imports first — find the import line for schema and add `presignTokens`, `albumMembers`:

The current import is:
```ts
import { users, albums, albumMembers } from '../src/db/schema';
```

Change it to:
```ts
import { users, albums, albumMembers, presignTokens } from '../src/db/schema';
```

Then add the two new helper functions at the end of the file:

```ts
export async function createTestAlbumMember(
  albumId: string,
  userId: string,
  role: 'admin' | 'member' = 'member'
): Promise<void> {
  await db.insert(albumMembers).values({ albumId, userId, role });
}

export async function createPresignToken(userId: string, key: string): Promise<void> {
  await db.insert(presignTokens).values({ key, userId });
}
```

- [ ] **Step 4: Run the test suite to confirm TRUNCATE still works**

```bash
cd backend && npm test
```

Expected: all tests PASS (adding `presign_tokens` to TRUNCATE should be harmless).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/db/schema.ts src/db/migrations/ tests/setup.ts && git commit -m "feat(backend): add presign_tokens table for r2_key ownership tracking"
```

---

## Task 5: Fix reactions authorization — album membership check

Any authenticated user can currently read/write reactions on photos in any album. Fix: verify the user is a member of the photo's album.

**Files:**
- Modify: `backend/src/routes/reactions.ts`
- Modify: `backend/src/routes/reactions.test.ts`

- [ ] **Step 1: Write failing 403 tests**

Add a new describe block at the top of `backend/src/routes/reactions.test.ts`, after the existing imports:

```ts
describe('Reactions authorization — non-member gets 403', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let photoId: string;

  beforeEach(async () => {
    owner = await createTestUser({ apple_sub: 'owner-reactions-auth' });
    const album = await createTestAlbum(owner.id);
    const photo = await createTestPhoto(album.id, owner.id);
    photoId = photo.id;
    outsider = await createTestUser({ apple_sub: 'outsider-reactions-auth' });
    mockSendPush.mockClear();
  });

  it('GET returns 403 when caller is not a member', async () => {
    const res = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(authHeader(outsider));
    expect(res.status).toBe(403);
  });

  it('POST returns 403 when caller is not a member', async () => {
    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(outsider))
      .send({ emoji: '❤️' });
    expect(res.status).toBe(403);
  });

  it('DELETE returns 403 when caller is not a member', async () => {
    const res = await request(app)
      .delete(`/photos/${photoId}/reactions`)
      .set(authHeader(outsider));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd backend && npx jest --testPathPattern="reactions.test" --runInBand --forceExit 2>&1 | tail -20
```

Expected: 3 new tests FAIL with 200/201/204 instead of 403.

- [ ] **Step 3: Add membership check to reactions.ts**

Replace the full contents of `backend/src/routes/reactions.ts`:

```ts
import { Router, Request, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { reactions, photos, users, albumMembers } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { sendPush } from '../services/apns';
import { isValidUUID } from '../lib/validation';

const router = Router({ mergeParams: true });

const VALID_EMOJIS = ['❤️', '😂', '😍', '🥹'];

async function requirePhotoMember(photoId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(photos)
    .innerJoin(albumMembers, eq(albumMembers.albumId, photos.albumId))
    .where(and(eq(photos.id, photoId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  if (!isValidUUID(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
  if (!(await requirePhotoMember(photoId, req.user!.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const rows = await db
      .select({ emoji: reactions.emoji, count: sql<number>`count(*)::int` })
      .from(reactions)
      .where(eq(reactions.photoId, photoId))
      .groupBy(reactions.emoji);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  const userId = req.user!.id;
  const { emoji } = req.body;

  if (!isValidUUID(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
  if (!VALID_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  if (!(await requirePhotoMember(photoId, userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await db
      .insert(reactions)
      .values({ photoId, userId, emoji })
      .onConflictDoUpdate({
        target: [reactions.photoId, reactions.userId],
        set: { emoji },
      });

    const [photo] = await db
      .select({ uploadedBy: photos.uploadedBy })
      .from(photos)
      .where(eq(photos.id, photoId));

    if (photo && photo.uploadedBy && photo.uploadedBy !== userId) {
      const [uploader] = await db
        .select({ apnsToken: users.apnsToken })
        .from(users)
        .where(eq(users.id, photo.uploadedBy));

      if (uploader?.apnsToken) {
        sendPush(
          [uploader.apnsToken],
          'Có reaction mới!',
          `Ai đó đã gửi ${emoji} cho ảnh của bé`,
          { photoId }
        ).catch(() => {});
      }
    }

    return res.status(201).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to upsert reaction' });
  }
});

router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const photoId = req.params.photoId as string;
  const userId = req.user!.id;
  if (!isValidUUID(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
  if (!(await requirePhotoMember(photoId, userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await db.delete(reactions).where(
      and(eq(reactions.photoId, photoId), eq(reactions.userId, userId))
    );
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete reaction' });
  }
});

export = router;
```

- [ ] **Step 4: Fix existing tests that use non-member users**

The `returns counts grouped by emoji` test creates `user2` and `user3` who react to a photo in `user`'s album. They aren't members. Add the import and fix those tests.

Add this import at the top of `backend/src/routes/reactions.test.ts`:

```ts
import { createTestUser, createTestAlbum, createTestAlbumMember, authHeader } from '../../tests/setup';
```

(replace the existing setup import line)

In `describe('GET /photos/:photoId/reactions')`, update `beforeEach` to also expose `albumId`:

```ts
  let albumId: string;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
    const album = await createTestAlbum(user.id);
    albumId = album.id;
    const photo = await createTestPhoto(album.id, user.id);
    photoId = photo.id;
    mockSendPush.mockClear();
  });
```

In the `returns counts grouped by emoji` test, add members before they react:

```ts
  it('returns counts grouped by emoji', async () => {
    const user2 = await createTestUser({ apple_sub: 'user2-sub' });
    const user3 = await createTestUser({ apple_sub: 'user3-sub' });
    await createTestAlbumMember(albumId, user2.id);
    await createTestAlbumMember(albumId, user3.id);

    await request(app).post(`/photos/${photoId}/reactions`).set(headers).send({ emoji: '❤️' });
    await request(app).post(`/photos/${photoId}/reactions`).set(authHeader(user2)).send({ emoji: '❤️' });
    await request(app).post(`/photos/${photoId}/reactions`).set(authHeader(user3)).send({ emoji: '😂' });

    const res = await request(app).get(`/photos/${photoId}/reactions`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const heart = res.body.find((r: { emoji: string; count: number }) => r.emoji === '❤️');
    const laugh = res.body.find((r: { emoji: string; count: number }) => r.emoji === '😂');
    expect(heart.count).toBe(2);
    expect(laugh.count).toBe(1);
  });
```

In `describe('POST /photos/:photoId/reactions')`, update `beforeEach` to expose `albumId`, and fix the push-notification test:

```ts
  let albumId: string;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
    const album = await createTestAlbum(user.id);
    albumId = album.id;
    const photo = await createTestPhoto(album.id, user.id);
    photoId = photo.id;
    mockSendPush.mockClear();
  });
```

Fix the push notification test:

```ts
  it('sends push notification when another user reacts to the photo', async () => {
    const uploader = await createTestUser({ apple_sub: 'uploader-sub' });
    await pool.query(`UPDATE users SET apns_token = 'device-token-uploader' WHERE id = $1`, [uploader.id]);

    const album = await createTestAlbum(uploader.id);
    const photo = await createTestPhoto(album.id, uploader.id);

    const reactor = await createTestUser({ apple_sub: 'reactor-sub' });
    await createTestAlbumMember(album.id, reactor.id);  // ← add this

    await request(app)
      .post(`/photos/${photo.id}/reactions`)
      .set(authHeader(reactor))
      .send({ emoji: '😍' });

    expect(mockSendPush).toHaveBeenCalledWith(
      ['device-token-uploader'],
      'Có reaction mới!',
      expect.stringContaining('😍'),
      { photoId: photo.id }
    );
  });
```

In `describe('DELETE /photos/:photoId/reactions')`, fix the test that has a second user:

```ts
  let albumId: string;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
    const album = await createTestAlbum(user.id);
    albumId = album.id;
    const photo = await createTestPhoto(album.id, user.id);
    photoId = photo.id;
    mockSendPush.mockClear();
  });
```

Fix the "only removes requesting user reaction" test:

```ts
  it('only removes the requesting user reaction, not others', async () => {
    const user2 = await createTestUser({ apple_sub: 'user2-delete-sub' });
    await createTestAlbumMember(albumId, user2.id);  // ← add this

    await request(app).post(`/photos/${photoId}/reactions`).set(headers).send({ emoji: '❤️' });
    await request(app).post(`/photos/${photoId}/reactions`).set(authHeader(user2)).send({ emoji: '😂' });

    await request(app).delete(`/photos/${photoId}/reactions`).set(headers);

    const getRes = await request(app).get(`/photos/${photoId}/reactions`).set(headers);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].emoji).toBe('😂');
  });
```

- [ ] **Step 5: Run reactions tests to confirm all pass**

```bash
cd backend && npx jest --testPathPattern="reactions.test" --runInBand --forceExit
```

Expected: all tests PASS including the 3 new 403 tests.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/routes/reactions.ts src/routes/reactions.test.ts && git commit -m "fix(backend): enforce album membership on reactions endpoints"
```

---

## Task 6: Fix r2_key ownership — presign token tracking

**Files:**
- Modify: `backend/src/routes/photos.ts`
- Modify: `backend/src/routes/photos.test.ts`

**Logic change:** The `POST /photos` handler is restructured so the idempotency check (local_asset_id lookup) happens **before** the presign token check. This preserves idempotency without requiring a new token for each retry.

New `POST /photos` flow:
1. Validate required fields and UUID
2. Check album membership
3. **If local_asset_id provided → check for existing photo → return early if found** ← moved up
4. Verify r2_key was issued to this user via presign_tokens
5. Delete the presign token (consume it)
6. Generate thumbnail and insert photo
7. Send push notifications

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/photos.test.ts`, inside `describe('POST /photos')`:

```ts
  it('returns 400 when r2_key was not issued to this user via presign', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/not-presigned.webp',
        taken_at: '2024-06-01T10:00:00Z',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid or unrecognized r2_key/);
  });

  it('returns 400 when r2_key was issued to a different user', async () => {
    const other = await createTestUser({ apple_sub: 'other-presign' });
    await createPresignToken(other.id, 'photos/other-key.webp');

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/other-key.webp',
        taken_at: '2024-06-01T10:00:00Z',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid or unrecognized r2_key/);
  });
```

Also add the import for `createPresignToken` in the test file. Update the existing import line:

```ts
import { createTestUser, createTestAlbum, createPresignToken, authHeader } from '../../tests/setup';
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd backend && npx jest --testPathPattern="photos.test" --runInBand --forceExit 2>&1 | tail -20
```

Expected: 2 new tests FAIL (returns 201 instead of 400). Many existing tests also fail because they pass r2_keys not in presign_tokens — that is expected at this stage.

- [ ] **Step 3: Update photos.ts**

Replace the full contents of `backend/src/routes/photos.ts`:

```ts
import express, { Request, Response, NextFunction } from 'express';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, albumMembers, photos, presignTokens } from '../db/schema';
import { getPresignedPutUrl } from '../services/r2';
import { generateThumbnail } from '../services/thumbnail';
import { sendPush } from '../services/apns';
import { isValidUUID, isValidDate } from '../lib/validation';
import { presignLimiter } from '../lib/rateLimit';

const router = express.Router();

router.use(requireAuth);

async function requireMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

function toSnakePhoto(p: typeof photos.$inferSelect) {
  return {
    id: p.id,
    album_id: p.albumId,
    uploaded_by: p.uploadedBy,
    r2_key: p.r2Key,
    thumbnail_key: p.thumbnailKey,
    taken_at: p.takenAt,
    caption: p.caption,
    local_asset_id: p.localAssetId,
    created_at: p.createdAt,
  };
}

router.post('/presign', presignLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id } = req.body ?? {};
    if (!album_id) return res.status(400).json({ error: 'album_id required' });
    if (!isValidUUID(album_id)) {
      return res.status(400).json({ error: 'album_id must be a valid UUID' });
    }
    if (!(await requireMember(album_id, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { url, key } = await getPresignedPutUrl();
    await db.insert(presignTokens).values({ key, userId: req.user!.id });
    return res.json({ url, key });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id, r2_key, taken_at, caption, local_asset_id } = req.body ?? {};
    if (!album_id || !r2_key || !taken_at) {
      return res.status(400).json({ error: 'album_id, r2_key, taken_at required' });
    }
    if (!isValidUUID(album_id)) {
      return res.status(400).json({ error: 'album_id must be a valid UUID' });
    }
    if (!isValidDate(taken_at)) {
      return res.status(400).json({ error: 'taken_at must be a valid ISO date' });
    }
    if (!(await requireMember(album_id, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Idempotency check first — before consuming a presign token
    if (local_asset_id) {
      const existing = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.albumId, album_id),
            eq(photos.localAssetId, local_asset_id),
            eq(photos.uploadedBy, req.user!.id)
          )
        )
        .limit(1);
      if (existing[0]) return res.status(200).json(toSnakePhoto(existing[0]));
    }

    // Verify this r2_key was issued to this user
    const [token] = await db
      .select()
      .from(presignTokens)
      .where(and(eq(presignTokens.key, r2_key), eq(presignTokens.userId, req.user!.id)))
      .limit(1);
    if (!token) {
      return res.status(400).json({ error: 'Invalid or unrecognized r2_key' });
    }
    await db.delete(presignTokens).where(eq(presignTokens.key, r2_key));

    const thumbnailKey = await generateThumbnail(r2_key);

    const [photo] = await db
      .insert(photos)
      .values({
        albumId: album_id,
        uploadedBy: req.user!.id,
        r2Key: r2_key,
        thumbnailKey,
        takenAt: new Date(taken_at),
        caption: caption ?? null,
        localAssetId: local_asset_id ?? null,
      })
      .returning();

    const recipients = await db
      .select({ token: users.apnsToken })
      .from(users)
      .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
      .where(
        and(
          eq(albumMembers.albumId, album_id),
          isNotNull(users.apnsToken),
          ne(users.id, req.user!.id)
        )
      );
    const tokens = recipients.map((r) => r.token!).filter(Boolean);
    sendPush(tokens, 'New photo added', `${req.user!.displayName} added a new photo`, { photoId: photo.id }).catch(console.error);

    return res.status(201).json(toSnakePhoto(photo));
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Update existing POST /photos tests to seed presign tokens**

The existing tests in `describe('POST /photos')` pass `r2_key` directly without going through the presign flow. Seed a presign token before each test that creates a new photo.

Update `describe('POST /photos')` `beforeEach`:

```ts
  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue('thumbnails/abc-thumb.webp');
    mockSendPush.mockResolvedValue(undefined);
  });
```

(no change — token seeding is done per-test below)

Update each test that calls `POST /photos` to seed a token first:

```ts
  it('registers a photo and returns it with thumbnail_key', async () => {
    await createPresignToken(user.id, 'photos/abc.webp');  // ← add
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/abc.webp',
        taken_at: '2024-06-01T10:00:00Z',
        caption: 'First smile!',
        local_asset_id: 'ios-asset-uuid-123',
      });
    expect(res.status).toBe(201);
    expect(res.body.r2_key).toBe('photos/abc.webp');
    expect(res.body.thumbnail_key).toBe('thumbnails/abc-thumb.webp');
    expect(mockGenThumb).toHaveBeenCalledWith('photos/abc.webp');
  });

  it('is idempotent — same local_asset_id returns existing photo', async () => {
    await createPresignToken(user.id, 'photos/abc.webp');  // ← add (only once — second call hits idempotency path)
    const payload = { album_id: album.id, r2_key: 'photos/abc.webp', taken_at: '2024-06-01T10:00:00Z', local_asset_id: 'same-asset' };
    await request(app).post('/photos').set(headers).send(payload);
    const res = await request(app).post('/photos').set(headers).send(payload);
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT * FROM photos WHERE local_asset_id = $1', ['same-asset']);
    expect(rows).toHaveLength(1);
  });

  it('sends push notification to all album members', async () => {
    await createPresignToken(user.id, 'photos/x.webp');  // ← add
    const member = await createTestUser({ apple_sub: 'member-sub' });
    await pool.query(`INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`, [album.id, member.id]);
    await pool.query(`UPDATE users SET apns_token = 'token-abc' WHERE id = $1`, [member.id]);

    await request(app).post('/photos').set(headers).send({ album_id: album.id, r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(mockSendPush).toHaveBeenCalledWith(['token-abc'], expect.any(String), expect.any(String), expect.any(Object));
  });

  it('inserts a new photo when local_asset_id is provided but no existing row matches', async () => {
    await createPresignToken(user.id, 'photos/new-asset.webp');  // ← add
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/new-asset.webp', taken_at: '2024-06-01T10:00:00Z', local_asset_id: 'brand-new-asset' });
    expect(res.status).toBe(201);
    expect(res.body.local_asset_id).toBe('brand-new-asset');
    expect(mockGenThumb).toHaveBeenCalledWith('photos/new-asset.webp');
  });

  it('inserts a new photo when local_asset_id is omitted', async () => {
    await createPresignToken(user.id, 'photos/no-asset.webp');  // ← add
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/no-asset.webp', taken_at: '2024-06-01T10:00:00Z' });
    expect(res.status).toBe(201);
    expect(res.body.local_asset_id).toBeNull();
    expect(mockGenThumb).toHaveBeenCalledWith('photos/no-asset.webp');
  });

  it('forwards errors to next() when generateThumbnail rejects', async () => {
    await createPresignToken(user.id, 'photos/x.webp');  // ← add
    mockGenThumb.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });
    expect(res.status).toBe(500);
  });

  it('calls sendPush with empty array when no other members have apns_token', async () => {
    await createPresignToken(user.id, 'photos/solo.webp');  // ← add
    await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/solo.webp', taken_at: '2024-06-01T10:00:00Z' });
    expect(mockSendPush).toHaveBeenCalledWith([], expect.any(String), expect.any(String), expect.any(Object));
  });
```

The 400/403 tests (missing album_id, missing r2_key, missing taken_at, invalid UUID, non-member) do NOT need a presign token because they return early before the ownership check.

- [ ] **Step 5: Run photos tests to confirm all pass**

```bash
cd backend && npx jest --testPathPattern="photos.test" --runInBand --forceExit
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/routes/photos.ts src/routes/photos.test.ts && git commit -m "fix(backend): verify r2_key ownership via presign_tokens before photo creation"
```

---

## Task 7: Enforce admin role on PATCH album and DELETE milestone

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/albums.ts`
- Modify: `backend/src/routes/milestones.ts`
- Modify: `backend/src/routes/albums.test.ts` (add 403 test)
- Modify: `backend/src/routes/milestones.test.ts` (add 403 test)

- [ ] **Step 1: Write failing tests**

In `backend/src/routes/albums.test.ts`, add inside `describe('PATCH /albums/:id')`:

```ts
  it('returns 403 when caller is a member but not admin', async () => {
    const member = await createTestUser({ apple_sub: 'member-patch' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );
    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(authHeader(member))
      .send({ name: 'Hacked Name' });
    expect(res.status).toBe(403);
  });
```

In `backend/src/routes/milestones.test.ts`, add inside `describe('DELETE /milestones/:id')`:

```ts
  it('returns 403 when caller is a member but not admin', async () => {
    const member = await createTestUser({ apple_sub: 'member-delete-ms' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );
    const ms = await pool.query(
      `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, 'Test', NOW()) RETURNING id`,
      [album.id, user.id]
    );
    const res = await request(app)
      .delete(`/milestones/${ms.rows[0].id}`)
      .set(authHeader(member));
    expect(res.status).toBe(403);
  });
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd backend && npx jest --testPathPattern="(albums.test|milestones.test)" --runInBand --forceExit 2>&1 | tail -20
```

Expected: both new tests FAIL with 200/204 instead of 403.

- [ ] **Step 3: Add requireAlbumAdmin to middleware/auth.ts**

In `backend/src/middleware/auth.ts`, add these imports at the top (after the existing imports):

```ts
import { and, eq } from 'drizzle-orm';
import { albumMembers } from '../db/schema';
```

Add this function at the end of the file:

```ts
export async function requireAlbumAdmin(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: albumMembers.role })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows[0]?.role === 'admin';
}
```

- [ ] **Step 4: Apply admin check to PATCH /albums/:id**

In `backend/src/routes/albums.ts`, add the import:

```ts
import { requireAuth, requireAlbumAdmin } from '../middleware/auth';
```

In `router.patch('/:id', ...)`, after the existing membership check (which fetches `membership`), replace the 403 check:

Find this block:
```ts
    if (!membership[0]) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
```

Replace with:
```ts
    if (!membership[0] || membership[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
```

For this to work, the `membership` select must include `role`. Find the existing membership query in `router.patch`:

```ts
    const membership = await db
      .select()
      .from(albumMembers)
      .where(
        and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id))
      )
      .limit(1);
```

It already selects all columns via `select()`, so `membership[0].role` is available. The change above is sufficient.

- [ ] **Step 5: Apply admin check to DELETE /milestones/:id**

In `backend/src/routes/milestones.ts`, the current DELETE handler fetches the milestone via a join that checks user membership. We need to also check the role.

Find the existing delete handler's access check:

```ts
      const existing = await db
        .select({ id: milestones.id })
        .from(milestones)
        .innerJoin(albumMembers, eq(albumMembers.albumId, milestones.albumId))
        .where(
          and(eq(milestones.id, milestoneId), eq(albumMembers.userId, req.user!.id))
        )
        .limit(1);
      if (!existing[0]) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
```

Replace with (also selects `role`):

```ts
      const existing = await db
        .select({ id: milestones.id, role: albumMembers.role })
        .from(milestones)
        .innerJoin(albumMembers, eq(albumMembers.albumId, milestones.albumId))
        .where(
          and(eq(milestones.id, milestoneId), eq(albumMembers.userId, req.user!.id))
        )
        .limit(1);
      if (!existing[0] || existing[0].role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
```

- [ ] **Step 6: Run to confirm all pass**

```bash
cd backend && npx jest --testPathPattern="(albums.test|milestones.test)" --runInBand --forceExit
```

Expected: all PASS including the 2 new 403 tests.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/middleware/auth.ts src/routes/albums.ts src/routes/milestones.ts src/routes/albums.test.ts src/routes/milestones.test.ts && git commit -m "fix(backend): enforce admin role on album PATCH and milestone DELETE"
```

---

## Task 8: UUID validation across all routes

Apply `isValidUUID` at the top of every handler that receives a UUID route param, returning 400 for invalid input. `photos.ts` and `reactions.ts` are already done (from earlier tasks).

**Files:**
- Modify: `backend/src/routes/members.ts`
- Modify: `backend/src/routes/timeline.ts`
- Modify: `backend/src/routes/milestones.ts`
- Modify: `backend/src/routes/albums.ts`
- Modify: `backend/src/routes/invites.ts`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/members.test.ts`:

```ts
  it('returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .get('/albums/not-a-uuid/members')
      .set(authHeader(user));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });
```

Add to `backend/src/routes/milestones.test.ts`, inside `describe('GET /albums/:albumId/milestones')`:

```ts
  it('returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .get('/albums/not-a-uuid/milestones')
      .set(authHeader(user));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });
```

Add to `backend/src/routes/albums.test.ts`, inside `describe('GET /albums/:id')`:

```ts
  it('returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .get('/albums/not-a-uuid')
      .set(authHeader(user));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && npx jest --testPathPattern="(members.test|milestones.test|albums.test)" --runInBand --forceExit 2>&1 | tail -20
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Add UUID check to members.ts**

In `backend/src/routes/members.ts`, add the import:

```ts
import { isValidUUID } from '../lib/validation';
```

At the top of `router.get('/', ...)`, before the membership query:

```ts
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
```

- [ ] **Step 4: Add UUID check to timeline.ts**

In `backend/src/routes/timeline.ts`, add the import:

```ts
import { isValidUUID } from '../lib/validation';
```

At the top of `router.get('/', ...)`, before the limit parsing:

```ts
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
```

- [ ] **Step 5: Add UUID checks to milestones.ts**

In `backend/src/routes/milestones.ts`, add the import:

```ts
import { isValidUUID } from '../lib/validation';
```

In `POST /albums/:albumId/milestones`, after extracting `albumId`:
```ts
      const albumId = req.params.albumId as string;
      if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
```

In `GET /albums/:albumId/milestones`, after extracting `albumId`:
```ts
      const albumId = req.params.albumId as string;
      if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
```

In `PATCH /milestones/:id`, after extracting `milestoneId`:
```ts
      const milestoneId = req.params.id as string;
      if (!isValidUUID(milestoneId)) { res.status(400).json({ error: 'Invalid milestoneId' }); return; }
```

In `DELETE /milestones/:id`, after extracting `milestoneId`:
```ts
      const milestoneId = req.params.id as string;
      if (!isValidUUID(milestoneId)) { res.status(400).json({ error: 'Invalid milestoneId' }); return; }
```

- [ ] **Step 6: Add UUID checks to albums.ts**

In `backend/src/routes/albums.ts`, add the import:

```ts
import { isValidUUID } from '../lib/validation';
```

In `GET /:id`, after extracting `albumId`:
```ts
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
```

In `PATCH /:id`, after extracting `albumId`:
```ts
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
```

- [ ] **Step 7: Add UUID check to invites.ts**

In `backend/src/routes/invites.ts`, add the import:

```ts
import { isValidUUID } from '../lib/validation';
```

In `POST /albums/:albumId/invites`, after extracting `albumId`:
```ts
      const { albumId } = req.params;
      if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
```

- [ ] **Step 8: Run the full test suite**

```bash
cd backend && npm test
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
cd backend && git add src/routes/members.ts src/routes/timeline.ts src/routes/milestones.ts src/routes/albums.ts src/routes/invites.ts src/routes/members.test.ts src/routes/milestones.test.ts src/routes/albums.test.ts && git commit -m "fix(backend): validate UUID route params on all endpoints"
```

---

## Task 9: Business logic validation

Three fixes: milestone cover_photo_id must belong to the same album, invite params must be positive integers, taken_at must be a parseable date.

**Files:**
- Modify: `backend/src/routes/milestones.ts`
- Modify: `backend/src/routes/invites.ts`

(photos.ts `taken_at` validation was already added in Task 6)

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/milestones.test.ts`, inside `describe('PATCH /milestones/:id')`:

```ts
  it('returns 400 when cover_photo_id belongs to a different album', async () => {
    // Create a milestone in our album
    const { rows: [ms] } = await pool.query(
      `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, 'Test', NOW()) RETURNING id`,
      [album.id, user.id]
    );

    // Create a photo in a different album
    const other = await createTestUser({ apple_sub: 'other-cover' });
    const otherAlbum = await createTestAlbum(other.id);
    const { rows: [photo] } = await pool.query(
      `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at) VALUES ($1, $2, 'k', NOW()) RETURNING id`,
      [otherAlbum.id, other.id]
    );

    const res = await request(app)
      .patch(`/milestones/${ms.id}`)
      .set(authHeader(user))
      .send({ cover_photo_id: photo.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cover_photo_id does not belong to this album/);
  });
```

Add to `backend/src/routes/invites.test.ts`:

```ts
  describe('POST /albums/:albumId/invites — param validation', () => {
    it('returns 400 when expires_in_days is 0', async () => {
      const res = await request(app)
        .post(`/albums/${album.id}/invites`)
        .set(authHeader(user))
        .send({ expires_in_days: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expires_in_days must be a positive integer/);
    });

    it('returns 400 when expires_in_days is negative', async () => {
      const res = await request(app)
        .post(`/albums/${album.id}/invites`)
        .set(authHeader(user))
        .send({ expires_in_days: -5 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when max_uses is 0', async () => {
      const res = await request(app)
        .post(`/albums/${album.id}/invites`)
        .set(authHeader(user))
        .send({ max_uses: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/max_uses must be a positive integer/);
    });
  });
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && npx jest --testPathPattern="(milestones.test|invites.test)" --runInBand --forceExit 2>&1 | tail -20
```

Expected: 4 new tests FAIL.

- [ ] **Step 3: Fix milestone PATCH — cover_photo_id validation**

In `backend/src/routes/milestones.ts`, in the `PATCH /milestones/:id` handler, after extracting `cover_photo_id` from body and after the access check that already fetches `existing`, add the cover_photo ownership check.

You'll need to also select `albumId` in the existing access check query. Update the `select`:

```ts
      const existing = await db
        .select({ id: milestones.id, albumId: milestones.albumId, role: albumMembers.role })
        .from(milestones)
        .innerJoin(albumMembers, eq(albumMembers.albumId, milestones.albumId))
        .where(
          and(eq(milestones.id, milestoneId), eq(albumMembers.userId, req.user!.id))
        )
        .limit(1);
      if (!existing[0]) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
```

Then after the existing access check and before building `patch`, add:

```ts
      if (cover_photo_id !== undefined && cover_photo_id !== null) {
        if (!isValidUUID(cover_photo_id)) {
          res.status(400).json({ error: 'Invalid cover_photo_id' });
          return;
        }
        const matchingPhoto = await db
          .select({ id: photos.id })
          .from(photos)
          .where(and(eq(photos.id, cover_photo_id), eq(photos.albumId, existing[0].albumId)))
          .limit(1);
        if (!matchingPhoto[0]) {
          res.status(400).json({ error: 'cover_photo_id does not belong to this album' });
          return;
        }
      }
```

You also need to import `photos` at the top of milestones.ts if it isn't already there. Check the existing imports and add:

```ts
import { users, albumMembers, milestones, photos } from '../db/schema';
```

- [ ] **Step 4: Fix invites.ts — expires_in_days and max_uses validation**

In `backend/src/routes/invites.ts`, in `POST /albums/:albumId/invites`, after extracting `expires_in_days` and `max_uses` from body, add validation before creating the invite:

```ts
      if (expires_in_days !== undefined) {
        const days = Number(expires_in_days);
        if (!Number.isInteger(days) || days < 1) {
          return res.status(400).json({ error: 'expires_in_days must be a positive integer' });
        }
      }
      if (max_uses !== undefined) {
        const uses = Number(max_uses);
        if (!Number.isInteger(uses) || uses < 1) {
          return res.status(400).json({ error: 'max_uses must be a positive integer' });
        }
      }
```

- [ ] **Step 5: Run to confirm all pass**

```bash
cd backend && npx jest --testPathPattern="(milestones.test|invites.test)" --runInBand --forceExit
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/routes/milestones.ts src/routes/invites.ts src/routes/milestones.test.ts src/routes/invites.test.ts && git commit -m "fix(backend): validate cover_photo_id album ownership and invite param ranges"
```

---

## Task 10: JWT lifetime + logout endpoint

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/routes/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/auth.test.ts`:

```ts
import jwt from 'jsonwebtoken';

describe('JWT token lifetime', () => {
  it('issues a token that expires in 7 days (not 30)', async () => {
    mockVerifyApple.mockResolvedValue({ sub: 'apple-sub-expiry', name: 'Expiry Test', email: null });

    const res = await request(app).post('/auth/apple').send({ idToken: 'token' });
    expect(res.status).toBe(200);

    const decoded = jwt.decode(res.body.token) as { exp: number; iat: number };
    const lifetimeSeconds = decoded.exp - decoded.iat;
    // 7 days = 604800s. Allow ±5s for test execution time.
    expect(lifetimeSeconds).toBeGreaterThanOrEqual(604795);
    expect(lifetimeSeconds).toBeLessThanOrEqual(604805);
  });
});

describe('POST /auth/logout', () => {
  it('clears the apns_token of the authenticated user and returns 204', async () => {
    mockVerifyApple.mockResolvedValueOnce({ sub: 'apple-sub-logout', name: 'Logout User', email: null });
    const loginRes = await request(app)
      .post('/auth/apple')
      .send({ idToken: 'token', apnsToken: 'device-logout-token' });
    expect(loginRes.status).toBe(200);

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set({ Authorization: `Bearer ${loginRes.body.token}` });
    expect(logoutRes.status).toBe(204);

    const { rows } = await pool.query(
      `SELECT apns_token FROM users WHERE apple_sub = 'apple-sub-logout'`
    );
    expect(rows[0].apns_token).toBeNull();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd backend && npx jest --testPathPattern="auth.test" --runInBand --forceExit 2>&1 | tail -20
```

Expected: `JWT token lifetime` test FAILS (lifetime is ~2592000s, not 604800s). `POST /auth/logout` tests FAIL (route doesn't exist).

- [ ] **Step 3: Update auth.ts**

In `backend/src/routes/auth.ts`, change the `signJwt` function:

```ts
function signJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });  // was '30d'
}
```

Then add the logout route at the end, before `export = router;`:

```ts
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.update(users).set({ apnsToken: null }).where(eq(users.id, req.user!.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
```

Add these imports in `backend/src/routes/auth.ts`. For `eq`, merge it into the existing `drizzle-orm` import line:

```ts
// Change:
import { sql } from 'drizzle-orm';
// To:
import { sql, eq } from 'drizzle-orm';
```

Add `requireAuth` as a new import line:
```ts
import { requireAuth } from '../middleware/auth';
```

- [ ] **Step 4: Run to confirm all pass**

```bash
cd backend && npx jest --testPathPattern="auth.test" --runInBand --forceExit
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && npm test
```

Expected: all tests PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/routes/auth.ts src/routes/auth.test.ts && git commit -m "fix(backend): reduce JWT lifetime to 7d and add logout endpoint"
```

---

## Done

All 14 security issues from the spec are addressed. Run the full suite one final time to confirm clean state:

```bash
cd backend && npm test
```

All tests should pass. The spec document is at `docs/superpowers/specs/2026-06-04-security-hardening-design.md`.
