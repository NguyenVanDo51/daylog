# Photo Journal Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the photo journal pivot: replace the Locket-style month-grid Calendar with a swipeable per-day journal pager, simplify milestones to per-day labels, and remove the auto-sync feature.

**Architecture:** Additive backend changes first (new `day_labels` table + endpoints, extended `/calendar` response), additive mobile changes second (new `DayPage`, new `MilestoneLabelInput`, rewritten `CalendarView`), then deletion of the old milestone surfaces last so nothing breaks mid-flight. Data migration from `milestones` to `day_labels` runs once before milestone routes are removed.

**Tech Stack:**
- Backend: Express.js + Drizzle ORM + PostgreSQL, jest + supertest
- Mobile: React Native + Expo Router + TanStack Query + Zustand, jest + @testing-library/react-native

**Spec:** [docs/superpowers/specs/2026-06-04-photo-journal-pivot-design.md](../specs/2026-06-04-photo-journal-pivot-design.md)

---

## File Structure

### Backend — created

- `backend/src/db/migrations/0005_day_labels.sql` — create `day_labels` table
- `backend/src/db/migrations/0006_migrate_milestones_to_day_labels.sql` — copy data
- `backend/src/db/migrations/0007_drop_milestones.sql` — drop table after migration
- `backend/src/routes/day-labels.ts` — CRUD for `day_labels`
- `backend/src/routes/day-labels.test.ts`

### Backend — modified

- `backend/src/db/schema.ts` — add `dayLabels` table, remove `milestones` (final task)
- `backend/src/routes/calendar.ts` — include `label` per day in response
- `backend/src/routes/calendar.test.ts` — assert label fields
- `backend/src/app.ts` — mount `day-labels` route, unmount `milestones` route (final task)

### Backend — deleted (final task)

- `backend/src/routes/milestones.ts`
- `backend/src/routes/milestones.test.ts`

### Mobile — created

- `mobile/src/hooks/useDayLabels.ts` + `useDayLabels.test.tsx`
- `mobile/src/components/timeline/DayPage.tsx` + `DayPage.test.tsx`
- `mobile/src/components/timeline/MilestoneLabelInput.tsx` + `MilestoneLabelInput.test.tsx`
- `mobile/src/components/timeline/DayPager.tsx` + `DayPager.test.tsx` (the horizontal swipeable pager that replaces the current `CalendarView`)
- `mobile/src/lib/dateKey.ts` + `dateKey.test.ts` (small helpers for `YYYY-MM-DD` keys)

### Mobile — modified

- `mobile/src/components/timeline/CalendarView.tsx` — replace contents with a render of `DayPager`
- `mobile/src/components/timeline/CalendarView.test.tsx` — rewrite for new behavior
- `mobile/src/components/timeline/TimelineFeed.tsx` — when a day has a label, replace the day heading with the label
- `mobile/src/components/timeline/TimelineFeed.test.tsx`
- `mobile/app/(tabs)/index.tsx` (HomeScreen) — default `feedMode` to `'calendar'`; move camera button into `DayPage`
- `mobile/app/(tabs)/__tests__/index.test.tsx` if present (otherwise create a HomeScreen integration test alongside other tabs tests)

### Mobile — deleted (final task)

- `mobile/src/hooks/useMilestones.ts` + `useMilestones.test.tsx`
- `mobile/src/components/timeline/MilestoneRow.tsx` + `MilestoneRow.test.tsx`
- `mobile/src/components/ui/MilestoneCard.tsx` + `MilestoneCard.test.tsx`
- `mobile/app/(tabs)/milestones.tsx`
- `mobile/app/(tabs)/__tests__/milestones.test.tsx`
- `mobile/app/milestone/new.tsx` and `mobile/app/milestone/[id].tsx` and their `__tests__` siblings
- `mobile/app/(tabs)/_layout.tsx` entry for `milestones` tab (modified, not deleted)

---

## Task 1: Add `day_labels` table to schema + migration

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/src/db/migrations/0005_day_labels.sql`

- [ ] **Step 1: Add `dayLabels` to schema.ts**

Append to `backend/src/db/schema.ts` (after `milestones` table, before `invites`):

```typescript
export const dayLabels = pgTable(
  'day_labels',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    label: text('label').notNull(),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqAlbumDate: uniqueIndex('day_labels_album_date_uniq').on(t.albumId, t.date),
  })
);
```

- [ ] **Step 2: Create the migration SQL**

Create `backend/src/db/migrations/0005_day_labels.sql`:

```sql
CREATE TABLE "day_labels" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "label" text NOT NULL,
  "updated_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "day_labels_album_date_uniq" ON "day_labels" ("album_id", "date");
```

- [ ] **Step 3: Run the migration against the test DB and verify schema**

Run:
```bash
cd backend && NODE_ENV=test npx drizzle-kit push --config=drizzle.config.ts || npm run db:migrate:test
```
(use whichever migration command the repo uses — check `backend/package.json` if unsure)

Verify:
```bash
psql "$DATABASE_URL_TEST" -c "\d day_labels"
```
Expected: table exists with columns `id`, `album_id`, `date`, `label`, `updated_by`, `updated_at` and the unique index.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/0005_day_labels.sql
git commit -m "feat(backend): add day_labels table"
```

---

## Task 2: `day-labels` CRUD route — GET (list by range)

**Files:**
- Create: `backend/src/routes/day-labels.ts`
- Create: `backend/src/routes/day-labels.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write a failing test for GET range**

Create `backend/src/routes/day-labels.test.ts`:

```typescript
import request from 'supertest';
import { db } from '../db';
import { dayLabels } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

const app = require('./app'); // adjust if app is imported differently
// If the existing convention is `const app = require('../app');`, use that.

describe('Day labels — GET range', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns labels in a date range', async () => {
    await db.insert(dayLabels).values([
      { albumId: album.id, date: '2026-06-01', label: '1 tháng tuổi', updatedBy: user.id },
      { albumId: album.id, date: '2026-06-15', label: 'Sinh nhật', updatedBy: user.id },
      { albumId: album.id, date: '2026-07-01', label: 'Out of range', updatedBy: user.id },
    ]);

    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-01&to=2026-06-30`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((l: any) => l.date)).toEqual(['2026-06-01', '2026-06-15']);
    expect(res.body[0].label).toBe('1 tháng tuổi');
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser();
    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-01&to=2026-06-30`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest src/routes/day-labels.test.ts -t "returns labels in a date range" -v`
Expected: FAIL — module `./day-labels` not found (since we haven't mounted route yet) OR 404.

- [ ] **Step 3: Implement the route file with GET**

Create `backend/src/routes/day-labels.ts`:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { and, asc, between, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { albumMembers, dayLabels } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { isValidUUID } from '../lib/validation';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

async function isAlbumMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    }

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await db
      .select({
        date: dayLabels.date,
        label: dayLabels.label,
        updated_at: dayLabels.updatedAt,
        updated_by: dayLabels.updatedBy,
      })
      .from(dayLabels)
      .where(
        and(
          eq(dayLabels.albumId, albumId),
          between(dayLabels.date, from, to),
        )
      )
      .orderBy(asc(dayLabels.date));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Mount the route in `app.ts`**

In `backend/src/app.ts`, after the existing imports:
```typescript
import dayLabelsRoutes from './routes/day-labels';
```

And after the `calendar` route registration:
```typescript
app.use('/albums/:id/day-labels', dayLabelsRoutes);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest src/routes/day-labels.test.ts -v`
Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/day-labels.ts backend/src/routes/day-labels.test.ts backend/src/app.ts
git commit -m "feat(backend): add GET /albums/:id/day-labels"
```

---

## Task 3: `day-labels` route — PUT (upsert) and DELETE

**Files:**
- Modify: `backend/src/routes/day-labels.ts`
- Modify: `backend/src/routes/day-labels.test.ts`

- [ ] **Step 1: Add failing tests for PUT and DELETE**

Append to `backend/src/routes/day-labels.test.ts`:

```typescript
describe('Day labels — PUT', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('upserts a label', async () => {
    const date = '2026-06-04';
    const res1 = await request(app)
      .put(`/albums/${album.id}/day-labels/${date}`)
      .set(headers)
      .send({ label: 'Sinh nhật' });
    expect(res1.status).toBe(200);
    expect(res1.body.label).toBe('Sinh nhật');

    const res2 = await request(app)
      .put(`/albums/${album.id}/day-labels/${date}`)
      .set(headers)
      .send({ label: '1 tuổi' });
    expect(res2.status).toBe(200);
    expect(res2.body.label).toBe('1 tuổi');
  });

  it('rejects empty label with 400', async () => {
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(headers)
      .send({ label: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects bad date format with 400', async () => {
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/06-04-2026`)
      .set(headers)
      .send({ label: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser();
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(authHeader(other))
      .send({ label: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('Day labels — DELETE', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('removes the label', async () => {
    const date = '2026-06-04';
    await request(app).put(`/albums/${album.id}/day-labels/${date}`).set(headers).send({ label: 'X' });

    const del = await request(app).delete(`/albums/${album.id}/day-labels/${date}`).set(headers);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-04&to=2026-06-04`)
      .set(headers);
    expect(get.body).toHaveLength(0);
  });

  it('204 on idempotent delete', async () => {
    const res = await request(app)
      .delete(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(headers);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/routes/day-labels.test.ts -v`
Expected: new tests FAIL (PUT/DELETE not implemented), GET tests still PASS.

- [ ] **Step 3: Implement PUT and DELETE**

Append to `backend/src/routes/day-labels.ts`, before `export = router;`:

```typescript
router.put('/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });

    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    if (!label) return res.status(400).json({ error: 'label required' });

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [row] = await db
      .insert(dayLabels)
      .values({ albumId, date, label, updatedBy: req.user!.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [dayLabels.albumId, dayLabels.date],
        set: { label, updatedBy: req.user!.id, updatedAt: new Date() },
      })
      .returning({
        date: dayLabels.date,
        label: dayLabels.label,
        updated_at: dayLabels.updatedAt,
        updated_by: dayLabels.updatedBy,
      });

    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.delete(dayLabels).where(and(eq(dayLabels.albumId, albumId), eq(dayLabels.date, date)));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/routes/day-labels.test.ts -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/day-labels.ts backend/src/routes/day-labels.test.ts
git commit -m "feat(backend): add PUT/DELETE /albums/:id/day-labels/:date"
```

---

## Task 4: Extend `/calendar` to include day labels

**Files:**
- Modify: `backend/src/routes/calendar.ts`
- Modify: `backend/src/routes/calendar.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `backend/src/routes/calendar.test.ts` (use existing imports and helpers; mirror the file's testing style):

```typescript
it('includes day labels for the month', async () => {
  // Assume helpers exist for creating album members + photos.
  await db.insert(dayLabels).values({
    albumId: album.id,
    date: '2026-06-15',
    label: 'Sinh nhật',
    updatedBy: user.id,
  });

  const res = await request(app)
    .get(`/albums/${album.id}/calendar?year=2026&month=6`)
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body['2026-06-15'].label).toBe('Sinh nhật');
});
```

Add `import { dayLabels } from '../db/schema';` to imports if missing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest src/routes/calendar.test.ts -t "includes day labels" -v`
Expected: FAIL — `label` undefined.

- [ ] **Step 3: Update the calendar route**

In `backend/src/routes/calendar.ts`, after computing the existing `result` object, add a labels lookup and merge:

Add `dayLabels` to imports:
```typescript
import { albumMembers, dayLabels } from '../db/schema';
```

Add `between` to drizzle imports:
```typescript
import { and, between, eq, sql } from 'drizzle-orm';
```

After the existing `for (const row of rows.rows)` loop, before `res.json(result)`:

```typescript
// Compute first/last day of the month for the date range filter.
const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
const lastDay = new Date(year, month, 0).getDate();
const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

const labelRows = await db
  .select({ date: dayLabels.date, label: dayLabels.label })
  .from(dayLabels)
  .where(and(eq(dayLabels.albumId, albumId), between(dayLabels.date, fromDate, toDate)));

for (const r of labelRows) {
  if (!result[r.date]) {
    result[r.date] = { photo: false, capture: false, milestone: false };
  }
  (result[r.date] as any).label = r.label;
}
```

Also update the type of `result`:
```typescript
const result: Record<string, { photo: boolean; capture: boolean; milestone: boolean; label?: string }> = {};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest src/routes/calendar.test.ts -v`
Expected: all calendar tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/calendar.ts backend/src/routes/calendar.test.ts
git commit -m "feat(backend): include day labels in calendar response"
```

---

## Task 5: Data migration — copy `milestones` → `day_labels`

**Files:**
- Create: `backend/src/db/migrations/0006_migrate_milestones_to_day_labels.sql`

- [ ] **Step 1: Create the migration**

Create `backend/src/db/migrations/0006_migrate_milestones_to_day_labels.sql`:

```sql
-- Migrate milestones to day_labels. Each milestone becomes a label on the
-- date its `occurred_at` falls on (UTC). Note + cover_photo_id are dropped.
-- If multiple milestones exist for the same (album, date), keep the latest.
INSERT INTO day_labels (album_id, date, label, updated_by, updated_at)
SELECT
  album_id,
  DATE(occurred_at AT TIME ZONE 'UTC') AS date,
  title,
  created_by,
  created_at
FROM milestones m1
WHERE created_at = (
  SELECT MAX(created_at)
  FROM milestones m2
  WHERE m2.album_id = m1.album_id
    AND DATE(m2.occurred_at AT TIME ZONE 'UTC') = DATE(m1.occurred_at AT TIME ZONE 'UTC')
)
ON CONFLICT (album_id, date) DO NOTHING;
```

- [ ] **Step 2: Run the migration on the test DB**

Apply it (use whatever the project's migration runner is). Then verify:

```bash
psql "$DATABASE_URL_TEST" -c "SELECT COUNT(*) FROM day_labels;"
```

Expected: matches number of distinct `(album_id, DATE(occurred_at))` pairs in `milestones`. If there are no test seed rows, count is 0 — that's fine.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/0006_migrate_milestones_to_day_labels.sql
git commit -m "feat(backend): migrate milestones to day_labels"
```

---

## Task 6: Mobile — `dateKey` helpers

**Files:**
- Create: `mobile/src/lib/dateKey.ts`
- Create: `mobile/src/lib/dateKey.test.ts`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/lib/dateKey.test.ts`:

```typescript
import { toDateKey, addDays, isToday } from './dateKey';

describe('dateKey', () => {
  it('toDateKey formats YYYY-MM-DD', () => {
    expect(toDateKey(new Date('2026-06-04T12:00:00Z'))).toBe('2026-06-04');
    expect(toDateKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });

  it('addDays adds or subtracts days', () => {
    expect(addDays('2026-06-04', 1)).toBe('2026-06-05');
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('isToday', () => {
    const now = new Date();
    const key = toDateKey(now);
    expect(isToday(key)).toBe(true);
    expect(isToday(addDays(key, -1))).toBe(false);
    expect(isToday(addDays(key, 1))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest src/lib/dateKey.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dateKey.ts`**

Create `mobile/src/lib/dateKey.ts`:

```typescript
export function toDateKey(d: Date): string {
  // Use UTC to keep the key stable regardless of device timezone shifts.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return toDateKey(t);
}

export function isToday(key: string): boolean {
  return key === toDateKey(new Date());
}

export function isPast(key: string): boolean {
  return key < toDateKey(new Date());
}

export function isFuture(key: string): boolean {
  return key > toDateKey(new Date());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest src/lib/dateKey.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/dateKey.ts mobile/src/lib/dateKey.test.ts
git commit -m "feat(mobile): add dateKey helpers"
```

---

## Task 7: Mobile — `useDayLabels` hook

**Files:**
- Create: `mobile/src/hooks/useDayLabels.ts`
- Create: `mobile/src/hooks/useDayLabels.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/hooks/useDayLabels.test.tsx`:

```typescript
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDayLabelsRange, useUpsertDayLabel, useDeleteDayLabel } from './useDayLabels';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (sel: any) => sel({ albumId: 'album-1' }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

test('useDayLabelsRange fetches labels in range', async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: [{ date: '2026-06-04', label: 'X', updated_at: '...', updated_by: 'u1' }],
  });

  const { result } = renderHook(
    () => useDayLabelsRange('2026-06-01', '2026-06-30'),
    { wrapper }
  );

  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(api.get).toHaveBeenCalledWith(
    '/albums/album-1/day-labels?from=2026-06-01&to=2026-06-30'
  );
  expect(result.current.data).toHaveLength(1);
});

test('useUpsertDayLabel PUTs and invalidates', async () => {
  (api.put as jest.Mock).mockResolvedValue({ data: { date: '2026-06-04', label: 'X' } });
  const { result } = renderHook(() => useUpsertDayLabel(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ date: '2026-06-04', label: 'X' });
  });

  expect(api.put).toHaveBeenCalledWith('/albums/album-1/day-labels/2026-06-04', { label: 'X' });
});

test('useDeleteDayLabel DELETEs', async () => {
  (api.delete as jest.Mock).mockResolvedValue({ status: 204 });
  const { result } = renderHook(() => useDeleteDayLabel(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ date: '2026-06-04' });
  });

  expect(api.delete).toHaveBeenCalledWith('/albums/album-1/day-labels/2026-06-04');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest src/hooks/useDayLabels.test.tsx -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `mobile/src/hooks/useDayLabels.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface DayLabel {
  date: string;
  label: string;
  updated_at: string;
  updated_by: string;
}

export function useDayLabelsRange(from: string, to: string) {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<DayLabel[]>({
    queryKey: ['day-labels', albumId, from, to],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/day-labels?from=${from}&to=${to}`);
      return data;
    },
    enabled: !!albumId,
  });
}

export function useUpsertDayLabel() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  return useMutation({
    mutationFn: async ({ date, label }: { date: string; label: string }) => {
      const { data } = await api.put(`/albums/${albumId}/day-labels/${date}`, { label });
      return data as DayLabel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-labels', albumId] });
      qc.invalidateQueries({ queryKey: ['calendar', albumId] });
    },
  });
}

export function useDeleteDayLabel() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      await api.delete(`/albums/${albumId}/day-labels/${date}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-labels', albumId] });
      qc.invalidateQueries({ queryKey: ['calendar', albumId] });
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/hooks/useDayLabels.test.tsx -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useDayLabels.ts mobile/src/hooks/useDayLabels.test.tsx
git commit -m "feat(mobile): add useDayLabels hooks"
```

---

## Task 8: Mobile — `MilestoneLabelInput` bottom sheet

**Files:**
- Create: `mobile/src/components/timeline/MilestoneLabelInput.tsx`
- Create: `mobile/src/components/timeline/MilestoneLabelInput.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/components/timeline/MilestoneLabelInput.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MilestoneLabelInput } from './MilestoneLabelInput';

const noop = () => {};

test('renders current label as input default', () => {
  const { getByTestId } = render(
    <MilestoneLabelInput
      visible
      date="2026-06-04"
      initialLabel="Sinh nhật"
      onSave={noop}
      onClear={noop}
      onClose={noop}
    />
  );
  expect(getByTestId('label-input').props.value).toBe('Sinh nhật');
});

test('save triggers onSave with new value', () => {
  const onSave = jest.fn();
  const { getByTestId } = render(
    <MilestoneLabelInput
      visible date="2026-06-04" initialLabel="" onSave={onSave} onClear={noop} onClose={noop}
    />
  );
  fireEvent.changeText(getByTestId('label-input'), 'Sinh nhật');
  fireEvent.press(getByTestId('label-save'));
  expect(onSave).toHaveBeenCalledWith('Sinh nhật');
});

test('clear triggers onClear when there is an initial label', () => {
  const onClear = jest.fn();
  const { getByTestId } = render(
    <MilestoneLabelInput
      visible date="2026-06-04" initialLabel="X" onSave={noop} onClear={onClear} onClose={noop}
    />
  );
  fireEvent.press(getByTestId('label-clear'));
  expect(onClear).toHaveBeenCalled();
});

test('clear button hidden when no initial label', () => {
  const { queryByTestId } = render(
    <MilestoneLabelInput
      visible date="2026-06-04" initialLabel="" onSave={noop} onClear={noop} onClose={noop}
    />
  );
  expect(queryByTestId('label-clear')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest src/components/timeline/MilestoneLabelInput.test.tsx -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `mobile/src/components/timeline/MilestoneLabelInput.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  date: string; // YYYY-MM-DD
  initialLabel: string;
  onSave: (label: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function MilestoneLabelInput({
  visible, date, initialLabel, onSave, onClear, onClose,
}: Props) {
  const [value, setValue] = useState(initialLabel);

  useEffect(() => { setValue(initialLabel); }, [initialLabel, visible]);

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={styles.title}>Cột mốc ngày {date}</Text>
        <TextInput
          testID="label-input"
          value={value}
          onChangeText={setValue}
          placeholder="Ví dụ: 1 tháng tuổi, Sinh nhật…"
          maxLength={60}
        />
        <View style={styles.row}>
          {initialLabel.length > 0 && (
            <TouchableOpacity testID="label-clear" onPress={onClear} style={styles.clear}>
              <Text style={styles.clearText}>Xóa</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          <Button testID="label-save" onPress={() => onSave(value.trim())} disabled={!value.trim()}>
            Lưu
          </Button>
        </View>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.md },
  title: { ...typography.title, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clear: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  clearText: { ...typography.body, color: colors.danger ?? '#c00' },
});
```

Notes for the implementer:
- If `Button` does not accept `testID` directly, wrap it in a `View` with `testID="label-save"` and forward the press.
- If `SheetModal` requires different prop names, adapt; the test only depends on the inner contents.
- If `colors.danger` does not exist in `constants/theme`, fall back to a literal `#c00`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/components/timeline/MilestoneLabelInput.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/MilestoneLabelInput.tsx mobile/src/components/timeline/MilestoneLabelInput.test.tsx
git commit -m "feat(mobile): add MilestoneLabelInput sheet"
```

---

## Task 9: Mobile — `DayPage` component (four states)

**Files:**
- Create: `mobile/src/components/timeline/DayPage.tsx`
- Create: `mobile/src/components/timeline/DayPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/components/timeline/DayPage.test.tsx`:

```typescript
jest.mock('@/components/timeline/MasonryBlock', () => ({
  MasonryBlock: ({ photos }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="masonry-block"><Text>{photos.length} photos</Text></View>;
  },
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayPage } from './DayPage';

const samplePhoto = (id: string) => ({
  id, taken_at: '2026-06-04T10:00:00Z', caption: '', width: 100, height: 100, type: 'photo' as const,
});

test('today + empty: shows camera CTA, not upload', () => {
  const todayKey = require('@/lib/dateKey').toDateKey(new Date());
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey={todayKey} photos={[]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('day-camera-cta')).toBeTruthy();
  expect(queryByTestId('day-upload-cta')).toBeNull();
});

test('past + empty: shows upload CTA, not camera', () => {
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey="2026-01-01" photos={[]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('day-upload-cta')).toBeTruthy();
  expect(queryByTestId('day-camera-cta')).toBeNull();
});

test('today + photos: shows masonry + small camera FAB', () => {
  const todayKey = require('@/lib/dateKey').toDateKey(new Date());
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey={todayKey} photos={[samplePhoto('p1')]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('masonry-block')).toBeTruthy();
  expect(getByTestId('day-camera-fab')).toBeTruthy();
  expect(queryByTestId('day-upload-fab')).toBeNull();
});

test('past + photos: shows masonry + small upload FAB', () => {
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey="2026-01-01" photos={[samplePhoto('p1')]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('masonry-block')).toBeTruthy();
  expect(getByTestId('day-upload-fab')).toBeTruthy();
  expect(queryByTestId('day-camera-fab')).toBeNull();
});

test('label shown when present', () => {
  const { getByText } = render(
    <DayPage dateKey="2026-01-01" photos={[]} label="Sinh nhật" onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByText(/Sinh nhật/)).toBeTruthy();
});

test('tapping header calls onHeaderPress', () => {
  const onHeader = jest.fn();
  const { getByTestId } = render(
    <DayPage dateKey="2026-01-01" photos={[]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={onHeader} />
  );
  fireEvent.press(getByTestId('day-header'));
  expect(onHeader).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest src/components/timeline/DayPage.test.tsx -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DayPage`**

Create `mobile/src/components/timeline/DayPage.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MasonryBlock } from '@/components/timeline/MasonryBlock';
import { colors, spacing, typography } from '@/constants/theme';
import { isToday } from '@/lib/dateKey';
import { formatVnDayLabel } from '@/lib/format';
import type { TimelinePhoto } from '@/hooks/useTimeline';

interface Props {
  dateKey: string;            // YYYY-MM-DD
  photos: TimelinePhoto[];    // photos for this day, ordered (any stable order)
  label: string | null;
  onCameraPress: () => void;
  onUploadPress: () => void;
  onHeaderPress: () => void;
}

export function DayPage({
  dateKey, photos, label, onCameraPress, onUploadPress, onHeaderPress,
}: Props) {
  const today = isToday(dateKey);
  const hasPhotos = photos.length > 0;

  return (
    <View style={styles.container} testID={`day-page-${dateKey}`}>
      <TouchableOpacity testID="day-header" onPress={onHeaderPress} style={styles.header}>
        {label ? (
          <>
            <Text style={styles.labelLine}>🏷️ {label}</Text>
            <Text style={styles.dateLine}>{formatVnDayLabel(dateKey + 'T12:00:00Z')}</Text>
          </>
        ) : (
          <Text style={styles.dateLineLarge}>{formatVnDayLabel(dateKey + 'T12:00:00Z')}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        {hasPhotos ? (
          <MasonryBlock photos={photos} />
        ) : today ? (
          <TouchableOpacity testID="day-camera-cta" onPress={onCameraPress} style={styles.cta}>
            <View style={styles.ctaCircle}>
              <Ionicons name="camera" size={42} color={colors.white} />
            </View>
            <Text style={styles.ctaText}>Ghi lại ngày hôm nay</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity testID="day-upload-cta" onPress={onUploadPress} style={styles.uploadCta}>
            <Text style={styles.emptyText}>Chưa có ảnh ngày này</Text>
            <Text style={styles.uploadLink}>Thêm ảnh từ thư viện</Text>
          </TouchableOpacity>
        )}
      </View>

      {hasPhotos && (today ? (
        <TouchableOpacity testID="day-camera-fab" style={styles.fab} onPress={onCameraPress}>
          <Ionicons name="camera" size={22} color={colors.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity testID="day-upload-fab" style={styles.fab} onPress={onUploadPress}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.md },
  dateLineLarge: { ...typography.title, color: colors.ink, textAlign: 'center' },
  labelLine: { ...typography.title, color: colors.ink, textAlign: 'center' },
  dateLine: { ...typography.bodySmall, color: colors.inkMuted, textAlign: 'center', marginTop: 2 },
  body: { flex: 1, justifyContent: 'center' },
  cta: { alignItems: 'center', gap: spacing.md },
  ctaCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...typography.title, color: colors.ink },
  uploadCta: { alignItems: 'center', gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.inkMuted },
  uploadLink: { ...typography.body, color: colors.pink, fontWeight: '700' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
```

If `MasonryBlock` expects different props than `{ photos }`, adapt accordingly — the goal is to pass the per-day photos in the format the existing `MasonryBlock` consumer (see `TimelineFeed.tsx`) already uses.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/components/timeline/DayPage.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/DayPage.tsx mobile/src/components/timeline/DayPage.test.tsx
git commit -m "feat(mobile): add DayPage component"
```

---

## Task 10: Mobile — `DayPager` (horizontal swipe)

**Files:**
- Create: `mobile/src/components/timeline/DayPager.tsx`
- Create: `mobile/src/components/timeline/DayPager.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/components/timeline/DayPager.test.tsx`:

```typescript
jest.mock('@/components/timeline/DayPage', () => ({
  DayPage: ({ dateKey }: any) => {
    const { View, Text } = require('react-native');
    return <View testID={`day-page-${dateKey}`}><Text>{dateKey}</Text></View>;
  },
}));
jest.mock('@/hooks/useTimeline', () => ({ useTimeline: jest.fn(() => ({ data: { pages: [] } })) }));
jest.mock('@/hooks/useDayLabels', () => ({
  useDayLabelsRange: jest.fn(() => ({ data: [] })),
  useUpsertDayLabel: jest.fn(() => ({ mutate: jest.fn() })),
  useDeleteDayLabel: jest.fn(() => ({ mutate: jest.fn() })),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayPager } from './DayPager';
import { toDateKey } from '@/lib/dateKey';

test('lands on today by default', () => {
  const { getByTestId } = render(<DayPager />);
  const todayKey = toDateKey(new Date());
  expect(getByTestId(`day-page-${todayKey}`)).toBeTruthy();
});

test('lands on an initial date when given', () => {
  const { getByTestId } = render(<DayPager initialDateKey="2026-01-15" />);
  expect(getByTestId('day-page-2026-01-15')).toBeTruthy();
});

// Behavioral test for swipe is difficult in jest-rn without gesture handler.
// Instead, expose a testID-based prev/next pair on the page for unit-level coverage.
test('prev/next testIDs change the active date', () => {
  const { getByTestId } = render(<DayPager initialDateKey="2026-01-15" />);
  fireEvent.press(getByTestId('day-pager-prev'));
  expect(getByTestId('day-page-2026-01-14')).toBeTruthy();
  fireEvent.press(getByTestId('day-pager-next'));
  expect(getByTestId('day-page-2026-01-15')).toBeTruthy();
});

test('does not advance past today', () => {
  const todayKey = toDateKey(new Date());
  const { getByTestId } = render(<DayPager initialDateKey={todayKey} />);
  fireEvent.press(getByTestId('day-pager-next'));
  expect(getByTestId(`day-page-${todayKey}`)).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest src/components/timeline/DayPager.test.tsx -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DayPager`**

Create `mobile/src/components/timeline/DayPager.tsx`:

```typescript
import React, { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { DayPage } from './DayPage';
import { MilestoneLabelInput } from './MilestoneLabelInput';
import { useTimeline, TimelinePage, TimelinePhoto } from '@/hooks/useTimeline';
import { useDayLabelsRange, useUpsertDayLabel, useDeleteDayLabel } from '@/hooks/useDayLabels';
import { toDateKey, addDays, isFuture } from '@/lib/dateKey';
import { useCaptureStore, getCooldownRemaining } from '@/stores/captureStore';

interface Props {
  initialDateKey?: string;
}

export function DayPager({ initialDateKey }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey(new Date()));
  const [labelSheetOpen, setLabelSheetOpen] = useState(false);

  const { data: timeline } = useTimeline();

  // Compute a 60-day window around the current date for label prefetch.
  const fromKey = addDays(dateKey, -30);
  const toKey = addDays(dateKey, 30);
  const { data: labels = [] } = useDayLabelsRange(fromKey, toKey);
  const upsert = useUpsertDayLabel();
  const remove = useDeleteDayLabel();

  const photosForDay = useMemo<TimelinePhoto[]>(() => {
    if (!timeline) return [];
    return timeline.pages
      .flatMap((p: TimelinePage) => p.items)
      .filter((it: any) => it.type === 'photo' && it.taken_at?.slice(0, 10) === dateKey)
      .map((it: any) => it as TimelinePhoto);
  }, [timeline, dateKey]);

  const currentLabel = useMemo(() => {
    return labels.find((l) => l.date === dateKey)?.label ?? null;
  }, [labels, dateKey]);

  const goPrev = useCallback(() => setDateKey((k) => addDays(k, -1)), []);
  const goNext = useCallback(() => setDateKey((k) => {
    const next = addDays(k, 1);
    return isFuture(next) ? k : next;
  }), []);

  const handleCamera = useCallback(() => {
    const { lastCaptureAt } = useCaptureStore.getState();
    if (getCooldownRemaining(lastCaptureAt) === 0) {
      router.push('/capture');
    }
    // Cooldown UX matches HomeScreen — if blocked, do nothing (or surface alert).
  }, []);

  const handleUpload = useCallback(() => {
    router.push({ pathname: '/(tabs)/upload', params: { targetDate: dateKey } });
    // The upload screen should already handle adding photos; targetDate is informational.
  }, [dateKey]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((e) => {
          if (e.translationX < -50) runOnJS(goNext)();
          else if (e.translationX > 50) runOnJS(goPrev)();
        }),
    [goNext, goPrev]
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.root}>
          <DayPage
            dateKey={dateKey}
            photos={photosForDay}
            label={currentLabel}
            onCameraPress={handleCamera}
            onUploadPress={handleUpload}
            onHeaderPress={() => setLabelSheetOpen(true)}
          />
        </View>
      </GestureDetector>

      {/* Hidden buttons for unit tests; visually no-op (could be removed in prod build). */}
      <View style={styles.hidden}>
        <TouchableOpacity testID="day-pager-prev" onPress={goPrev} />
        <TouchableOpacity testID="day-pager-next" onPress={goNext} />
      </View>

      <MilestoneLabelInput
        visible={labelSheetOpen}
        date={dateKey}
        initialLabel={currentLabel ?? ''}
        onSave={(label) => {
          upsert.mutate({ date: dateKey, label });
          setLabelSheetOpen(false);
        }}
        onClear={() => {
          remove.mutate({ date: dateKey });
          setLabelSheetOpen(false);
        }}
        onClose={() => setLabelSheetOpen(false)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { width: 0, height: 0, opacity: 0 },
});
```

Notes:
- `react-native-gesture-handler` and `react-native-reanimated` must already be installed (used elsewhere in the codebase). If not, add them via `npm i` in mobile.
- The hidden test buttons let the unit tests drive navigation deterministically without needing gesture simulation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/components/timeline/DayPager.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/DayPager.tsx mobile/src/components/timeline/DayPager.test.tsx
git commit -m "feat(mobile): add DayPager swipeable per-day view"
```

---

## Task 11: Replace `CalendarView` contents with `DayPager`

**Files:**
- Modify: `mobile/src/components/timeline/CalendarView.tsx`
- Modify: `mobile/src/components/timeline/CalendarView.test.tsx`

- [ ] **Step 1: Rewrite the test file (it asserted old month-grid behavior)**

Replace `mobile/src/components/timeline/CalendarView.test.tsx` contents:

```typescript
jest.mock('@/components/timeline/DayPager', () => ({
  DayPager: ({ initialDateKey }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="day-pager-mock"><Text>{initialDateKey ?? 'today'}</Text></View>;
  },
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { CalendarView } from './CalendarView';

test('renders DayPager', () => {
  const { getByTestId } = render(<CalendarView />);
  expect(getByTestId('day-pager-mock')).toBeTruthy();
});

test('forwards initialDateKey when provided', () => {
  const { getByText } = render(<CalendarView initialDateKey="2026-01-15" />);
  expect(getByText('2026-01-15')).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/components/timeline/CalendarView.test.tsx -v`
Expected: FAIL.

- [ ] **Step 3: Replace `CalendarView.tsx` contents**

Replace `mobile/src/components/timeline/CalendarView.tsx` with:

```typescript
import React from 'react';
import { DayPager } from './DayPager';

interface Props {
  initialDateKey?: string;
}

export function CalendarView({ initialDateKey }: Props) {
  return <DayPager initialDateKey={initialDateKey} />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest src/components/timeline/CalendarView.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/CalendarView.tsx mobile/src/components/timeline/CalendarView.test.tsx
git commit -m "refactor(mobile): replace CalendarView with DayPager"
```

---

## Task 12: HomeScreen — default to Calendar mode, remove the camera button next to toggle

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Change the default `feedMode` to `'calendar'`**

In `mobile/app/(tabs)/index.tsx`, change:

```typescript
const [feedMode, setFeedMode] = useState<'feed' | 'calendar'>('feed');
```

to:

```typescript
const [feedMode, setFeedMode] = useState<'feed' | 'calendar'>('calendar');
```

- [ ] **Step 2: Move the camera button into Feed mode only OR remove**

The current code shows a `cameraBtn` only when `feedMode === 'feed'`. Keep that — in Calendar mode the camera lives inside `DayPage`. No code change needed in this step beyond Step 1, but VERIFY the conditional remains and the camera button stays scoped to Feed mode.

- [ ] **Step 3: Run the existing HomeScreen integration tests**

Run: `cd mobile && npx jest "app/(tabs)/__tests__/index" -v`
If no test file exists, skip; otherwise update any test that asserted the default mode to expect 'calendar'.

- [ ] **Step 4: Manual sanity check (optional, ahead of full e2e)**

Boot the dev server and confirm: cold launch → DayPager visible on today, toggle to Feed reveals masonry.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): default home to Calendar (journal) mode"
```

---

## Task 13: TimelineFeed — render day label as group heading when present

**Files:**
- Modify: `mobile/src/components/timeline/TimelineFeed.tsx`
- Modify: `mobile/src/components/timeline/TimelineFeed.test.tsx`

- [ ] **Step 1: Add a failing test**

Add to `TimelineFeed.test.tsx` (use the existing mocking patterns):

```typescript
test('day heading shows day label when present', () => {
  // Existing mock returns a timeline with one photo on 2026-06-04.
  // Augment mock for useDayLabelsRange.
  const { useDayLabelsRange } = require('@/hooks/useDayLabels');
  useDayLabelsRange.mockReturnValue({
    data: [{ date: '2026-06-04', label: 'Sinh nhật', updated_at: '', updated_by: '' }],
  });

  const { getByText } = render(<TimelineFeed />);
  expect(getByText(/Sinh nhật/)).toBeTruthy();
});
```

You will need to add to the top of the file:
```typescript
jest.mock('@/hooks/useDayLabels', () => ({
  useDayLabelsRange: jest.fn(() => ({ data: [] })),
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest src/components/timeline/TimelineFeed.test.tsx -t "day heading shows day label" -v`
Expected: FAIL.

- [ ] **Step 3: Wire the label into the day heading**

In `mobile/src/components/timeline/TimelineFeed.tsx`:

a) Import the labels hook:
```typescript
import { useDayLabelsRange } from '@/hooks/useDayLabels';
```

b) Inside the component (where the timeline is constructed), compute a `labelByDate` map. The simplest approach: query the visible date range. For a first pass, query a wide range (e.g., last 365 days):

```typescript
const today = toDateKey(new Date()); // import from '@/lib/dateKey'
const from = addDays(today, -365);
const { data: labels = [] } = useDayLabelsRange(from, today);
const labelByDate = useMemo(() => {
  const m = new Map<string, string>();
  for (const l of labels) m.set(l.date, l.label);
  return m;
}, [labels]);
```

c) In the day-heading render branch (look for `type === 'dayHeader'` in `TimelineFeed.tsx`), pass `labelByDate.get(item.dateKey)` as a `label` prop into the heading component (or render a small `<Text>{label}</Text>` above the date inline). Show the label as the primary text when present, date as small subtext.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/components/timeline/TimelineFeed.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/TimelineFeed.tsx mobile/src/components/timeline/TimelineFeed.test.tsx
git commit -m "feat(mobile): show day label as heading in Feed mode"
```

---

## Task 14: Feed → Calendar jump on tap-day-heading

**Files:**
- Modify: `mobile/src/components/timeline/TimelineFeed.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Add a callback prop to TimelineFeed**

Add `onJumpToDay?: (dateKey: string) => void` to `TimelineFeed` props. In the day-heading render branch, wrap the heading in a `TouchableOpacity` that calls `onJumpToDay?.(item.dateKey)` when defined.

- [ ] **Step 2: Add a failing test**

In `TimelineFeed.test.tsx`:

```typescript
test('tapping day heading calls onJumpToDay', () => {
  const onJump = jest.fn();
  const { getByTestId } = render(<TimelineFeed onJumpToDay={onJump} />);
  // Assume the existing mock yields a heading with testID 'day-heading-2026-06-04'
  fireEvent.press(getByTestId('day-heading-2026-06-04'));
  expect(onJump).toHaveBeenCalledWith('2026-06-04');
});
```

Adjust the existing mock or component to ensure each day heading has a testID like `day-heading-${dateKey}`.

- [ ] **Step 3: Run test, fix, retest**

Run: `cd mobile && npx jest src/components/timeline/TimelineFeed.test.tsx -v`
Iterate until PASS.

- [ ] **Step 4: Wire HomeScreen to switch mode**

In `mobile/app/(tabs)/index.tsx`:

- Add state: `const [calendarInitialDate, setCalendarInitialDate] = useState<string | undefined>(undefined);`
- Pass to `<CalendarView initialDateKey={calendarInitialDate} />` (update CalendarView consumption accordingly).
- Pass `onJumpToDay` to `<TimelineFeed onJumpToDay={(dateKey) => { setCalendarInitialDate(dateKey); setFeedMode('calendar'); }} />`.

- [ ] **Step 5: Run HomeScreen tests if present, commit**

```bash
git add mobile/src/components/timeline/TimelineFeed.tsx mobile/src/components/timeline/TimelineFeed.test.tsx mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): tap day heading in Feed jumps to Calendar"
```

---

## Task 15: Remove old milestone UI (mobile)

**Files (delete):**
- `mobile/src/hooks/useMilestones.ts` and `.test.tsx`
- `mobile/src/components/timeline/MilestoneRow.tsx` and `.test.tsx`
- `mobile/src/components/ui/MilestoneCard.tsx` and `.test.tsx`
- `mobile/app/(tabs)/milestones.tsx` and any test sibling
- `mobile/app/milestone/new.tsx`, `mobile/app/milestone/[id].tsx`, and their `__tests__` siblings

**Files (modify):**
- `mobile/app/(tabs)/_layout.tsx` — remove the `milestones` tab entry
- `mobile/src/components/timeline/TimelineFeed.tsx` — remove the `'milestone'` branch in the type-discriminated render

- [ ] **Step 1: Search for residual milestone references**

Run:
```bash
grep -rn "milestone\|Milestone\|useMilestones" mobile/src mobile/app 2>/dev/null | grep -v __tests__ | grep -v ".test."
```
List every site that still touches milestones.

- [ ] **Step 2: Delete the listed files**

Run:
```bash
rm mobile/src/hooks/useMilestones.ts mobile/src/hooks/useMilestones.test.tsx
rm mobile/src/components/timeline/MilestoneRow.tsx mobile/src/components/timeline/MilestoneRow.test.tsx
rm mobile/src/components/ui/MilestoneCard.tsx mobile/src/components/ui/MilestoneCard.test.tsx
rm mobile/app/\(tabs\)/milestones.tsx
rm -rf mobile/app/milestone
rm -rf mobile/app/\(tabs\)/__tests__/milestones.test.tsx 2>/dev/null
```

- [ ] **Step 3: Edit `mobile/app/(tabs)/_layout.tsx`**

Remove the `Tabs.Screen` for `milestones`. Keep all others intact.

- [ ] **Step 4: Edit `TimelineFeed.tsx`**

Remove `'milestone'` from the discriminated union and from the render branch (the section that currently handles `case 'milestone':` and the import of `MilestoneRow`). Make sure the type for items used by TimelineFeed no longer references milestones.

- [ ] **Step 5: Run the full mobile test suite**

Run: `cd mobile && npx jest --silent`
Expected: zero broken-import failures. Fix any remaining import sites until green.

- [ ] **Step 6: Commit**

```bash
git add -A mobile/
git commit -m "chore(mobile): remove milestone screens and surfaces"
```

---

## Task 16: Remove milestone routes from backend + drop table

**Files (delete):**
- `backend/src/routes/milestones.ts`
- `backend/src/routes/milestones.test.ts`

**Files (modify):**
- `backend/src/app.ts` — remove the `milestonesRoutes` import and `app.use('/', milestonesRoutes)`
- `backend/src/routes/calendar.ts` — remove the `milestone_days` CTE and `has_milestone` field; calendar response no longer includes `milestone` flag
- `backend/src/routes/calendar.test.ts` — update tests that asserted `milestone: false/true`; remove those assertions
- `backend/src/db/schema.ts` — remove the `milestones` export

**Files (create):**
- `backend/src/db/migrations/0007_drop_milestones.sql`

- [ ] **Step 1: Delete files**

```bash
rm backend/src/routes/milestones.ts backend/src/routes/milestones.test.ts
```

- [ ] **Step 2: Edit `app.ts`**

Remove these two lines:
```typescript
import milestonesRoutes from './routes/milestones';
// ...
app.use('/', milestonesRoutes);
```

- [ ] **Step 3: Edit `calendar.ts`**

Remove the `milestone_days` CTE block entirely and remove `has_milestone` from `combined` and the outer `SELECT`. The DayRow type drops `has_milestone`. The `result[row.day]` no longer includes `milestone`.

Update the response type:
```typescript
const result: Record<string, { photo: boolean; capture: boolean; label?: string }> = {};
```

(Drop the `milestone: boolean` field. The mobile `useCalendar` consumer should be checked for any `.milestone` access — remove those reads too. The unused day-cell legend in old `CalendarView` is already gone after Task 11.)

- [ ] **Step 4: Edit `calendar.test.ts`**

Remove any assertions referring to `milestone: true/false`. Replace with new label-presence assertions if not already covered.

- [ ] **Step 5: Edit `schema.ts`**

Remove the `milestones` table export. If other modules still import it (they shouldn't after Step 1 and earlier mobile cleanup), grep and fix:
```bash
grep -rn "from '../db/schema'" backend/src | grep milestones
```

- [ ] **Step 6: Create the drop migration**

Create `backend/src/db/migrations/0007_drop_milestones.sql`:

```sql
DROP TABLE IF EXISTS "milestones";
```

- [ ] **Step 7: Run the migration on the test DB**

Apply via the project's migration runner. Verify:
```bash
psql "$DATABASE_URL_TEST" -c "\dt milestones"
```
Expected: "Did not find any relation" — table is gone.

- [ ] **Step 8: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: zero failures.

- [ ] **Step 9: Commit**

```bash
git add -A backend/
git commit -m "chore(backend): remove milestones, drop table"
```

---

## Task 17: End-to-end verification + final cleanup

**Files:** None modified beyond what's needed for verification.

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: green. Any red — fix before proceeding.

- [ ] **Step 2: Run all mobile tests**

Run: `cd mobile && npx jest`
Expected: green.

- [ ] **Step 3: Boot the app against a local backend and manually verify**

- Cold launch lands on Calendar mode showing today.
- Today is empty → large camera CTA visible. Tap → goes to `/capture`.
- Add a photo via the capture flow → photo appears on today's page when returning.
- Swipe left → previous day. Swipe right repeatedly → stops at today (no future days).
- Tap the day header on a day → label input opens. Enter "Sinh nhật" and save → label shows on header. Tap header again → input shows current label, clear button visible. Clear → label gone.
- Switch toggle to Feed → masonry grid by day. Days with labels show the label as heading.
- Tap a day heading in Feed → switches to Calendar mode landed on that date.
- Past day empty → upload CTA visible, no camera CTA. Tap → upload flow (with `targetDate` param if used).
- Upload a photo with EXIF date earlier than today → photo appears on its EXIF day (Calendar mode swipes to it or toast names the day).

- [ ] **Step 4: Search for orphans**

Run:
```bash
grep -rn "milestone\|Milestone" mobile/ backend/ 2>/dev/null | grep -v node_modules | grep -v dist | grep -v migrations
```
Expected: no functional references remain. (Migration files and historical commit messages are fine.)

- [ ] **Step 5: Update the original family-album spec status**

Edit `docs/superpowers/specs/2026-06-03-family-album-design.md`:
- Add a note at the top: `**Superseded in part by** [2026-06-04 Photo Journal Pivot](./2026-06-04-photo-journal-pivot-design.md) — interaction model, milestones, and auto-sync.`

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-06-03-family-album-design.md
git commit -m "docs: mark family album spec superseded by journal pivot"
```

---

## Self-Review Notes

**Spec coverage:**
- Positioning section (spec §Positioning) — captured in the original family-album spec note + product copy in DayPage (`Ghi lại ngày hôm nay`).
- Calendar mode default → Task 12. Swipe day-by-day → Task 10. Past-day-empty no camera → Task 9.
- Feed mode toggle preserved → no code change required beyond default.
- DayPage four states → Task 9 (covers all four with tests).
- Day labels replace milestones → Tasks 1–5 (backend), 7–11 (mobile), 13 (heading), 15–16 (deletion).
- Auto-sync removal → no implementation code found in repo; intentionally not adding new auto-sync code. (If future grep finds vestigial auto-sync stubs, delete them in a follow-up commit.)
- Capture flow → reuses existing polaroid spec/plan; DayPage's camera CTA routes to `/capture`.
- Upload to EXIF day → covered by existing upload flow; spec note about the toast is a UX detail the upload screen can pick up (out of scope here — not introducing regressions).
- Migration milestones → day_labels → Task 5; drop table → Task 16.

**Placeholder scan:** No "TBD"/"TODO" in steps. Where ambiguity might exist (`SheetModal` exact prop names, `colors.danger` presence, repo's exact migration command), I noted the ambiguity inline and prescribed how to adapt. No "fill in details" steps.

**Type consistency:**
- `DayLabel` interface (Task 7) matches the API response shape used in route handlers (Tasks 2/3).
- `dateKey` is `YYYY-MM-DD` everywhere (Tasks 6, 7, 9, 10, 11).
- `DayPage` props (`dateKey`, `photos`, `label`, `onCameraPress`, `onUploadPress`, `onHeaderPress`) are consistent between Task 9 (definition) and Task 10 (consumer).

## Out of Scope (per spec — do NOT implement)

- Auto-sync (removed).
- Multi-photo carousel inside day page.
- Reactions, comments, video, multi-album, exports, face recognition, admin controls, Android, Web.
- Streak / weekly digest / push reminders.

If you need to implement any of these later, write a new plan.
