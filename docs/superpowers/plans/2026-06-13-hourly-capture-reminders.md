# Hourly Capture Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend cron pushes 7 random motivational reminders/day to users at their local 9/11/13/15/17/19/21, language-aware (vi/en), configurable via Settings toggle.

**Architecture:** `node-cron` runs every 30 min UTC inside the API process. Iterates users, computes each user's local hour with `date-fns-tz`, checks slot membership + 90-min idempotency, picks a random message from per-language bank (avoiding the 3 most recent IDs), pushes via existing `sendPush()` from `services/push.ts`. Mobile PATCHes `timezone` + `language` alongside `push_token` on `/users/me`, plus a separate Settings toggle for `reminders_enabled`.

**Tech Stack:** Drizzle ORM, Postgres, `expo-server-sdk`, `node-cron` (new), `date-fns-tz` (already installed), Jest. Mobile: Expo SDK 56, `Intl.DateTimeFormat`, `expo-localization`.

---

## File Structure

**New:**
- `backend/src/db/migrations/0004_user_reminder_prefs.sql`
- `backend/src/services/reminderMessages.ts` + `.test.ts`
- `backend/src/services/reminderCron.ts` + `.test.ts`

**Modify:**
- `backend/src/db/schema.ts` — add 5 columns to `users`
- `backend/src/routes/users.ts` — extend PATCH `/me` + GET `/me` response
- `backend/src/routes/users.test.ts` — new cases
- `backend/src/index.ts` — start cron
- `backend/package.json` — add `node-cron`
- `mobile/src/lib/notifications.ts` + `.test.ts` — send timezone + language
- `mobile/app/(tabs)/settings/index.tsx` — toggle row
- `mobile/app/(tabs)/__tests__/settings.test.tsx` — toggle assertions
- `mobile/src/locales/vi.ts` + `en.ts` — settings strings

---

### Task 1: DB migration + schema

**Files:**
- Create: `backend/src/db/migrations/0004_user_reminder_prefs.sql`
- Modify: `backend/src/db/schema.ts` (users table, around lines 19–29)

- [ ] **Step 1: Create the migration SQL**

Create `backend/src/db/migrations/0004_user_reminder_prefs.sql`:

```sql
ALTER TABLE users
  ADD COLUMN timezone                  TEXT      NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN language                  TEXT      NOT NULL DEFAULT 'vi',
  ADD COLUMN reminders_enabled         BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN last_reminder_sent_at     TIMESTAMPTZ,
  ADD COLUMN last_reminder_message_ids INTEGER[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Update schema.ts**

In `backend/src/db/schema.ts`, append these fields to the `users` definition (before the closing `})`):

```ts
timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
language: text('language').notNull().default('vi'),
remindersEnabled: boolean('reminders_enabled').notNull().default(true),
lastReminderSentAt: timestamp('last_reminder_sent_at', { withTimezone: true }),
lastReminderMessageIds: integer('last_reminder_message_ids').array().notNull().default([]),
```

`integer` is already imported at top of file.

- [ ] **Step 3: Apply the migration**

```bash
cd backend
psql "$DATABASE_URL" -f src/db/migrations/0004_user_reminder_prefs.sql
psql "$DATABASE_URL" -c "\d users"
```

Expect: 5 new columns visible (`timezone`, `language`, `reminders_enabled`, `last_reminder_sent_at`, `last_reminder_message_ids`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/0004_user_reminder_prefs.sql backend/src/db/schema.ts
git commit -m "feat(backend): add users.timezone/language/reminders columns"
```

---

### Task 2: reminderMessages module (TDD)

**Files:**
- Create: `backend/src/services/reminderMessages.ts`
- Create: `backend/src/services/reminderMessages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/reminderMessages.test.ts`:

```ts
import { pickMessage, MESSAGES } from './reminderMessages';

describe('reminderMessages', () => {
  it('has 10 Vietnamese messages with ids 1–10', () => {
    expect(MESSAGES.vi).toHaveLength(10);
    expect(MESSAGES.vi.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('has 10 English messages with matching ids', () => {
    expect(MESSAGES.en).toHaveLength(10);
    expect(MESSAGES.en.map((m) => m.id)).toEqual(MESSAGES.vi.map((m) => m.id));
  });
  it('returns a Vietnamese message for language=vi', () => {
    const msg = pickMessage('vi', []);
    expect(MESSAGES.vi.find((m) => m.id === msg.id)).toBeDefined();
  });
  it('avoids ids in the exclude list when alternatives exist', () => {
    const exclude = [1, 2, 3];
    for (let i = 0; i < 100; i++) {
      const msg = pickMessage('vi', exclude);
      expect(exclude).not.toContain(msg.id);
    }
  });
  it('falls back to the full bank when exclude covers everything', () => {
    const allIds = MESSAGES.vi.map((m) => m.id);
    const msg = pickMessage('vi', allIds);
    expect(allIds).toContain(msg.id);
  });
  it('falls back to vi when language is unknown', () => {
    const msg = pickMessage('xx', []);
    expect(MESSAGES.vi.find((m) => m.id === msg.id)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend
npx jest src/services/reminderMessages.test.ts
```

Expect: "Cannot find module './reminderMessages'".

- [ ] **Step 3: Implement the module**

Create `backend/src/services/reminderMessages.ts`:

```ts
export interface ReminderMessage {
  id: number;
  title: string;
  body: string;
}

const VI: ReminderMessage[] = [
  { id: 1,  title: 'Hôm nay đẹp ghê',         body: 'Có khoảnh khắc nào đáng giữ không?' },
  { id: 2,  title: 'Đôi khi chỉ cần 2 giây',  body: 'Bấm máy thử xem nào' },
  { id: 3,  title: '5 năm nữa nhìn lại…',     body: 'Bạn sẽ mừng vì có hôm nay' },
  { id: 4,  title: 'Còn thở là còn thương',   body: 'Lưu lại một khoảnh khắc nho nhỏ?' },
  { id: 5,  title: 'Bình thường thôi nhưng…', body: 'Ngày mai sẽ thành kỷ niệm' },
  { id: 6,  title: 'Có gì hay ho?',           body: 'Kể cho mình nghe bằng một tấm ảnh' },
  { id: 7,  title: 'Đời ngắn lắm',            body: 'Đừng để hôm nay trôi qua không dấu vết' },
  { id: 8,  title: '2 giây thôi',             body: "Quay 1 video ngắn cho 'mình ngày sau' xem" },
  { id: 9,  title: 'Bạn đang ở đâu giờ này?', body: 'Khoe một chút coi' },
  { id: 10, title: 'Một việc nhỏ',            body: 'Giữ lại khoảnh khắc này, mai sẽ thấy quý' },
];

const EN: ReminderMessage[] = [
  { id: 1,  title: 'Today looks lovely',       body: 'Anything worth saving right now?' },
  { id: 2,  title: 'Just two seconds',         body: 'Tap the shutter, see what you get' },
  { id: 3,  title: '5 years from now…',        body: "You'll thank yourself for today" },
  { id: 4,  title: "While you're here",        body: 'Hold on to a small moment?' },
  { id: 5,  title: 'Ordinary, but…',           body: "Tomorrow it'll be a memory" },
  { id: 6,  title: 'Anything interesting?',    body: 'Tell me with one photo' },
  { id: 7,  title: "Life's short",             body: "Don't let today slip through" },
  { id: 8,  title: 'Two seconds is enough',    body: "Film a short clip for 'future you'" },
  { id: 9,  title: 'Where are you right now?', body: 'Show me a little' },
  { id: 10, title: 'A small thing',            body: "Keep this moment — you'll be glad tomorrow" },
];

export const MESSAGES: Record<'vi' | 'en', ReminderMessage[]> = { vi: VI, en: EN };

export function pickMessage(language: string, exclude: number[]): ReminderMessage {
  const bank = language === 'en' ? MESSAGES.en : MESSAGES.vi;
  const available = bank.filter((m) => !exclude.includes(m.id));
  const pool = available.length > 0 ? available : bank;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/services/reminderMessages.test.ts
```

Expect: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/reminderMessages.ts backend/src/services/reminderMessages.test.ts
git commit -m "feat(backend): reminder message bank vi+en with picker"
```

---

### Task 3: PATCH /users/me accepts new fields (TDD)

**Files:**
- Modify: `backend/src/routes/users.ts` (the `router.patch('/me', …)` handler, around lines 42–58)
- Modify: `backend/src/routes/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `backend/src/routes/users.test.ts`. Find the existing PATCH `/me` describe block (grep `PATCH.*me\|patch.*/me`). Append:

```ts
it('updates timezone, language, reminders_enabled', async () => {
  const user = await makeUser();
  const res = await request(app)
    .patch('/users/me')
    .set(authHeader(user))
    .send({ timezone: 'America/Los_Angeles', language: 'en', reminders_enabled: false });
  expect(res.status).toBe(200);
  const { rows } = await pool.query(
    `SELECT timezone, language, reminders_enabled FROM users WHERE id = $1`,
    [user.id],
  );
  expect(rows[0].timezone).toBe('America/Los_Angeles');
  expect(rows[0].language).toBe('en');
  expect(rows[0].reminders_enabled).toBe(false);
});

it('rejects invalid timezone with 400', async () => {
  const user = await makeUser();
  const res = await request(app)
    .patch('/users/me')
    .set(authHeader(user))
    .send({ timezone: 'Not/A/Real/Zone' });
  expect(res.status).toBe(400);
});

it('coerces non-whitelisted language to vi', async () => {
  const user = await makeUser();
  await request(app).patch('/users/me').set(authHeader(user)).send({ language: 'xx' });
  const { rows } = await pool.query(`SELECT language FROM users WHERE id = $1`, [user.id]);
  expect(rows[0].language).toBe('vi');
});
```

Reuse existing helpers (`makeUser`, `authHeader`, `app`, `pool`) — they are already in the file.

- [ ] **Step 2: Run to verify failure**

```bash
cd backend
npx jest src/routes/users.test.ts -t "timezone|language|reminders_enabled"
```

Expect: 3 failing.

- [ ] **Step 3: Extend the PATCH handler**

In `backend/src/routes/users.ts`, replace the body of `router.patch('/me', …)` with:

```ts
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
    if ('timezone' in body && typeof body.timezone === 'string') {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
      } catch {
        return res.status(400).json({ error: 'invalid_timezone' });
      }
      updates.timezone = body.timezone;
    }
    if ('language' in body && typeof body.language === 'string') {
      updates.language = body.language === 'en' ? 'en' : 'vi';
    }
    if ('reminders_enabled' in body && typeof body.reminders_enabled === 'boolean') {
      updates.remindersEnabled = body.reminders_enabled;
    }
    if (Object.keys(updates).length === 0) return res.status(204).send();
    const [updated] = await db.update(users).set(updates).where(eq(users.id, req.user!.id)).returning();
    res.json(await toClientUser(updated));
  } catch (err) {
    next(err);
  }
});
```

Also expose `reminders_enabled` in the GET response. Update `toClientUser`:

```ts
async function toClientUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    display_name: u.displayName,
    email: u.email ?? '',
    avatar_url: await resolveAvatarUrl(u.avatarUrl),
    push_token: u.pushToken,
    reminders_enabled: u.remindersEnabled,
  };
}
```

Add a GET test alongside:

```ts
it('GET /me returns reminders_enabled', async () => {
  const user = await makeUser();
  const res = await request(app).get('/users/me').set(authHeader(user));
  expect(res.body.reminders_enabled).toBe(true);
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/routes/users.test.ts
```

Expect: all new cases plus the existing pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/users.ts backend/src/routes/users.test.ts
git commit -m "feat(backend): PATCH /users/me accepts timezone+language+reminders_enabled"
```

---

### Task 4: reminderCron service (TDD)

**Files:**
- Create: `backend/src/services/reminderCron.ts`
- Create: `backend/src/services/reminderCron.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/reminderCron.test.ts`:

```ts
import { runReminderCron } from './reminderCron';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import * as pushModule from './push';

jest.mock('./push');
const mockSendPush = pushModule.sendPush as jest.MockedFunction<typeof pushModule.sendPush>;

const createdIds: string[] = [];
async function makeUser(opts: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db.insert(users).values({
    displayName: 'Test',
    pushToken: 'ExponentPushToken[abc]',
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'vi',
    remindersEnabled: true,
    ...opts,
  }).returning();
  createdIds.push(u.id);
  return u;
}

beforeEach(() => {
  mockSendPush.mockReset();
  mockSendPush.mockResolvedValue();
});

afterEach(async () => {
  if (createdIds.length) {
    await db.delete(users).where(inArray(users.id, createdIds));
    createdIds.length = 0;
  }
});

describe('runReminderCron', () => {
  it('sends to a user at a local reminder hour and updates state', async () => {
    const user = await makeUser();
    // 9:00 Asia/Ho_Chi_Minh (UTC+7) = 02:00 UTC
    const now = new Date('2026-06-13T02:00:00Z');
    await runReminderCron(now);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(updated.lastReminderSentAt).toBeTruthy();
    expect(updated.lastReminderMessageIds).toHaveLength(1);
  });

  it('skips when reminders_enabled is false', async () => {
    await makeUser({ remindersEnabled: false });
    await runReminderCron(new Date('2026-06-13T02:00:00Z'));
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips when push_token is null', async () => {
    await makeUser({ pushToken: null });
    await runReminderCron(new Date('2026-06-13T02:00:00Z'));
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips when local hour is not a slot', async () => {
    await makeUser();
    // 10:00 VN = not a slot (slots: 9, 11, 13, 15, 17, 19, 21)
    await runReminderCron(new Date('2026-06-13T03:00:00Z'));
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips when last_reminder_sent_at < 90 min ago', async () => {
    const now = new Date('2026-06-13T02:00:00Z');
    const recent = new Date(now.getTime() - 30 * 60 * 1000);
    await makeUser({ lastReminderSentAt: recent });
    await runReminderCron(now);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('sends when last_reminder_sent_at > 90 min ago and slot matches', async () => {
    const now = new Date('2026-06-13T02:00:00Z');
    const old = new Date(now.getTime() - 100 * 60 * 1000);
    await makeUser({ lastReminderSentAt: old });
    await runReminderCron(now);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  it('respects per-user timezone (LA user at 9am PDT)', async () => {
    await makeUser({ timezone: 'America/Los_Angeles' });
    // 9:00 PDT (UTC-7 in June) = 16:00 UTC
    await runReminderCron(new Date('2026-06-13T16:00:00Z'));
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  it('prepends new message id and keeps only last 3', async () => {
    const user = await makeUser({ lastReminderMessageIds: [3, 4, 5] });
    await runReminderCron(new Date('2026-06-13T02:00:00Z'));
    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(updated.lastReminderMessageIds).toHaveLength(3);
    expect(updated.lastReminderMessageIds[1]).toBe(3);
    expect(updated.lastReminderMessageIds[2]).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend
npx jest src/services/reminderCron.test.ts
```

Expect: "Cannot find module './reminderCron'".

- [ ] **Step 3: Implement the cron logic**

Create `backend/src/services/reminderCron.ts`:

```ts
import { sql, eq } from 'drizzle-orm';
import { toZonedTime } from 'date-fns-tz';
import { db } from '../db';
import { users } from '../db/schema';
import { sendPush } from './push';
import { pickMessage } from './reminderMessages';

const REMINDER_HOURS: ReadonlySet<number> = new Set([9, 11, 13, 15, 17, 19, 21]);
const MIN_GAP_MS = 90 * 60 * 1000;

export async function runReminderCron(now: Date = new Date()): Promise<void> {
  const candidates = await db.select().from(users);
  for (const u of candidates) {
    if (!u.remindersEnabled) continue;
    if (!u.pushToken) continue;
    if (u.deletedAt) continue;
    let localHour: number;
    try {
      localHour = toZonedTime(now, u.timezone).getHours();
    } catch {
      continue;
    }
    if (!REMINDER_HOURS.has(localHour)) continue;
    if (u.lastReminderSentAt && now.getTime() - u.lastReminderSentAt.getTime() < MIN_GAP_MS) continue;

    const msg = pickMessage(u.language, u.lastReminderMessageIds ?? []);
    await sendPush([u.pushToken], msg.title, msg.body, { kind: 'capture-reminder', messageId: msg.id });
    await db.update(users)
      .set({
        lastReminderSentAt: now,
        lastReminderMessageIds: sql`(array_prepend(${msg.id}, ${users.lastReminderMessageIds}))[1:3]`,
      })
      .where(eq(users.id, u.id));
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/services/reminderCron.test.ts
```

Expect: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/reminderCron.ts backend/src/services/reminderCron.test.ts
git commit -m "feat(backend): reminderCron sends per-user slot reminders"
```

---

### Task 5: Wire cron into server startup

**Files:**
- Modify: `backend/package.json` (add `node-cron`)
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Install node-cron**

```bash
cd backend
npm install node-cron @types/node-cron
```

- [ ] **Step 2: Update index.ts**

Replace `backend/src/index.ts` with:

```ts
import 'dotenv/config';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV ?? 'development',
});

// require AFTER Sentry.init so pg/Express are instrumented
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: import('express').Application = require('./app');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cron = require('node-cron');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runReminderCron } = require('./services/reminderCron');

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => console.log(`API running on port ${port}`));

cron.schedule(
  '*/30 * * * *',
  () => {
    runReminderCron().catch((err: unknown) => console.error('reminderCron failed:', err));
  },
  { timezone: 'UTC' },
);
```

- [ ] **Step 3: Smoke run**

```bash
cd backend
npm run build && node dist/index.js
```

Expect: `API running on port 3000`. Wait 35 seconds — if the cron tick fires and `reminderCron failed` does NOT appear, OK. Kill the process.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/index.ts
git commit -m "feat(backend): schedule reminderCron every 30 min on boot"
```

---

### Task 6: Mobile — send timezone + language with push token (TDD)

**Files:**
- Modify: `mobile/src/lib/notifications.ts`
- Modify: `mobile/src/lib/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

In `mobile/src/lib/notifications.test.ts`, locate the `describe('registerPushToken', …)` block. Add:

```ts
it('PATCHes /users/me with timezone and language alongside push_token', async () => {
  await registerPushToken();
  expect(api.patch).toHaveBeenCalledWith(
    '/users/me',
    expect.objectContaining({
      push_token: expect.any(String),
      timezone: expect.any(String),
      language: expect.stringMatching(/^(vi|en)$/),
    }),
  );
});
```

If the file mocks `expo-localization`, ensure it returns `[{ languageCode: 'vi' }]`. If not mocked, add at top of file:

```ts
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi' }],
}));
```

- [ ] **Step 2: Run to verify failure**

```bash
cd mobile
npx jest src/lib/notifications.test.ts
```

Expect: assertion failure on missing `timezone`.

- [ ] **Step 3: Update notifications.ts**

Replace `mobile/src/lib/notifications.ts` with:

```ts
import * as Notifications from 'expo-notifications';
import * as Localization from 'expo-localization';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

function detectLanguage(): 'vi' | 'en' {
  const top = Localization.getLocales()[0]?.languageCode ?? 'vi';
  return top === 'en' ? 'en' : 'vi';
}

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = detectLanguage();
  await api.patch('/users/me', { push_token: token, timezone, language });
  return true;
}

export async function hasPushPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
```

Verify `expo-localization` is installed:

```bash
cd mobile
npm ls expo-localization
```

If missing, install with `npx expo install expo-localization`.

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/lib/notifications.test.ts
```

Expect: all pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/notifications.ts mobile/src/lib/notifications.test.ts
git commit -m "feat(mobile): send timezone+language with push token"
```

If `expo-localization` was newly installed, also stage `mobile/package.json` and `mobile/package-lock.json` in the same commit.

---

### Task 7: Mobile — Settings reminders toggle (TDD)

**Files:**
- Modify: `mobile/src/locales/vi.ts` + `mobile/src/locales/en.ts`
- Modify: `mobile/app/(tabs)/settings/index.tsx`
- Modify: `mobile/app/(tabs)/__tests__/settings.test.tsx`

- [ ] **Step 1: Add i18n strings**

In `mobile/src/locales/vi.ts`, inside the `settings` block, add:

```ts
reminders_label: 'Nhắc ghi khoảnh khắc',
reminders_hint:  '7 nhắc/ngày từ 9h sáng đến 9h tối',
```

In `mobile/src/locales/en.ts`, inside the `settings` block, mirror:

```ts
reminders_label: 'Capture reminders',
reminders_hint:  '7 nudges per day, 9am–9pm',
```

- [ ] **Step 2: Write the failing test**

In `mobile/app/(tabs)/__tests__/settings.test.tsx`, locate the existing mocks. Ensure:
- `hasPushPermission` is mocked to return `true` in the new cases.
- `api.get` is mocked to return `{ data: { reminders_enabled: true } }`.
- `api.patch` is mocked (likely already).

Add inside the test file's main describe block:

```ts
it('renders reminders toggle when push permission is granted', async () => {
  (hasPushPermission as jest.Mock).mockResolvedValue(true);
  (api.get as jest.Mock).mockResolvedValue({ data: { reminders_enabled: true } });
  const { findByTestId } = render(<SettingsTab />);
  await findByTestId('reminders-toggle');
});

it('PATCHes reminders_enabled=false when toggled off', async () => {
  (hasPushPermission as jest.Mock).mockResolvedValue(true);
  (api.get as jest.Mock).mockResolvedValue({ data: { reminders_enabled: true } });
  const { findByTestId } = render(<SettingsTab />);
  const toggle = await findByTestId('reminders-toggle');
  fireEvent(toggle, 'valueChange', false);
  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledWith('/users/me', { reminders_enabled: false });
  });
});
```

Imports needed at top if not present: `fireEvent`, `waitFor` from `@testing-library/react-native`; `api` from `@/lib/api`; `hasPushPermission` from `@/lib/notifications`.

- [ ] **Step 3: Run to verify failure**

```bash
cd mobile
npx jest "app/\(tabs\)/__tests__/settings.test.tsx" -t "reminders"
```

Expect: testID `reminders-toggle` not found.

- [ ] **Step 4: Update settings UI**

In `mobile/app/(tabs)/settings/index.tsx`, locate the existing notifications row (look for `notifEnabled` / `toggleNotifications`). Note the wrapper style used (likely `styles.row` or similar inside a `StickerCard`).

Add state and handler near the existing `notifEnabled`:

```ts
const [remindersEnabled, setRemindersEnabled] = useState(true);

async function toggleReminders(val: boolean) {
  setRemindersEnabled(val);
  try {
    await api.patch('/users/me', { reminders_enabled: val });
  } catch {
    setRemindersEnabled(!val);
  }
}
```

Extend the existing `useEffect` that loads `hasPushPermission` to also fetch initial reminders state:

```ts
useEffect(() => {
  hasPushPermission().then(setNotifEnabled).catch(() => {});
  getCurrentLanguage().then(setCurrentLang);
  api.get('/users/me')
    .then((res) => setRemindersEnabled(res.data.reminders_enabled ?? true))
    .catch(() => {});
}, []);
```

Add a sibling row immediately after the existing notifications row, mirroring its structure (use `Bell` icon, `accent2` background, same wrapper). Gate visibility on `notifEnabled`:

```tsx
{notifEnabled && (
  <View style={styles.row}>
    <RowIcon icon={<Bell size={18} color={theme.colors.textPrimary} weight="bold" />} bg="accent2" />
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{t('settings.reminders_label')}</Text>
      <Text style={styles.rowHint}>{t('settings.reminders_hint')}</Text>
    </View>
    <Switch
      testID="reminders-toggle"
      value={remindersEnabled}
      onValueChange={toggleReminders}
    />
  </View>
)}
```

If `styles.rowTitle` / `styles.rowHint` don't exist (the existing notifications row uses different style names), reuse the actual names from that file — the goal is visual parity with the existing notif row.

- [ ] **Step 5: Run tests — expect pass**

```bash
npx jest "app/\(tabs\)/__tests__/settings.test.tsx"
```

Expect: pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts "mobile/app/(tabs)/settings/index.tsx" "mobile/app/(tabs)/__tests__/settings.test.tsx"
git commit -m "feat(mobile): settings toggle for capture reminders"
```

---

### Task 8: Smoke test end-to-end

**Files:** none

- [ ] **Step 1: Run the backend**

```bash
cd backend
DATABASE_URL=... npm run build && node dist/index.js
```

- [ ] **Step 2: Run the mobile app**

```bash
cd mobile
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

Sign in. Grant push permission. Verify the reminders toggle appears in Settings.

- [ ] **Step 3: Verify user row**

```bash
psql "$DATABASE_URL" -c "SELECT id, timezone, language, reminders_enabled FROM users WHERE push_token IS NOT NULL;"
```

Expect: `timezone` matches your device (e.g., `Asia/Ho_Chi_Minh`), `language` is `vi` or `en`, `reminders_enabled` is `true`.

- [ ] **Step 4: Force-trigger the cron**

Open `node` REPL against the dev DB, or temporarily inline a call at the bottom of `index.ts` for a single test run:

```ts
// TEMPORARY — remove after smoke
runReminderCron(new Date('2026-06-13T02:00:00Z')).then(() => console.log('manual cron done'));
```

(Use a UTC time that maps to a slot in your timezone.) Expect: push arrives on the device with one of the 10 messages.

Remove the temporary call before finishing.

- [ ] **Step 5: Done**

No new commit unless code changed.

---

## Done criteria

- Backend tests all green: `cd backend && npx jest`
- Mobile tests all green: `cd mobile && npx jest`
- Manual smoke: a push from `runReminderCron` arrives on a real device with a Vietnamese message.
- `git log` shows 7 focused commits (Tasks 1–7).
