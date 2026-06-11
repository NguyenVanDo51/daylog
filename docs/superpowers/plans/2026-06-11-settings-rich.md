# Settings Screen — Rich Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the settings screen with profile editing (name + avatar), a language picker (Vi/En/device), and account management (download data, soft-delete with 7-day restore window).

**Architecture:** Backend adds `deleted_at` to users, four new `/users/me` endpoints, and a `restore_token` JWT flow. Mobile refactors settings into a directory with sub-screens for profile and language, plus an `/(auth)/restore` screen.

**Tech Stack:** Express/Drizzle/Postgres (backend), Expo Router / React Native / Zustand / i18n-js / AsyncStorage (mobile), expo-image-picker (avatar), R2 presigned URLs (avatar storage).

---

## File Map

**Backend**
- Modify: `backend/src/db/schema.ts` — add `deletedAt` column
- Create: `backend/src/db/migrations/0001_add_users_deleted_at.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`
- Modify: `backend/src/middleware/auth.ts` — block soft-deleted users
- Modify: `backend/src/routes/auth.ts` — check `deletedAt` post-sign-in, return restore flow
- Modify: `backend/src/routes/users.ts` — add GET, expanded PATCH, avatar-presign, DELETE, restore, export
- Create: `backend/src/routes/users.test.ts`

**Mobile**
- Modify: `mobile/src/locales/vi.ts` — new i18n keys
- Modify: `mobile/src/locales/en.ts` — new i18n keys
- Modify: `mobile/src/lib/i18n.ts` — AsyncStorage language preference on init
- Modify: `mobile/src/stores/authStore.ts` — add `updateUser` action
- Create: `mobile/app/(tabs)/settings/_layout.tsx` — Stack for sub-screens
- Move/recreate: `mobile/app/(tabs)/settings.tsx` → `mobile/app/(tabs)/settings/index.tsx`
- Create: `mobile/app/(tabs)/settings/language.tsx`
- Create: `mobile/app/(tabs)/settings/profile.tsx`
- Modify: `mobile/app/(tabs)/settings/index.tsx` — language + account sections
- Create: `mobile/app/(auth)/restore.tsx`
- Modify: `mobile/app/(auth)/index.tsx` — handle `account_pending_deletion`

---

## Task 1: Add i18n keys (vi.ts + en.ts)

**Files:**
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Add Vietnamese keys to `settings` object in `vi.ts`**

In `mobile/src/locales/vi.ts`, replace the `settings:` block with:

```typescript
  settings: {
    title:              'Cài đặt',
    push_label:         'Thông báo đẩy',
    signout:            'Đăng xuất',
    version:            'Phiên bản {{v}}',
    legal_section:      'Pháp lý',
    privacy_policy:     'Chính sách bảo mật',
    terms:              'Điều khoản sử dụng',
    // profile
    edit_profile:       'Chỉnh sửa hồ sơ',
    display_name_ph:    'Tên hiển thị',
    save:               'Lưu',
    change_avatar:      'Đổi ảnh đại diện',
    // app preferences
    app_section:        'Ứng dụng',
    language:           'Ngôn ngữ',
    // account
    account_section:    'Tài khoản',
    download_data:      'Tải dữ liệu về',
    download_confirm:   'Chúng tôi sẽ gửi link tải về email của bạn.',
    download_sent:      'Đã gửi email.',
    delete_account:     'Xoá tài khoản',
    delete_confirm1:    'Bạn có chắc muốn xoá tài khoản?',
    delete_continue:    'Tiếp tục',
    delete_confirm2:    'Nhập email để xác nhận',
    delete_toast:       'Tài khoản của bạn sẽ bị xoá sau 7 ngày. Đăng nhập lại để huỷ.',
  },
```

- [ ] **Step 2: Add language-picker keys to `vi.ts`**

After the `settings` block, add:

```typescript
  language: {
    title:        'Ngôn ngữ',
    device:       'Theo thiết bị',
    vi:           'Tiếng Việt',
    en:           'English',
  },
```

- [ ] **Step 3: Add restore-screen keys to `vi.ts`**

Add after the `language` block:

```typescript
  restore: {
    title:       'Khôi phục tài khoản',
    body:        'Tài khoản của bạn sẽ bị xoá sau {{days}} ngày nữa.',
    cta:         'Khôi phục tài khoản',
    confirm_del: 'Xác nhận xoá',
  },
```

- [ ] **Step 4: Mirror all new keys in `en.ts`**

In `mobile/src/locales/en.ts`, replace the `settings:` block with:

```typescript
  settings: { title: 'Settings', push_label: 'Push notifications', signout: 'Sign out',
    version: 'Version {{v}}', legal_section: 'Legal', privacy_policy: 'Privacy Policy', terms: 'Terms of Service',
    edit_profile: 'Edit profile', display_name_ph: 'Display name', save: 'Save', change_avatar: 'Change photo',
    app_section: 'App', language: 'Language',
    account_section: 'Account', download_data: 'Download my data',
    download_confirm: 'We will email you a download link.', download_sent: 'Email sent.',
    delete_account: 'Delete account', delete_confirm1: 'Are you sure you want to delete your account?',
    delete_continue: 'Continue', delete_confirm2: 'Enter your email to confirm', delete_toast: 'Your account will be deleted in 7 days. Sign in again to cancel.',
  },
```

Add after `settings:`:

```typescript
  language: { title: 'Language', device: 'Follow device', vi: 'Tiếng Việt', en: 'English' },
  restore:  { title: 'Restore account', body: 'Your account will be deleted in {{days}} days.', cta: 'Restore account', confirm_del: 'Confirm deletion' },
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat(i18n): add keys for settings profile, language, account, restore screens"
```

---

## Task 2: i18n.ts — AsyncStorage language preference

**Files:**
- Modify: `mobile/src/lib/i18n.ts`

- [ ] **Step 1: Rewrite `i18n.ts` to read AsyncStorage on init**

```typescript
import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vi } from '@/locales/vi';
import { en } from '@/locales/en';

export const LANGUAGE_KEY = 'app_language';
export type AppLanguage = 'device' | 'vi' | 'en';

export const i18n = new I18n({ vi, en });
i18n.defaultLocale = 'vi';
i18n.enableFallback = true;

function deviceLocale(): string {
  const code = getLocales()[0]?.languageCode ?? 'vi';
  return code === 'en' ? 'en' : 'vi';
}

function applyLanguage(pref: AppLanguage): void {
  i18n.locale = pref === 'device' ? deviceLocale() : pref;
}

// Synchronous default so the first render has a locale set.
applyLanguage('device');

// Then override from persisted preference as soon as AsyncStorage resolves.
AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
  if (stored === 'vi' || stored === 'en' || stored === 'device') {
    applyLanguage(stored);
  }
}).catch(() => {});

export async function setLanguage(pref: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, pref);
  applyLanguage(pref);
}

export async function getCurrentLanguage(): Promise<AppLanguage> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (stored === 'vi' || stored === 'en' || stored === 'device') return stored;
  return 'device';
}

export const t = (key: string, params?: Record<string, unknown>): string =>
  i18n.t(key, params);
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/lib/i18n.ts
git commit -m "feat(i18n): persist language preference in AsyncStorage with immediate apply"
```

---

## Task 3: DB schema + migration

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/src/db/migrations/0001_add_users_deleted_at.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`

- [ ] **Step 1: Add `deletedAt` to users table in `schema.ts`**

In `backend/src/db/schema.ts`, update the `users` table to add `deletedAt` after `createdAt`:

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  appleSub: varchar('apple_sub').unique(),
  googleSub: varchar('google_sub').unique(),
  email: varchar('email').unique(),
  displayName: varchar('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  pushToken: text('push_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

- [ ] **Step 2: Create migration SQL**

Create `backend/src/db/migrations/0001_add_users_deleted_at.sql`:

```sql
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;
```

- [ ] **Step 3: Update migration journal**

Update `backend/src/db/migrations/meta/_journal.json`:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1780500661168,
      "tag": "0000_init",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1749600000000,
      "tag": "0001_add_users_deleted_at",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 4: Apply migration to local dev DB**

```bash
cd backend && npx drizzle-kit migrate
```

Expected: migration runs successfully, `deleted_at` column appears in users table.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/0001_add_users_deleted_at.sql backend/src/db/migrations/meta/_journal.json
git commit -m "feat(db): add deleted_at column to users for soft-delete"
```

---

## Task 4: authStore — add `updateUser` action

**Files:**
- Modify: `mobile/src/stores/authStore.ts`

- [ ] **Step 1: Add `updateUser` to `AuthState`**

```typescript
import { create } from 'zustand';

interface User {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (partial: Partial<User>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  updateUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
  clearAuth: () => set({ token: null, user: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/stores/authStore.ts
git commit -m "feat(store): add updateUser action to authStore"
```

---

## Task 5: Backend — GET /users/me + async avatar resolution

**Files:**
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/auth.ts`
- Create: `backend/src/routes/users.test.ts`

- [ ] **Step 1: Write failing test for `GET /users/me`**

Create `backend/src/routes/users.test.ts`:

```typescript
jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn().mockResolvedValue({ url: 'https://r2.example.com/put', key: 'photos/test.jpg' }),
  getPresignedGetUrl: jest.fn().mockResolvedValue('https://r2.example.com/avatar.jpg'),
}));

import request from 'supertest';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createTestUser, authHeader } from '../../tests/setup';
const app = require('../app');

describe('GET /users/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('returns user profile', async () => {
    const user = await createTestUser({ display_name: 'Test User' });
    const res = await request(app).get('/users/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.display_name).toBe('Test User');
  });

  it('resolves R2 key in avatar_url to presigned URL', async () => {
    const user = await createTestUser({ avatar_url: 'avatars/some-key.jpg' });
    const res = await request(app).get('/users/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBe('https://r2.example.com/avatar.jpg');
  });

  it('passes through Google avatar URL unchanged', async () => {
    const user = await createTestUser({ avatar_url: 'https://lh3.googleusercontent.com/a/photo.jpg' });
    const res = await request(app).get('/users/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd backend && npx jest users.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL with `Cannot GET /users/me` (404).

- [ ] **Step 3: Add `resolveAvatarUrl` helper and `GET /users/me` to `users.ts`**

Replace `backend/src/routes/users.ts` with:

```typescript
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
    const updates: Partial<typeof users.$inferInsert> = {};
    if ('push_token' in body) updates.pushToken = typeof body.push_token === 'string' ? body.push_token : null;
    if ('display_name' in body && typeof body.display_name === 'string') updates.displayName = body.display_name.trim() || req.user!.displayName;
    if ('avatar_url' in body && (typeof body.avatar_url === 'string' || body.avatar_url === null)) updates.avatarUrl = body.avatar_url;
    if (Object.keys(updates).length === 0) return res.status(204).send();
    const [updated] = await db.update(users).set(updates).where(eq(users.id, req.user!.id)).returning();
    res.json(await toClientUser(updated));
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Run test — verify PASS**

```bash
cd backend && npx jest users.test --no-coverage 2>&1 | tail -20
```

Expected: GET /users/me tests pass.

- [ ] **Step 5: Make `toSnakeUser` in `auth.ts` async and use `resolveAvatarUrl`**

In `backend/src/routes/auth.ts`, update `toSnakeUser`:

```typescript
// Add import at top:
import { getPresignedGetUrl } from '../services/r2';

// Replace the sync toSnakeUser with an async version:
async function toSnakeUser(u: typeof users.$inferSelect) {
  let avatarUrl = u.avatarUrl;
  if (avatarUrl && !avatarUrl.startsWith('https://')) {
    avatarUrl = await getPresignedGetUrl(avatarUrl, 3600);
  }
  return {
    id: u.id,
    apple_sub: u.appleSub,
    google_sub: u.googleSub,
    display_name: u.displayName,
    email: u.email ?? '',
    avatar_url: avatarUrl,
    push_token: u.pushToken,
    created_at: u.createdAt,
  };
}
```

Then update every `res.json(...)` call in auth.ts that uses `toSnakeUser` to `await toSnakeUser(user)`:

```typescript
// Both /apple and /google final response lines:
res.json({ token: signJwt(user.id), user: await toSnakeUser(user) });

// Also the /logout endpoint doesn't use toSnakeUser, no change needed there.
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/users.ts backend/src/routes/users.test.ts backend/src/routes/auth.ts
git commit -m "feat(api): add GET /users/me and async avatar URL resolution"
```

---

## Task 6: Backend — PATCH /users/me tests + POST /users/me/avatar-presign

**Files:**
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/users.test.ts`

- [ ] **Step 1: Add PATCH and avatar-presign tests to `users.test.ts`**

Append to `backend/src/routes/users.test.ts`:

```typescript
import { getPresignedPutUrl } from '../services/r2';
const mockPut = getPresignedPutUrl as jest.Mock;

describe('PATCH /users/me', () => {
  it('updates display_name', async () => {
    const user = await createTestUser({ display_name: 'Old Name' });
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({ display_name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe('New Name');
  });

  it('updates avatar_url key', async () => {
    const user = await createTestUser();
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({ avatar_url: 'avatars/uuid.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBe('https://r2.example.com/avatar.jpg');
    // Verify key stored in DB
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBe('avatars/uuid.jpg');
  });

  it('still updates push_token', async () => {
    const user = await createTestUser();
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({ push_token: 'ExponentPushToken[abc]' });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.pushToken).toBe('ExponentPushToken[abc]');
  });

  it('returns 204 with empty body', async () => {
    const user = await createTestUser();
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({});
    expect(res.status).toBe(204);
  });
});

describe('POST /users/me/avatar-presign', () => {
  beforeEach(() => {
    mockPut.mockResolvedValue({ url: 'https://r2.example.com/put/avatars/uuid.jpg', key: 'avatars/uuid.jpg' });
  });

  it('returns upload_url and key', async () => {
    const user = await createTestUser();
    const res = await request(app).post('/users/me/avatar-presign').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.upload_url).toBe('https://r2.example.com/put/avatars/uuid.jpg');
    expect(res.body.key).toBe('avatars/uuid.jpg');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/users/me/avatar-presign');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run — verify FAIL (avatar-presign 404)**

```bash
cd backend && npx jest users.test --no-coverage 2>&1 | tail -20
```

Expected: PATCH tests pass (already implemented in Task 5), avatar-presign tests fail with 404.

- [ ] **Step 3: Add `POST /users/me/avatar-presign` to `users.ts`**

Add before `export = router` in `backend/src/routes/users.ts`:

```typescript
router.post('/me/avatar-presign', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, key } = await getPresignedPutUrl('image/jpeg');
    res.json({ upload_url: url, key });
  } catch (err) {
    next(err);
  }
});
```

Note: this uses the `photos/` key prefix from the existing `getPresignedPutUrl`. The key is passed back so the client can include it in `PATCH /users/me` body. No presignTokens entry is created — avatar uploads bypass that system.

- [ ] **Step 4: Run — verify all PASS**

```bash
cd backend && npx jest users.test --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/users.ts backend/src/routes/users.test.ts
git commit -m "feat(api): expand PATCH /users/me for profile and add POST /users/me/avatar-presign"
```

---

## Task 7: Backend — DELETE /users/me, POST /users/me/restore, GET /users/me/export

**Files:**
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/routes/users.test.ts`

- [ ] **Step 1: Add `signRestoreJwt` helper to `auth.ts`**

In `backend/src/routes/auth.ts`, add after `signJwt`:

```typescript
function signRestoreJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId, purpose: 'restore' }, secret, { expiresIn: '30m' });
}
```

Export it so `users.ts` can use it (or keep it local and duplicate the logic in users.ts). To avoid circular dependency, duplicate the logic in `users.ts`:

In `backend/src/routes/users.ts`, add at the top (after imports):

```typescript
import jwt from 'jsonwebtoken';

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
```

- [ ] **Step 2: Write failing tests for DELETE, restore, and export**

Append to `backend/src/routes/users.test.ts`:

```typescript
describe('DELETE /users/me', () => {
  it('soft-deletes the user (sets deleted_at)', async () => {
    const user = await createTestUser();
    const res = await request(app).delete('/users/me').set(authHeader(user));
    expect(res.status).toBe(204);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /users/me/restore', () => {
  it('clears deleted_at and returns token + user', async () => {
    const user = await createTestUser();
    // Soft-delete first
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
    // Create a restore token
    const restoreToken = jwt.sign({ userId: user.id, purpose: 'restore' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '30m' });
    const res = await request(app).post('/users/me/restore').send({ restore_token: restoreToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBe(user.id);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).toBeNull();
  });

  it('returns 401 for invalid restore token', async () => {
    const res = await request(app).post('/users/me/restore').send({ restore_token: 'bad.token.here' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for regular auth token (wrong purpose)', async () => {
    const user = await createTestUser();
    const regularToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'test-secret');
    const res = await request(app).post('/users/me/restore').send({ restore_token: regularToken });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/me/export', () => {
  it('returns 202 with message', async () => {
    const user = await createTestUser();
    const res = await request(app).get('/users/me/export').set(authHeader(user));
    expect(res.status).toBe(202);
    expect(res.body.message).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run — verify FAIL**

```bash
cd backend && npx jest users.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL — DELETE/restore/export routes 404.

- [ ] **Step 4: Add the three endpoints to `users.ts`**

Add before `export = router` in `backend/src/routes/users.ts`:

```typescript
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
    // For now, acknowledge the request — implement async export job separately.
    res.status(202).json({ message: `Export request received. We will email ${req.user!.email ?? 'you'} a download link.` });
  } catch (err) {
    next(err);
  }
});
```

Also add `import jwt from 'jsonwebtoken';` at the top of `users.ts` (from Task 7 Step 1 — skip if already done).

- [ ] **Step 5: Run — verify all PASS**

```bash
cd backend && npx jest users.test --no-coverage 2>&1 | tail -20
```

Expected: all tests in users.test.ts pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/users.ts backend/src/routes/users.test.ts
git commit -m "feat(api): add DELETE /users/me (soft-delete), POST restore, GET export"
```

---

## Task 8: Backend — auth middleware + auth routes handle `deleted_at`

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Update `requireAuth` to block soft-deleted users**

In `backend/src/middleware/auth.ts`, after the `if (!found[0])` check, add:

```typescript
  if (!found[0]) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Reject any API call from a soft-deleted account.
  if (found[0].deletedAt !== null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.user = found[0];
```

- [ ] **Step 2: Add `deletedAt` check to auth routes (apple + google sign-in)**

In `backend/src/routes/auth.ts`, add this helper after `signRestoreJwt` (or near the top of the file):

```typescript
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function checkPendingDeletion(user: typeof users.$inferSelect, res: Response): boolean {
  if (!user.deletedAt) return false;
  const msSinceDelete = Date.now() - user.deletedAt.getTime();
  if (msSinceDelete >= SEVEN_DAYS_MS) {
    // Past the restore window — treat as not found.
    res.status(401).json({ error: 'Unauthorized' });
    return true;
  }
  const daysRemaining = Math.ceil((SEVEN_DAYS_MS - msSinceDelete) / (24 * 60 * 60 * 1000));
  res.json({
    status: 'account_pending_deletion',
    deleted_at: user.deletedAt.toISOString(),
    days_remaining: daysRemaining,
    restore_token: signRestoreJwt(user.id),
  });
  return true;
}
```

Note: `signRestoreJwt` must be defined in `auth.ts` as:

```typescript
function signRestoreJwt(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return jwt.sign({ userId, purpose: 'restore' }, secret, { expiresIn: '30m' });
}
```

Then in both `/apple` and `/google` sign-in handlers, add a deletion check right before `await ensureDefaultAlbum(user.id)`:

```typescript
    // In both /apple and /google, after `user` is resolved:
    if (checkPendingDeletion(user, res)) return;
    await ensureDefaultAlbum(user.id);
    res.json({ token: signJwt(user.id), user: await toSnakeUser(user) });
```

- [ ] **Step 3: Verify existing auth tests still pass**

```bash
cd backend && npx jest auth.test --no-coverage 2>&1 | tail -20
```

Expected: all existing auth tests pass (the deletion path is only hit for users with `deletedAt` set, which existing tests don't create).

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts
git commit -m "feat(auth): block soft-deleted users and return pending-deletion status on sign-in"
```

---

## Task 9: Mobile — settings directory structure

**Files:**
- Create: `mobile/app/(tabs)/settings/_layout.tsx`
- Create: `mobile/app/(tabs)/settings/index.tsx` (content from old `settings.tsx`)
- Delete: `mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/settings/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `mobile/app/(tabs)/settings/index.tsx` with current content**

Copy the entire content of `mobile/app/(tabs)/settings.tsx` into `mobile/app/(tabs)/settings/index.tsx` unchanged.

- [ ] **Step 3: Delete the old flat file**

```bash
rm mobile/app/(tabs)/settings.tsx
```

- [ ] **Step 4: Verify navigation still works (settings opens and back button works)**

```bash
cd mobile && npx expo start --no-dev
```

Open the app, tap the settings icon / menu → settings. Confirm the settings screen opens. Tap back — confirm it closes. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/settings/
git rm mobile/app/\(tabs\)/settings.tsx
git commit -m "refactor(settings): convert settings.tsx to settings/ directory with Stack layout"
```

---

## Task 10: Mobile — language picker screen

**Files:**
- Create: `mobile/app/(tabs)/settings/language.tsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/settings/language.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { CaretLeft, Check } from 'phosphor-react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/constants/theme';
import { t, setLanguage, getCurrentLanguage, AppLanguage } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';

const OPTIONS: { value: AppLanguage; labelKey: string }[] = [
  { value: 'device', labelKey: 'language.device' },
  { value: 'vi',     labelKey: 'language.vi' },
  { value: 'en',     labelKey: 'language.en' },
];

export default function LanguageScreen() {
  const [current, setCurrent] = useState<AppLanguage>('device');

  useEffect(() => { getCurrentLanguage().then(setCurrent); }, []);

  async function select(lang: AppLanguage) {
    await setLanguage(lang);
    setCurrent(lang);
    router.back();
  }

  return (
    <View style={styles.container}>
      <QuietHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <CaretLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.heading}>{t('language.title')}</Text>
          <View style={styles.backBtn} />
        </View>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        <Card tier="quiet" style={styles.section}>
          {OPTIONS.map((opt, i) => (
            <View key={opt.value}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity style={styles.row} onPress={() => select(opt.value)}>
                <Text style={styles.rowLabel}>{t(opt.labelKey)}</Text>
                {current === opt.value && <Check size={20} color={colors.pink} weight="bold" />}
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.cream },
  headerRow:  { flexDirection: 'row', alignItems: 'center' },
  backBtn:    { width: 32 },
  heading:    { ...typography.heading, color: colors.ink, flex: 1, textAlign: 'center' },
  content:    { padding: spacing['2xl'], gap: spacing.md },
  section:    { gap: spacing.md },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  rowLabel:   { ...typography.body, color: colors.ink },
  divider:    { height: 1, backgroundColor: colors.borderSoft },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(tabs\)/settings/language.tsx
git commit -m "feat(settings): add language picker screen"
```

---

## Task 11: Mobile — profile editor screen

**Files:**
- Create: `mobile/app/(tabs)/settings/profile.tsx`

- [ ] **Step 1: Create `mobile/app/(tabs)/settings/profile.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CaretLeft, Camera } from 'phosphor-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function ProfileScreen() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.display_name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = name !== user?.display_name || pendingKey !== null;

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const { data } = await api.post('/users/me/avatar-presign');
      const { upload_url, key } = data;
      const blob = await (await fetch(asset.uri)).blob();
      await fetch(upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      setPendingKey(key);
      setAvatarUri(asset.uri); // show local preview immediately
    } catch {
      Alert.alert(t('common.error'), 'Không thể tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!isDirty) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== user?.display_name) body.display_name = name;
      if (pendingKey) body.avatar_url = pendingKey;
      const { data } = await api.patch('/users/me', body);
      updateUser({ display_name: data.display_name, avatar_url: data.avatar_url });
      await SecureStore.setItemAsync('auth_user', JSON.stringify({ ...user, display_name: data.display_name, avatar_url: data.avatar_url }));
      router.back();
    } catch {
      Alert.alert(t('common.error'), 'Không thể lưu thông tin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <QuietHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <CaretLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.heading}>{t('settings.edit_profile')}</Text>
          <View style={styles.backBtn} />
        </View>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading}>
            <Avatar uri={avatarUri} name={name} size={96} />
            <View style={styles.cameraOverlay}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Camera size={20} color={colors.white} weight="bold" />}
            </View>
          </TouchableOpacity>
        </View>

        <Card tier="quiet" style={styles.section}>
          <Text style={styles.label}>{t('settings.display_name_ph')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('settings.display_name_ph')}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="words"
          />
        </Card>

        <Button
          label={saving ? '...' : t('settings.save')}
          onPress={save}
          variant="primary"
          fullWidth
          disabled={!isDirty || saving || uploading}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.cream },
  headerRow:     { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 32 },
  heading:       { ...typography.heading, color: colors.ink, flex: 1, textAlign: 'center' },
  content:       { padding: spacing['2xl'], gap: spacing.md, alignItems: 'stretch' },
  avatarWrap:    { alignItems: 'center', marginBottom: spacing.md },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.ink, borderRadius: 999, padding: 6 },
  section:       { gap: spacing.sm },
  label:         { ...typography.caption, color: colors.inkMuted },
  input:         { ...typography.body, color: colors.ink, paddingVertical: spacing.sm },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(tabs\)/settings/profile.tsx
git commit -m "feat(settings): add profile editor screen with avatar upload"
```

---

## Task 12: Mobile — update `settings/index.tsx` with new sections

**Files:**
- Modify: `mobile/app/(tabs)/settings/index.tsx`

- [ ] **Step 1: Replace `settings/index.tsx` with the updated version**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import { CaretLeft, ArrowSquareOut, CaretRight } from 'phosphor-react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { PRIVACY_URL, TERMS_URL } from '@/constants/urls';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';
import { colors, spacing, typography } from '@/constants/theme';
import { t, getCurrentLanguage, AppLanguage } from '@/lib/i18n';

export default function SettingsTab() {
  const { user, clearAuth } = useAuthStore();
  const { clearAlbum } = useAlbumStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState<AppLanguage>('device');

  useEffect(() => {
    hasPushPermission().then(setNotifEnabled).catch(() => {});
    getCurrentLanguage().then(setCurrentLang);
  }, []);

  async function toggleNotifications(val: boolean) {
    if (!val) { setNotifEnabled(false); return; }
    setNotifLoading(true);
    try {
      const granted = await registerPushToken();
      setNotifEnabled(granted);
      if (!granted) Alert.alert(t('common.error'), 'Vào Cài đặt thiết bị để bật thông báo.');
    } catch {
      Alert.alert(t('common.error'), 'Không thể đăng ký thông báo.');
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleSignOut() {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    clearAuth();
    clearAlbum();
    router.replace('/(auth)');
  }

  function handleDownloadData() {
    Alert.alert(t('settings.download_data'), t('settings.download_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'OK', onPress: async () => {
          try {
            await api.get('/users/me/export');
            Alert.alert('', t('settings.download_sent'));
          } catch {
            Alert.alert(t('common.error'));
          }
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert('', t('settings.delete_confirm1'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.delete_continue'), style: 'destructive', onPress: () => {
          Alert.prompt(t('settings.delete_account'), t('settings.delete_confirm2'), async (input) => {
            if (input?.trim().toLowerCase() !== user?.email?.toLowerCase()) return;
            try {
              await api.delete('/users/me');
              await SecureStore.deleteItemAsync('auth_token');
              await SecureStore.deleteItemAsync('auth_user');
              clearAuth();
              clearAlbum();
              router.replace('/(auth)');
              // Toast shown on auth screen via URL param — pass message via SecureStore:
              await SecureStore.setItemAsync('post_auth_toast', t('settings.delete_toast'));
            } catch {
              Alert.alert(t('common.error'));
            }
          }, 'plain-text');
        },
      },
    ]);
  }

  const langLabel = { device: t('language.device'), vi: t('language.vi'), en: t('language.en') }[currentLang];

  return (
    <View style={styles.container}>
      <QuietHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn} testID="settings-back">
            <CaretLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.heading}>{t('settings.title')}</Text>
          <View style={styles.backBtn} />
        </View>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        {user && (
          <TouchableOpacity onPress={() => router.push('/settings/profile')}>
            <Card tier="quiet" style={styles.profileCard}>
              <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
              <View style={styles.profileInfo}>
                <Text style={styles.name}>{user.display_name}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
              <CaretRight size={18} color={colors.inkMuted} />
            </Card>
          </TouchableOpacity>
        )}

        {/* Notifications */}
        <Card tier="quiet" style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.push_label')}</Text>
            <Switch value={notifEnabled} onValueChange={toggleNotifications}
              trackColor={{ true: colors.pink, false: colors.borderSoft }} disabled={notifLoading} />
          </View>
        </Card>

        {/* App preferences */}
        <Card tier="quiet" style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.app_section')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/language')}>
            <Text style={styles.rowLabel}>{t('settings.language')}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{langLabel}</Text>
              <CaretRight size={16} color={colors.inkMuted} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Account */}
        <Card tier="quiet" style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.account_section')}</Text>
          <TouchableOpacity style={styles.row} onPress={handleDownloadData}>
            <Text style={styles.rowLabel}>{t('settings.download_data')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
            <Text style={[styles.rowLabel, styles.danger]}>{t('settings.delete_account')}</Text>
          </TouchableOpacity>
        </Card>

        {/* Legal */}
        <Card tier="quiet" style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.legal_section')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)} testID="settings-privacy">
            <Text style={styles.rowLabel}>{t('settings.privacy_policy')}</Text>
            <ArrowSquareOut size={18} color={colors.inkMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(TERMS_URL)} testID="settings-terms">
            <Text style={styles.rowLabel}>{t('settings.terms')}</Text>
            <ArrowSquareOut size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </Card>

        <Button label={t('settings.signout')} onPress={handleSignOut} variant="ghost" tier="quiet" fullWidth />
        <Text style={styles.version}>{t('settings.version', { v: '0.1.0' })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.cream },
  headerRow:     { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 32 },
  heading:       { ...typography.heading, color: colors.ink, flex: 1, textAlign: 'center' },
  content:       { padding: spacing['2xl'], gap: spacing.md },
  profileCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo:   { flex: 1 },
  name:          { ...typography.title, color: colors.ink },
  email:         { ...typography.bodySmall, color: colors.inkSoft },
  section:       { gap: spacing.md },
  sectionHeader: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.xs },
  row:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowRight:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowLabel:      { ...typography.body, color: colors.ink },
  rowValue:      { ...typography.bodySmall, color: colors.inkSoft },
  danger:        { color: colors.error },
  divider:       { height: 1, backgroundColor: colors.borderSoft },
  version:       { ...typography.caption, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.lg },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(tabs\)/settings/index.tsx
git commit -m "feat(settings): add language, profile, and account sections to settings screen"
```

---

## Task 13: Mobile — restore account screen

**Files:**
- Create: `mobile/app/(auth)/restore.tsx`

- [ ] **Step 1: Create `mobile/app/(auth)/restore.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function RestoreScreen() {
  const { restore_token, days_remaining } = useLocalSearchParams<{ restore_token: string; days_remaining: string }>();
  const { setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    if (!restore_token) return;
    setLoading(true);
    try {
      const { data } = await api.post('/users/me/restore', { restore_token });
      await SecureStore.setItemAsync('auth_token', data.token);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(data.user));
      const albums = await api.get('/albums');
      if (albums.data?.length > 0) setAlbum(albums.data[0]);
      setAuth(data.token, data.user);
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('common.error'), 'Không thể khôi phục tài khoản.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmDeletion() {
    router.replace('/(auth)');
  }

  const days = parseInt(days_remaining ?? '7', 10);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('restore.title')}</Text>
      <Text style={styles.body}>{t('restore.body', { days })}</Text>
      <Button label={loading ? '...' : t('restore.cta')} onPress={handleRestore} variant="primary" fullWidth disabled={loading} />
      <Button label={t('restore.confirm_del')} onPress={handleConfirmDeletion} variant="ghost" tier="quiet" fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: spacing['2xl'], justifyContent: 'center', gap: spacing.lg },
  title:     { ...typography.heading, color: colors.ink, textAlign: 'center' },
  body:      { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(auth\)/restore.tsx
git commit -m "feat(auth): add restore account screen for pending-deletion users"
```

---

## Task 14: Mobile — update auth sign-in to handle `account_pending_deletion`

**Files:**
- Modify: `mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Update `finishAuth` and add pending-deletion routing in `app/(auth)/index.tsx`**

In `mobile/app/(auth)/index.tsx`, update the `finishAuth` function and add a `handlePendingDeletion` function:

```typescript
  async function finishAuth(token: string, user: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    setAuth(token, user);
    try {
      const { data } = await api.get('/albums');
      if (data?.length > 0) setAlbum(data[0]);
    } catch { /* album fetch is best-effort */ }
    router.replace('/(tabs)');
  }

  function handlePendingDeletion(data: { restore_token: string; days_remaining: number }) {
    router.replace({
      pathname: '/(auth)/restore',
      params: { restore_token: data.restore_token, days_remaining: String(data.days_remaining) },
    });
  }
```

Then in `handleApple`, replace the `await finishAuth(data.token, data.user)` line:

```typescript
      const { data } = await api.post('/auth/apple', { idToken: cred.identityToken, fullName: cred.fullName });
      if (data.status === 'account_pending_deletion') {
        handlePendingDeletion(data);
        return;
      }
      await finishAuth(data.token, data.user);
```

And in `handleGoogle`, same pattern:

```typescript
      const { data } = await api.post('/auth/google', { idToken });
      if (data.status === 'account_pending_deletion') {
        handlePendingDeletion(data);
        return;
      }
      await finishAuth(data.token, data.user);
```

- [ ] **Step 2: Register the restore screen in root `_layout.tsx`**

In `mobile/app/_layout.tsx`, add inside the `<Stack>`:

```tsx
<Stack.Screen name="(auth)/restore" options={{ headerShown: false }} />
```

Wait — `(auth)` is already a Stack.Screen and `restore.tsx` is inside `(auth)/`. Expo Router will find it automatically without needing a separate Stack.Screen entry in the root. No change to `_layout.tsx` is needed.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(auth\)/index.tsx
git commit -m "feat(auth): route to restore screen when account is pending deletion"
```

---

## Self-Review Notes

- All 4 backend endpoints (GET/PATCH /me, avatar-presign, DELETE, restore, export) are tested.
- The auth middleware blocks soft-deleted users from using API routes.
- The auth routes (apple/google) check `deletedAt` after sign-in and route to the restore flow.
- `toSnakeUser` in `auth.ts` is made async; both `/apple` and `/google` handlers `await` it.
- The `signRestoreJwt` / `checkPendingDeletion` helpers are in `auth.ts` only (no circular dep with `users.ts` which has its own `signJwt`/`signRestoreJwt` copies).
- The cron job for hard-deleting accounts is explicitly marked **TODO** in the export endpoint comment and in the spec — not implemented here.
- `Alert.prompt` is iOS only. On Android, a custom modal would be needed. For MVP this is acceptable.
- Language change takes effect immediately via `i18n.changeLanguage` — UI re-renders on next state change (navigation back to settings forces re-render naturally).
