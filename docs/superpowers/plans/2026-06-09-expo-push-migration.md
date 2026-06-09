# Expo Push Service Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `@parse/node-apn` direct APNS integration with Expo's Push Notification Service so push notifications work on both iOS and Android.

**Architecture:** The mobile already calls `getExpoPushTokenAsync()` which produces `ExponentPushToken[...]` tokens. The backend will switch from `@parse/node-apn` to `expo-server-sdk`, which accepts these Expo tokens and routes to APNS (iOS) or FCM (Android) automatically. A missing `PATCH /users/me` route is also added so `registerPushToken()` in the mobile can actually save tokens.

**Tech Stack:** Node.js/Express, `expo-server-sdk`, Drizzle ORM, PostgreSQL, TypeScript, Jest

---

## File Map

| Action | Path |
|--------|------|
| Create | `backend/src/services/push.ts` |
| Create | `backend/src/services/push.test.ts` |
| Create | `backend/src/routes/users.ts` |
| Create | `backend/src/db/migrations/0012_rename_push_token.sql` |
| Modify | `backend/src/db/migrations/meta/_journal.json` |
| Modify | `backend/src/db/schema.ts` |
| Modify | `backend/src/routes/auth.ts` |
| Modify | `backend/src/routes/auth.test.ts` |
| Modify | `backend/src/routes/photos.ts` |
| Modify | `backend/src/routes/photos.test.ts` |
| Modify | `backend/src/routes/reactions.ts` |
| Modify | `backend/src/routes/reactions.test.ts` |
| Modify | `backend/src/app.ts` |
| Modify | `backend/tests/setup.ts` |
| Delete | `backend/src/services/apns.ts` |
| Delete | `backend/src/services/apns.test.ts` |

---

## Task 1: DB Migration — rename `apns_token` → `push_token`

**Files:**
- Create: `backend/src/db/migrations/0012_rename_push_token.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`

- [ ] **Step 1: Create migration SQL file**

Create `backend/src/db/migrations/0012_rename_push_token.sql`:
```sql
ALTER TABLE users RENAME COLUMN apns_token TO push_token;
```

- [ ] **Step 2: Add entry to migration journal**

In `backend/src/db/migrations/meta/_journal.json`, add to the end of the `"entries"` array (before the closing `]`):
```json
    ,{
      "idx": 10,
      "version": "7",
      "when": 1749427200000,
      "tag": "0012_rename_push_token",
      "breakpoints": true
    }
```

- [ ] **Step 3: Apply the migration**

```bash
cd backend && npm run migrate:push
```

Expected output contains: `[✓] 0012_rename_push_token` (or similar success message)

If `migrate:push` fails due to journal inconsistency with the untracked 0010/0011 files, run the SQL directly instead:
```bash
cd backend && node -e "
require('dotenv/config');
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query('ALTER TABLE users RENAME COLUMN apns_token TO push_token')
  .then(() => { console.log('Done'); p.end(); })
  .catch(err => { console.error(err.message); p.end(); process.exit(1); });
"
```

- [ ] **Step 4: Verify column was renamed**

```bash
cd backend && node -e "
require('dotenv/config');
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='push_token'\")
  .then(r => { console.log(r.rows.length === 1 ? 'OK: push_token exists' : 'FAIL: column not found'); p.end(); })
  .catch(err => { console.error(err.message); p.end(); });
"
```

Expected: `OK: push_token exists`

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/migrations/0012_rename_push_token.sql backend/src/db/migrations/meta/_journal.json
git commit -m "feat: rename users.apns_token to push_token"
```

---

## Task 2: Swap Dependencies

**Files:** `backend/package.json` (updated by npm)

- [ ] **Step 1: Install expo-server-sdk and remove @parse/node-apn**

```bash
cd backend && npm install expo-server-sdk && npm uninstall @parse/node-apn
```

Expected: `expo-server-sdk` appears in `package.json` dependencies; `@parse/node-apn` is removed.

---

## Task 3: Update Drizzle Schema

**Files:**
- Modify: `backend/src/db/schema.ts` line 25

- [ ] **Step 1: Rename field in schema**

In `backend/src/db/schema.ts`, change line 25:
```typescript
// Before
  apnsToken: text('apns_token'),
// After
  pushToken: text('push_token'),
```

- [ ] **Step 2: Build to verify TypeScript compiles**

```bash
cd backend && npm run build 2>&1 | head -40
```

Expected: Build errors referencing `apnsToken` (in auth.ts, photos.ts, reactions.ts, setup.ts) — these are expected and will be fixed in later tasks.

---

## Task 4: TDD — `push.ts` Service

**Files:**
- Create: `backend/src/services/push.test.ts`
- Create: `backend/src/services/push.ts`
- Delete: `backend/src/services/apns.test.ts`
- Delete: `backend/src/services/apns.ts`

- [ ] **Step 1: Create `push.test.ts` (failing)**

Create `backend/src/services/push.test.ts`:
```typescript
jest.mock('expo-server-sdk', () => {
  const mockSend = jest.fn().mockResolvedValue([{ status: 'ok', id: 'receipt-id' }]);
  const mockChunk = jest.fn().mockImplementation((msgs: unknown[]) => [msgs]);
  const MockExpo = jest.fn().mockImplementation(() => ({
    sendPushNotificationsAsync: mockSend,
    chunkPushNotifications: mockChunk,
  }));
  (MockExpo as any).isExpoPushToken = jest.fn().mockReturnValue(true);
  return {
    Expo: MockExpo,
    __mockSend: mockSend,
    __mockChunk: mockChunk,
    __mockIsValid: (MockExpo as any).isExpoPushToken,
  };
});

jest.mock('../db', () => {
  const mockWhere = jest.fn().mockResolvedValue(undefined);
  const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet });
  return { db: { update: mockUpdate }, __mockUpdate: mockUpdate, __mockWhere: mockWhere };
});

jest.mock('../db/schema', () => ({ users: {} }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));

type ExpoMock = {
  Expo: jest.Mock;
  __mockSend: jest.Mock;
  __mockChunk: jest.Mock;
  __mockIsValid: jest.Mock;
};
type DbMock = { db: { update: jest.Mock }; __mockUpdate: jest.Mock; __mockWhere: jest.Mock };

describe('services/push sendPush', () => {
  let expo: ExpoMock;
  let dbMock: DbMock;
  let sendPush: (
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    expo = require('expo-server-sdk') as ExpoMock;
    dbMock = require('../db') as DbMock;
    expo.__mockSend.mockResolvedValue([{ status: 'ok', id: 'receipt-id' }]);
    expo.__mockChunk.mockImplementation((msgs: unknown[]) => [msgs]);
    expo.__mockIsValid.mockReturnValue(true);
    ({ sendPush } = require('./push'));
  });

  it('returns early and does not send when token array is empty', async () => {
    await sendPush([], 'T', 'B');
    expect(expo.__mockSend).not.toHaveBeenCalled();
  });

  it('filters out invalid tokens and returns early when none remain', async () => {
    expo.__mockIsValid.mockReturnValue(false);
    await sendPush(['not-an-expo-token'], 'T', 'B');
    expect(expo.__mockSend).not.toHaveBeenCalled();
  });

  it('sends notification with correct fields', async () => {
    await sendPush(['ExponentPushToken[xxx]'], 'Ảnh mới', 'Có ảnh mới', { photoId: '123' });
    expect(expo.__mockChunk).toHaveBeenCalledWith([
      { to: 'ExponentPushToken[xxx]', title: 'Ảnh mới', body: 'Có ảnh mới', data: { photoId: '123' } },
    ]);
    expect(expo.__mockSend).toHaveBeenCalledTimes(1);
  });

  it('uses empty data object by default', async () => {
    await sendPush(['ExponentPushToken[yyy]'], 'T', 'B');
    expect(expo.__mockChunk).toHaveBeenCalledWith([
      { to: 'ExponentPushToken[yyy]', title: 'T', body: 'B', data: {} },
    ]);
  });

  it('clears push token in DB on DeviceNotRegistered error', async () => {
    expo.__mockSend.mockResolvedValueOnce([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);
    expo.__mockChunk.mockReturnValueOnce([
      [{ to: 'ExponentPushToken[stale]', title: 'T', body: 'B', data: {} }],
    ]);

    await sendPush(['ExponentPushToken[stale]'], 'T', 'B');

    expect(dbMock.__mockUpdate).toHaveBeenCalled();
    expect(dbMock.__mockWhere).toHaveBeenCalled();
  });

  it('does not update DB when ticket status is ok', async () => {
    await sendPush(['ExponentPushToken[good]'], 'T', 'B');
    expect(dbMock.__mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/services/push.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './push'`

- [ ] **Step 3: Create `push.ts`**

Create `backend/src/services/push.ts`:
```typescript
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const expo = new Expo();

export async function sendPush(
  pushTokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const validTokens = pushTokens.filter(t => Expo.isExpoPushToken(t));
  if (!validTokens.length) return;

  const messages: ExpoPushMessage[] = validTokens.map(to => ({ to, title, body, data }));
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const invalidToken = (chunk[i] as ExpoPushMessage).to as string;
        await db.update(users).set({ pushToken: null }).where(eq(users.pushToken, invalidToken));
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/services/push.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — all 6 tests green

- [ ] **Step 5: Delete old apns files and commit**

```bash
git rm backend/src/services/apns.ts backend/src/services/apns.test.ts
git add backend/src/services/push.ts backend/src/services/push.test.ts backend/package.json backend/package-lock.json
git commit -m "feat: replace apns service with expo-server-sdk push service"
```

---

## Task 5: Update `auth.ts` — Rename Token Field References

**Files:**
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Update `toSnakeUser` response shape**

In `backend/src/routes/auth.ts`, change lines 37:
```typescript
// Before
    apns_token: u.apnsToken,
// After
    push_token: u.pushToken,
```

- [ ] **Step 2: Update `/apple` route body destructuring and DB values**

Change lines 44, 56, 63:
```typescript
// Before (line 44)
    const { idToken, apnsToken } = req.body ?? {};
// After
    const { idToken, pushToken } = req.body ?? {};

// Before (line 56)
        apnsToken: apnsToken ?? null,
// After
        pushToken: pushToken ?? null,

// Before (line 63)
          apnsToken: sql`COALESCE(EXCLUDED.apns_token, ${users.apnsToken})`,
// After
          pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
```

- [ ] **Step 3: Update `/google` route body destructuring and DB values**

Change lines 77, 89, 96:
```typescript
// Before (line 77)
    const { idToken, apnsToken } = req.body ?? {};
// After
    const { idToken, pushToken } = req.body ?? {};

// Before (line 89)
        apnsToken: apnsToken ?? null,
// After
        pushToken: pushToken ?? null,

// Before (line 96)
          apnsToken: sql`COALESCE(EXCLUDED.apns_token, ${users.apnsToken})`,
// After
          pushToken: sql`COALESCE(EXCLUDED.push_token, ${users.pushToken})`,
```

- [ ] **Step 4: Update `/logout` route**

Change line 110:
```typescript
// Before
    await db.update(users).set({ apnsToken: null }).where(eq(users.id, req.user!.id));
// After
    await db.update(users).set({ pushToken: null }).where(eq(users.id, req.user!.id));
```

---

## Task 6: TDD — Add `PATCH /users/me` Route

**Files:**
- Create: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/auth.test.ts` (add new describe block)
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing tests**

Add this describe block to the end of `backend/src/routes/auth.test.ts` (before the last `}`):
```typescript
describe('PATCH /users/me', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    user = await createTestUser({ apple_sub: 'patch-me-sub' });
  });

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).patch('/users/me').send({ push_token: 'ExponentPushToken[abc]' });
    expect(res.status).toBe(401);
  });

  it('updates push_token for authenticated user and returns 204', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set(authHeader(user))
      .send({ push_token: 'ExponentPushToken[new-token]' });

    expect(res.status).toBe(204);

    const { rows } = await pool.query(`SELECT push_token FROM users WHERE id = $1`, [user.id]);
    expect(rows[0].push_token).toBe('ExponentPushToken[new-token]');
  });

  it('sets push_token to null when push_token is not a string', async () => {
    await pool.query(`UPDATE users SET push_token = 'ExponentPushToken[old]' WHERE id = $1`, [user.id]);

    const res = await request(app)
      .patch('/users/me')
      .set(authHeader(user))
      .send({ push_token: null });

    expect(res.status).toBe(204);

    const { rows } = await pool.query(`SELECT push_token FROM users WHERE id = $1`, [user.id]);
    expect(rows[0].push_token).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/routes/auth.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|PATCH /users/me"
```

Expected: FAIL — `PATCH /users/me` describe block fails with 404

- [ ] **Step 3: Create `backend/src/routes/users.ts`**

```typescript
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
```

- [ ] **Step 4: Register route in `app.ts`**

In `backend/src/app.ts`, add the import after the existing route imports:
```typescript
import usersRoutes from './routes/users';
```

Add the route registration after `app.use('/auth', authRoutes);`:
```typescript
app.use('/users', usersRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest src/routes/auth.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|✓|✗|●"
```

Expected: PASS — all tests including new `PATCH /users/me` describe block

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/users.ts backend/src/routes/auth.ts backend/src/routes/auth.test.ts backend/src/app.ts
git commit -m "feat: add PATCH /users/me to save Expo push token, rename apnsToken to pushToken in auth"
```

---

## Task 7: Update Test Infrastructure

**Files:**
- Modify: `backend/tests/setup.ts`
- Modify: `backend/src/routes/auth.test.ts` (existing tests referencing apns_token)

- [ ] **Step 1: Update `TestUser` interface in setup.ts**

In `backend/tests/setup.ts`, change line `apns_token: string | null;` to:
```typescript
// Before
  apns_token: string | null;
// After
  push_token: string | null;
```

- [ ] **Step 2: Update `toSnakeUser` in setup.ts**

```typescript
// Before
    apns_token: u.apnsToken,
// After
    push_token: u.pushToken,
```

- [ ] **Step 3: Update existing token references in `auth.test.ts`**

There are 6 references to update in `auth.test.ts`. Find each with `grep -n "apns_token\|apnsToken" backend/src/routes/auth.test.ts` and apply:

1. Line ~60 — change `apnsToken: 'device-token-abc'` in `.send()` to `pushToken: 'device-token-abc'`
2. Line ~68 — change `expect(rows[0].apns_token).toBe('device-token-abc')` to `expect(rows[0].push_token).toBe('device-token-abc')`
3. Line ~88 — change test description `'persists apns_token...'` to `'persists push_token when provided in the request body'`
4. Line ~93 — change `.send({ idToken: 'token', apnsToken: 'apple-device-token-999' })` to `.send({ idToken: 'token', pushToken: 'apple-device-token-999' })`
5. Line ~96–98 — change `SELECT apns_token FROM users WHERE apple_sub = ...` to `SELECT push_token FROM users WHERE apple_sub = ...` and `rows[0].apns_token` to `rows[0].push_token`
6. Lines ~119, ~132, ~140–142, ~211, ~215, ~224, ~226 — apply same pattern: `apnsToken` → `pushToken` in `.send()` bodies, `apns_token` → `push_token` in raw SQL strings and row access

Run `grep -n "apns_token\|apnsToken" backend/src/routes/auth.test.ts` to find any remaining ones.

- [ ] **Step 4: Run auth tests to verify they pass**

```bash
cd backend && npx jest src/routes/auth.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|Tests:"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tests/setup.ts backend/src/routes/auth.test.ts
git commit -m "refactor: rename apns_token to push_token in test infrastructure and auth tests"
```

---

## Task 8: Update `photos.ts` and `reactions.ts`

**Files:**
- Modify: `backend/src/routes/photos.ts`
- Modify: `backend/src/routes/photos.test.ts`
- Modify: `backend/src/routes/reactions.ts`
- Modify: `backend/src/routes/reactions.test.ts`

- [ ] **Step 1: Update `photos.ts` import and field reference**

In `backend/src/routes/photos.ts`:

Change line 8:
```typescript
// Before
import { sendPush } from '../services/apns';
// After
import { sendPush } from '../services/push';
```

Change line 213 (the `.select()` query):
```typescript
// Before
      .select({ token: users.apnsToken })
// After
      .select({ token: users.pushToken })
```

Change line 218 (the `.where()` condition):
```typescript
// Before
        isNotNull(users.apnsToken),
// After
        isNotNull(users.pushToken),
```

- [ ] **Step 2: Update `photos.test.ts` raw SQL and mock import**

In `backend/src/routes/photos.test.ts`:

Find and update the mock import at the top:
```typescript
// Before
jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));
// ...
import { sendPush } from '../services/apns';
// After
jest.mock('../services/push', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));
// ...
import { sendPush } from '../services/push';
```

Find the raw SQL at line ~170:
```typescript
// Before
    await pool.query(`UPDATE users SET apns_token = 'token-abc' WHERE id = $1`, [member.id]);
// After
    await pool.query(`UPDATE users SET push_token = 'token-abc' WHERE id = $1`, [member.id]);
```

Find the test description at line ~272 that mentions `apns_token`:
```typescript
// Before
  it('calls sendPush with empty array when no other members have apns_token', async () => {
// After
  it('calls sendPush with empty array when no other members have push_token', async () => {
```

- [ ] **Step 3: Update `reactions.ts` import and field reference**

In `backend/src/routes/reactions.ts`:

Change line 6:
```typescript
// Before
import { sendPush } from '../services/apns';
// After
import { sendPush } from '../services/push';
```

Change line 70:
```typescript
// Before
        .select({ apnsToken: users.apnsToken })
// After
        .select({ pushToken: users.pushToken })
```

Change line 74:
```typescript
// Before
      if (uploader?.apnsToken) {
        sendPush(
          [uploader.apnsToken],
// After
      if (uploader?.pushToken) {
        sendPush(
          [uploader.pushToken],
```

- [ ] **Step 4: Update `reactions.test.ts` mock import**

In `backend/src/routes/reactions.test.ts`, change line 1:
```typescript
// Before
jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));
// ...
import { sendPush } from '../services/apns';
// After
jest.mock('../services/push', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));
// ...
import { sendPush } from '../services/push';
```

- [ ] **Step 5: Run photos and reactions tests**

```bash
cd backend && npx jest src/routes/photos.test.ts src/routes/reactions.test.ts --no-coverage 2>&1 | grep -E "PASS|FAIL|Tests:"
```

Expected: PASS for both

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts backend/src/routes/reactions.ts backend/src/routes/reactions.test.ts
git commit -m "refactor: update photos and reactions routes to use expo push service"
```

---

## Task 9: Full Test Suite + Final Verification

- [ ] **Step 1: Run the complete test suite**

```bash
cd backend && npm test 2>&1 | tail -30
```

Expected: All test suites PASS. No references to `apns` remain in source files.

- [ ] **Step 2: Verify no leftover apns references in source**

```bash
grep -r "apns\|node-apn\|APNS" backend/src --include="*.ts" | grep -v "node_modules"
```

Expected: No output (zero matches)

- [ ] **Step 3: Build the project**

```bash
cd backend && npm run build 2>&1 | tail -10
```

Expected: Build succeeds with no errors

- [ ] **Step 4: Update environment variable documentation**

Remove `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` from any `.env.example` or README that documents required env vars (if they exist). Check:

```bash
grep -r "APNS_" /Users/do.nguyen/personal/family-guy --include="*.md" --include="*.example" --include="*.env*" | grep -v node_modules
```

Remove any found references.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove APNS env var references, verify build clean"
```
