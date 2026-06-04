# Timeline Feed & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home screen timeline with a Masonry 2-column feed grouped by day plus a Locket-style calendar toggle.

**Architecture:** Backend adds `width`/`height` to photos and a new `/albums/:id/calendar` endpoint. Frontend replaces `TimelineFeed`'s render logic with day-grouped masonry blocks and adds a `CalendarView` component. A toggle in `HomeScreen` switches between the two views.

**Tech Stack:** Node/Express + Drizzle ORM + sharp (backend), React Native + Expo Router + TanStack Query + react-native-gesture-handler (frontend).

---

## File Map

**Create:**
- `backend/src/db/migrations/0004_photo_dimensions.sql`
- `backend/src/routes/calendar.ts`
- `backend/src/routes/calendar.test.ts`
- `mobile/src/hooks/useCalendar.ts`
- `mobile/src/hooks/useCalendar.test.tsx`
- `mobile/src/components/timeline/PhotoTile.tsx`
- `mobile/src/components/timeline/PhotoTile.test.tsx`
- `mobile/src/components/timeline/MilestoneRow.tsx`
- `mobile/src/components/timeline/MilestoneRow.test.tsx`
- `mobile/src/components/timeline/MasonryBlock.tsx`
- `mobile/src/components/timeline/MasonryBlock.test.tsx`
- `mobile/src/components/timeline/CalendarView.tsx`
- `mobile/src/components/timeline/CalendarView.test.tsx`

**Modify:**
- `backend/src/db/schema.ts` — add `width`, `height` to photos
- `backend/src/services/thumbnail.ts` — return original dimensions alongside key
- `backend/src/routes/photos.ts` — store dimensions; accept `width`/`height` from client for videos
- `backend/src/routes/photos.test.ts` — update assertions for new fields
- `backend/src/routes/timeline.ts` — expose `width`/`height` in SQL + response type
- `backend/src/routes/timeline.test.ts` — assert dimensions present
- `backend/src/app.ts` — mount calendar router
- `mobile/src/lib/format.ts` — add `formatVnDayLabel`
- `mobile/src/hooks/useTimeline.ts` — add `width`/`height` to `TimelinePhoto`
- `mobile/src/hooks/useTimeline.test.tsx` — update mock data
- `mobile/src/components/timeline/TimelineFeed.tsx` — rewrite grouping + masonry rendering
- `mobile/src/components/timeline/TimelineFeed.test.tsx` — update tests
- `mobile/app/(tabs)/index.tsx` — add feed/calendar toggle

---

## Task 1: DB Schema — add width/height to photos

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/src/db/migrations/0004_photo_dimensions.sql`

- [ ] **Step 1: Add columns to schema**

In `backend/src/db/schema.ts`, inside the `photos` pgTable definition after `durationMs`:

```typescript
    durationMs: integer('duration_ms'),
    width: integer('width'),
    height: integer('height'),
```

- [ ] **Step 2: Write migration file**

Create `backend/src/db/migrations/0004_photo_dimensions.sql`:

```sql
ALTER TABLE "photos" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "height" integer;
```

- [ ] **Step 3: Apply migration**

```bash
cd backend
DATABASE_URL=<your-db-url> npx drizzle-kit migrate
```

Expected: migration runs without error.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/0004_photo_dimensions.sql
git commit -m "feat(backend): add width/height columns to photos table"
```

---

## Task 2: Thumbnail service — return dimensions

**Files:**
- Modify: `backend/src/services/thumbnail.ts`
- Modify: `backend/src/services/thumbnail.test.ts`

- [ ] **Step 1: Write failing test**

Open `backend/src/services/thumbnail.test.ts`. Add:

```typescript
it('returns original image dimensions alongside thumb key', async () => {
  // existing mock setup assumed to be in place
  const result = await generateThumbnail('photos/test.webp');
  expect(result).toHaveProperty('key');
  expect(result).toHaveProperty('width');
  expect(result).toHaveProperty('height');
  expect(typeof result.width).toBe('number');
  expect(typeof result.height).toBe('number');
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npx jest src/services/thumbnail.test.ts --no-coverage
```

Expected: FAIL — `result` is a string, not an object.

- [ ] **Step 3: Update thumbnail.ts to return { key, width, height }**

Replace `backend/src/services/thumbnail.ts` entirely:

```typescript
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { getObjectBuffer, putObject } from './r2';

export interface ThumbnailResult {
  key: string;
  width: number;
  height: number;
}

export async function generateThumbnail(r2Key: string): Promise<ThumbnailResult> {
  const buffer = await getObjectBuffer(r2Key);
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const thumb = await image
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `thumbnails/${randomUUID()}.webp`;
  await putObject(key, thumb);
  return { key, width, height };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd backend && npx jest src/services/thumbnail.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/thumbnail.ts backend/src/services/thumbnail.test.ts
git commit -m "feat(backend): return original dimensions from generateThumbnail"
```

---

## Task 3: Photos route — store dimensions

**Files:**
- Modify: `backend/src/routes/photos.ts`
- Modify: `backend/src/routes/photos.test.ts`

- [ ] **Step 1: Write failing test**

In `backend/src/routes/photos.test.ts`, find the test for `POST /photos` that asserts the created photo. Add an assertion:

```typescript
expect(res.body.width).toBeDefined();
expect(res.body.height).toBeDefined();
```

Also add a test that verifies `width`/`height` can be supplied for videos:

```typescript
it('stores client-provided width and height for video uploads', async () => {
  // use existing video upload test setup pattern from the file
  // assert res.body.width === 1920 and res.body.height === 1080
  // (adapt to match existing test helpers in photos.test.ts)
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest src/routes/photos.test.ts --no-coverage
```

Expected: FAIL on width/height assertions.

- [ ] **Step 3: Update photos.ts — store dimensions**

In `backend/src/routes/photos.ts`:

**a) Update `toSnakePhoto` to include `width` and `height`:**

```typescript
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
    media_type: p.mediaType,
    source: p.source,
    duration_ms: p.durationMs,
    width: p.width,
    height: p.height,
  };
}
```

**b) Accept `width` and `height` in POST body (for videos):**

In `router.post('/', ...)`, add `width` and `height` to the destructured body:

```typescript
const {
  album_id, r2_key, taken_at, caption, local_asset_id,
  media_type = 'photo', source = 'upload',
  duration_ms, thumbnail_r2_key,
  width: clientWidth, height: clientHeight,
} = req.body ?? {};
```

**c) In the transaction, capture dimensions from `generateThumbnail` for photos:**

```typescript
const [photo] = await db.transaction(async (tx) => {
  await tx.delete(presignTokens).where(eq(presignTokens.key, r2_key));

  let thumbnailKey: string | null;
  let photoWidth: number | null = null;
  let photoHeight: number | null = null;

  if (typedMediaType === 'video') {
    await tx.delete(presignTokens).where(eq(presignTokens.key, thumbnail_r2_key));
    thumbnailKey = thumbnail_r2_key;
    photoWidth = typeof clientWidth === 'number' ? clientWidth : null;
    photoHeight = typeof clientHeight === 'number' ? clientHeight : null;
  } else {
    const result = await generateThumbnail(r2_key);
    thumbnailKey = result.key;
    photoWidth = result.width;
    photoHeight = result.height;
  }

  return tx
    .insert(photos)
    .values({
      albumId: album_id,
      uploadedBy: req.user!.id,
      r2Key: r2_key,
      thumbnailKey,
      takenAt: new Date(taken_at),
      caption: caption ?? null,
      localAssetId: local_asset_id ?? null,
      mediaType: typedMediaType,
      source: typedSource,
      durationMs: typedMediaType === 'video' ? duration_ms : null,
      width: photoWidth,
      height: photoHeight,
    })
    .returning();
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npx jest src/routes/photos.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts
git commit -m "feat(backend): store photo dimensions on upload"
```

---

## Task 4: Timeline route — expose dimensions

**Files:**
- Modify: `backend/src/routes/timeline.ts`
- Modify: `backend/src/routes/timeline.test.ts`

- [ ] **Step 1: Write failing test**

In `backend/src/routes/timeline.test.ts`, add to the existing `insertPhoto` helper a version that stores dimensions:

```typescript
async function insertPhotoWithDimensions(
  albumId: string, userId: string, takenAt: string,
  width: number, height: number
) {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at, width, height)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [albumId, userId, 'photos/test.webp', takenAt, width, height]
  );
  return rows[0];
}
```

Add test:

```typescript
it('includes width and height for photo items', async () => {
  await insertPhotoWithDimensions(album.id, user.id, '2025-06-04T10:00:00Z', 1080, 1920);

  const res = await request(app).get(`/albums/${album.id}/timeline`).set(headers);

  expect(res.status).toBe(200);
  const photo = res.body.items[0];
  expect(photo.type).toBe('photo');
  expect(photo.width).toBe(1080);
  expect(photo.height).toBe(1920);
});

it('returns null width and height for milestone items', async () => {
  await insertMilestone(album.id, user.id, '2025-06-04T10:00:00Z');

  const res = await request(app).get(`/albums/${album.id}/timeline`).set(headers);

  expect(res.status).toBe(200);
  const ms = res.body.items[0];
  expect(ms.type).toBe('milestone');
  expect(ms.width).toBeNull();
  expect(ms.height).toBeNull();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest src/routes/timeline.test.ts --no-coverage
```

Expected: FAIL — `width` and `height` are undefined.

- [ ] **Step 3: Update timeline.ts SQL and types**

In `backend/src/routes/timeline.ts`, update `TimelineRow`:

```typescript
type TimelineRow = {
  id: string;
  type: 'photo' | 'milestone';
  event_time: Date | string;
  r2_key: string | null;
  thumbnail_key: string | null;
  caption: string | null;
  user_id: string;
  local_asset_id: string | null;
  title: string | null;
  note: string | null;
  media_type: string | null;
  source: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
};
```

Update the SQL query to include `width` and `height`:

```typescript
const result = await db.execute<TimelineRow>(sql`
  SELECT id, 'photo' AS type, taken_at AS event_time,
         r2_key, thumbnail_key, caption, uploaded_by AS user_id,
         local_asset_id, NULL AS title, NULL AS note,
         media_type, source, duration_ms,
         width, height
  FROM photos
  WHERE album_id = ${albumId} ${photoCursorClause}

  UNION ALL

  SELECT id, 'milestone' AS type, occurred_at AS event_time,
         NULL, NULL, NULL, created_by AS user_id,
         NULL, title, note,
         NULL, NULL, NULL,
         NULL, NULL
  FROM milestones
  WHERE album_id = ${albumId} ${milestoneCursorClause}

  ORDER BY event_time DESC, id DESC
  LIMIT ${limit + 1}
`);
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npx jest src/routes/timeline.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/timeline.ts backend/src/routes/timeline.test.ts
git commit -m "feat(backend): expose photo dimensions in timeline response"
```

---

## Task 5: Calendar endpoint

**Files:**
- Create: `backend/src/routes/calendar.ts`
- Create: `backend/src/routes/calendar.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing test**

Create `backend/src/routes/calendar.test.ts`:

```typescript
import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
const app = require('../app');

async function insertPhoto(albumId: string, userId: string, takenAt: string, source = 'upload') {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [albumId, userId, 'photos/test.webp', takenAt, source]
  );
  return rows[0];
}

async function insertMilestone(albumId: string, userId: string, occurredAt: string) {
  const { rows } = await pool.query(
    `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'Test milestone', occurredAt]
  );
  return rows[0];
}

describe('GET /albums/:id/calendar', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns dates with correct flags for the given month', async () => {
    await insertPhoto(album.id, user.id, '2025-06-03T10:00:00Z', 'upload');
    await insertPhoto(album.id, user.id, '2025-06-04T10:00:00Z', 'capture');
    await insertMilestone(album.id, user.id, '2025-06-04T10:00:00Z');

    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body['2025-06-03']).toEqual({ photo: true, capture: false, milestone: false });
    expect(res.body['2025-06-04']).toEqual({ photo: false, capture: true, milestone: true });
  });

  it('does not include dates from other months', async () => {
    await insertPhoto(album.id, user.id, '2025-05-31T10:00:00Z', 'upload');
    await insertPhoto(album.id, user.id, '2025-06-01T10:00:00Z', 'upload');

    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body['2025-05-31']).toBeUndefined();
    expect(res.body['2025-06-01']).toBeDefined();
  });

  it('returns empty object for a month with no content', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns 400 for invalid year or month', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=abc&month=6`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'stranger2' });
    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (route not found)**

```bash
cd backend && npx jest src/routes/calendar.test.ts --no-coverage
```

Expected: FAIL with 404 or "Cannot GET".

- [ ] **Step 3: Create calendar.ts**

Create `backend/src/routes/calendar.ts`:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albumMembers } from '../db/schema';
import { isValidUUID } from '../lib/validation';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });

    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    const membership = await db
      .select({ x: sql<number>`1` })
      .from(albumMembers)
      .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
      .limit(1);
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    type DayRow = { day: string; has_upload: boolean; has_capture: boolean; has_milestone: boolean };

    const rows = await db.execute<DayRow>(sql`
      WITH photo_days AS (
        SELECT
          TO_CHAR(taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          BOOL_OR(source = 'upload')  AS has_upload,
          BOOL_OR(source = 'capture') AS has_capture,
          FALSE                        AS has_milestone
        FROM photos
        WHERE album_id = ${albumId}
          AND EXTRACT(YEAR  FROM taken_at AT TIME ZONE 'UTC') = ${year}
          AND EXTRACT(MONTH FROM taken_at AT TIME ZONE 'UTC') = ${month}
        GROUP BY day
      ),
      milestone_days AS (
        SELECT
          TO_CHAR(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          FALSE AS has_upload,
          FALSE AS has_capture,
          TRUE  AS has_milestone
        FROM milestones
        WHERE album_id = ${albumId}
          AND EXTRACT(YEAR  FROM occurred_at AT TIME ZONE 'UTC') = ${year}
          AND EXTRACT(MONTH FROM occurred_at AT TIME ZONE 'UTC') = ${month}
        GROUP BY day
      ),
      combined AS (
        SELECT day, has_upload, has_capture, has_milestone FROM photo_days
        UNION ALL
        SELECT day, has_upload, has_capture, has_milestone FROM milestone_days
      )
      SELECT
        day,
        BOOL_OR(has_upload)    AS has_upload,
        BOOL_OR(has_capture)   AS has_capture,
        BOOL_OR(has_milestone) AS has_milestone
      FROM combined
      GROUP BY day
      ORDER BY day
    `);

    const result: Record<string, { photo: boolean; capture: boolean; milestone: boolean }> = {};
    for (const row of rows.rows) {
      result[row.day] = {
        photo: row.has_upload,
        capture: row.has_capture,
        milestone: row.has_milestone,
      };
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Mount in app.ts**

In `backend/src/app.ts`, add the import after the existing imports:

```typescript
import calendarRoutes from './routes/calendar';
```

Add the mount after the timeline mount line:

```typescript
app.use('/albums/:id/timeline', timelineRoutes);
app.use('/albums/:id/calendar', calendarRoutes);  // ← add this line
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npx jest src/routes/calendar.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Run full backend test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/calendar.ts backend/src/routes/calendar.test.ts backend/src/app.ts
git commit -m "feat(backend): add calendar endpoint GET /albums/:id/calendar"
```

---

## Task 6: Frontend types + useCalendar hook

**Files:**
- Modify: `mobile/src/hooks/useTimeline.ts`
- Modify: `mobile/src/hooks/useTimeline.test.tsx`
- Create: `mobile/src/hooks/useCalendar.ts`
- Create: `mobile/src/hooks/useCalendar.test.tsx`

- [ ] **Step 1: Add width/height to TimelinePhoto**

In `mobile/src/hooks/useTimeline.ts`, update `TimelinePhoto`:

```typescript
export interface TimelinePhoto {
  type: 'photo';
  id: string;
  r2_key: string;
  thumbnail_key: string | null;
  taken_at: string;
  caption: string | null;
  media_type: 'photo' | 'video';
  source: 'capture' | 'upload';
  duration_ms: number | null;
  width: number | null;
  height: number | null;
}
```

- [ ] **Step 2: Update useTimeline tests**

In `mobile/src/hooks/useTimeline.test.tsx`, add `width: null, height: null` to the mock photo objects in all test cases that create photo items. Example:

```typescript
{
  type: 'photo',
  id: 'p1',
  r2_key: 'photos/p1.webp',
  thumbnail_key: 'thumbs/p1.webp',
  taken_at: '2026-01-01T00:00:00Z',
  caption: null,
  media_type: 'photo',
  source: 'upload',
  duration_ms: null,
  width: null,
  height: null,
}
```

- [ ] **Step 3: Run hook tests to confirm they still pass**

```bash
cd mobile && npx jest src/hooks/useTimeline.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Write failing test for useCalendar**

Create `mobile/src/hooks/useCalendar.test.tsx`:

```typescript
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

let mockAlbumId: string | null = 'album-1';
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: mockAlbumId }),
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendar } from '@/hooks/useCalendar';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => {
  mockAlbumId = 'album-1';
  mockApi.get.mockReset();
});

describe('useCalendar', () => {
  test('fetches calendar data for given year/month', async () => {
    const calData = {
      '2025-06-03': { photo: true, capture: false, milestone: false },
      '2025-06-04': { photo: false, capture: true, milestone: true },
    };
    mockApi.get.mockResolvedValueOnce({ data: calData });

    const { result } = renderHook(() => useCalendar(2025, 6), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/albums/album-1/calendar', {
      params: { year: '2025', month: '6' },
    });
    expect(result.current.data).toEqual(calData);
  });

  test('does not fetch when albumId is null', async () => {
    mockAlbumId = null;
    const { result } = renderHook(() => useCalendar(2025, 6), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  test('returns empty object on successful fetch with no data', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useCalendar(2025, 6), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
  });
});
```

- [ ] **Step 5: Run test to confirm it fails**

```bash
cd mobile && npx jest src/hooks/useCalendar.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 6: Create useCalendar.ts**

Create `mobile/src/hooks/useCalendar.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface CalendarDay {
  photo: boolean;
  capture: boolean;
  milestone: boolean;
}

export type CalendarData = Record<string, CalendarDay>;

export function useCalendar(year: number, month: number) {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<CalendarData>({
    queryKey: ['calendar', albumId, year, month],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/calendar`, {
        params: { year: String(year), month: String(month) },
      });
      return data;
    },
    enabled: !!albumId,
  });
}
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/hooks/useCalendar.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/hooks/useTimeline.ts mobile/src/hooks/useTimeline.test.tsx \
        mobile/src/hooks/useCalendar.ts mobile/src/hooks/useCalendar.test.tsx
git commit -m "feat(mobile): add useCalendar hook and width/height to TimelinePhoto"
```

---

## Task 7: formatVnDayLabel utility + PhotoTile component

**Files:**
- Modify: `mobile/src/lib/format.ts`
- Create: `mobile/src/components/timeline/PhotoTile.tsx`
- Create: `mobile/src/components/timeline/PhotoTile.test.tsx`

- [ ] **Step 1: Add formatVnDayLabel to format.ts**

Append to `mobile/src/lib/format.ts`:

```typescript
const DOW_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function formatVnDayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const dow = DOW_VI[d.getDay()];
  return `${dow}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}
```

- [ ] **Step 2: Write failing PhotoTile tests**

Create `mobile/src/components/timeline/PhotoTile.test.tsx`:

```typescript
jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'expo-image'} />;
  },
}));
jest.mock('expo-video', () => ({
  VideoView: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'expo-video'} />;
  },
  useVideoPlayer: jest.fn(() => ({})),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));
jest.mock('@/hooks/useReactions', () => ({
  useReactions: jest.fn(() => ({ data: [] })),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoTile } from '@/components/timeline/PhotoTile';
import { router } from 'expo-router';

const basePhoto = {
  type: 'photo' as const,
  id: 'p1',
  r2_key: 'photos/p1.webp',
  thumbnail_key: 'thumbs/p1.webp',
  taken_at: '2026-01-01T00:00:00Z',
  caption: 'Bé cười',
  media_type: 'photo' as const,
  source: 'upload' as const,
  duration_ms: null,
  width: 1080,
  height: 1920,
};

test('navigates to photo detail on press', () => {
  const { getByTestId } = render(
    <PhotoTile photo={basePhoto} tileHeight={200} tileWidth={160} />
  );
  fireEvent.press(getByTestId('photo-tile'));
  expect(router.push).toHaveBeenCalledWith('/photo/p1');
});

test('shows video badge for video media type', () => {
  const { getByTestId } = render(
    <PhotoTile
      photo={{ ...basePhoto, media_type: 'video', duration_ms: 1500 }}
      tileHeight={200}
      tileWidth={160}
    />
  );
  expect(getByTestId('video-badge')).toBeTruthy();
});

test('hides video badge for photo media type', () => {
  const { queryByTestId } = render(
    <PhotoTile photo={basePhoto} tileHeight={200} tileWidth={160} />
  );
  expect(queryByTestId('video-badge')).toBeNull();
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/components/timeline/PhotoTile.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create PhotoTile.tsx**

Create `mobile/src/components/timeline/PhotoTile.tsx`:

```typescript
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing } from '@/constants/theme';
import { ReactionPicker } from '@/components/ui/ReactionPicker';
import { useReactions, useReact } from '@/hooks/useReactions';
import { tap } from '@/lib/haptics';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PhotoTileProps {
  photo: TimelinePhoto;
  tileWidth: number;
  tileHeight: number;
}

export function PhotoTile({ photo, tileWidth, tileHeight }: PhotoTileProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const { data: reactions = [] } = useReactions(photo.id);
  const { add } = useReact(photo.id);

  const videoUri = photo.media_type === 'video'
    ? `${API_URL}/photos/${photo.id}/full`
    : '';
  const videoPlayer = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const topReactions = reactions.slice(0, 3);

  return (
    <>
      <TouchableOpacity
        testID="photo-tile"
        activeOpacity={0.92}
        onPress={() => { tap(); router.push(`/photo/${photo.id}`); }}
        onLongPress={() => setPickerVisible(true)}
        delayLongPress={350}
      >
        <View style={[styles.tile, { width: tileWidth, height: tileHeight }]}>
          {photo.media_type === 'video' ? (
            <VideoView
              player={videoPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}

          {photo.media_type === 'video' && (
            <View style={styles.videoBadge} testID="video-badge">
              <Ionicons name="videocam" size={10} color={colors.white} />
            </View>
          )}

          {topReactions.length > 0 && (
            <View style={styles.reactionOverlay} testID="reaction-overlay">
              {topReactions.map((r) => (
                <React.Fragment key={r.emoji}>
                  <View style={styles.rxnItem}>
                    {/* emoji text rendered as label for accessibility */}
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>

      <ReactionPicker
        visible={pickerVisible}
        onSelect={(emoji) => add.mutate(emoji)}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.borderSoft,
  },
  videoBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(61,42,31,0.6)',
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  rxnItem: {},
});
```

Note: The reaction overlay currently renders the emoji views without visible text (the `ReactionBadge` component handles the actual display). For the full overlay with emoji text, use `Text` from React Native inside `rxnItem`:

```typescript
import { Text } from 'react-native';
// Inside the topReactions.map:
<View style={styles.rxnItem} key={r.emoji}>
  <Text style={{ fontSize: 10 }}>{r.emoji} {r.count}</Text>
</View>
```

Replace the inner `rxnItem` View with this Text version.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/components/timeline/PhotoTile.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/lib/format.ts \
        mobile/src/components/timeline/PhotoTile.tsx \
        mobile/src/components/timeline/PhotoTile.test.tsx
git commit -m "feat(mobile): add PhotoTile component and formatVnDayLabel"
```

---

## Task 8: MilestoneRow component

**Files:**
- Create: `mobile/src/components/timeline/MilestoneRow.tsx`
- Create: `mobile/src/components/timeline/MilestoneRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/src/components/timeline/MilestoneRow.test.tsx`:

```typescript
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MilestoneRow } from '@/components/timeline/MilestoneRow';
import { router } from 'expo-router';

const milestone = {
  type: 'milestone' as const,
  id: 'ms1',
  title: 'Bé biết đi!',
  note: 'Hôm nay là ngày đặc biệt',
  occurred_at: '2026-06-04T09:00:00Z',
  icon: null,
};

test('renders milestone title', () => {
  const { getByText } = render(<MilestoneRow milestone={milestone} />);
  expect(getByText('Bé biết đi!')).toBeTruthy();
});

test('navigates to milestone detail on press', () => {
  const { getByTestId } = render(<MilestoneRow milestone={milestone} />);
  fireEvent.press(getByTestId('milestone-row'));
  expect(router.push).toHaveBeenCalledWith('/milestone/ms1');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/components/timeline/MilestoneRow.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create MilestoneRow.tsx**

Create `mobile/src/components/timeline/MilestoneRow.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/constants/theme';
import type { TimelineMilestone } from '@/hooks/useTimeline';

interface MilestoneRowProps {
  milestone: TimelineMilestone;
}

export function MilestoneRow({ milestone }: MilestoneRowProps) {
  return (
    <TouchableOpacity
      testID="milestone-row"
      style={styles.row}
      onPress={() => router.push(`/milestone/${milestone.id}`)}
      activeOpacity={0.85}
    >
      <Text style={styles.icon}>🎯</Text>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>{milestone.title}</Text>
        <Text style={styles.sub}>Cột mốc</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.mint,
  },
  icon: { fontSize: 22 },
  meta: { flex: 1 },
  title: { ...typography.body, color: colors.ink, marginBottom: 2 },
  sub: { ...typography.bodySmall, color: colors.inkMuted },
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/components/timeline/MilestoneRow.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/MilestoneRow.tsx \
        mobile/src/components/timeline/MilestoneRow.test.tsx
git commit -m "feat(mobile): add MilestoneRow component for feed"
```

---

## Task 9: MasonryBlock component

**Files:**
- Create: `mobile/src/components/timeline/MasonryBlock.tsx`
- Create: `mobile/src/components/timeline/MasonryBlock.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/components/timeline/MasonryBlock.test.tsx`:

```typescript
import { distributeMasonry } from '@/components/timeline/MasonryBlock';

const makePhoto = (id: string, w: number, h: number) => ({
  type: 'photo' as const,
  id,
  r2_key: `photos/${id}.webp`,
  thumbnail_key: null,
  taken_at: '2026-01-01T00:00:00Z',
  caption: null,
  media_type: 'photo' as const,
  source: 'upload' as const,
  duration_ms: null,
  width: w,
  height: h,
});

const COL_WIDTH = 160;

test('distributes single photo to left column', () => {
  const { left, right } = distributeMasonry([makePhoto('p1', 1080, 1920)], COL_WIDTH);
  expect(left).toHaveLength(1);
  expect(right).toHaveLength(0);
});

test('distributes two photos to different columns', () => {
  const photos = [makePhoto('p1', 1080, 1920), makePhoto('p2', 1920, 1080)];
  const { left, right } = distributeMasonry(photos, COL_WIDTH);
  expect(left).toHaveLength(1);
  expect(right).toHaveLength(1);
});

test('clamps tile height to minimum 72', () => {
  const { left } = distributeMasonry([makePhoto('p1', 1080, 100)], COL_WIDTH);
  expect(left[0].tileHeight).toBe(72);
});

test('clamps tile height to maximum 220', () => {
  const { left } = distributeMasonry([makePhoto('p1', 100, 10000)], COL_WIDTH);
  expect(left[0].tileHeight).toBe(220);
});

test('uses square fallback when dimensions are null', () => {
  const photo = { ...makePhoto('p1', 0, 0), width: null, height: null };
  const { left } = distributeMasonry([photo], COL_WIDTH);
  expect(left[0].tileHeight).toBe(COL_WIDTH);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/components/timeline/MasonryBlock.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create MasonryBlock.tsx**

Create `mobile/src/components/timeline/MasonryBlock.tsx`:

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PhotoTile } from './PhotoTile';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const TILE_MIN_HEIGHT = 72;
const TILE_MAX_HEIGHT = 220;
const COL_GAP = 4;

export interface MasonryColumn {
  photo: TimelinePhoto;
  tileHeight: number;
}

export interface MasonryBlockData {
  left: MasonryColumn[];
  right: MasonryColumn[];
}

function computeTileHeight(photo: TimelinePhoto, colWidth: number): number {
  if (photo.width && photo.height && photo.width > 0) {
    const natural = colWidth * (photo.height / photo.width);
    return Math.min(Math.max(natural, TILE_MIN_HEIGHT), TILE_MAX_HEIGHT);
  }
  return colWidth;
}

export function distributeMasonry(photos: TimelinePhoto[], colWidth: number): MasonryBlockData {
  const left: MasonryColumn[] = [];
  const right: MasonryColumn[] = [];
  let leftH = 0;
  let rightH = 0;

  for (const photo of photos) {
    const tileHeight = computeTileHeight(photo, colWidth);
    if (leftH <= rightH) {
      left.push({ photo, tileHeight });
      leftH += tileHeight + COL_GAP;
    } else {
      right.push({ photo, tileHeight });
      rightH += tileHeight + COL_GAP;
    }
  }

  return { left, right };
}

interface MasonryBlockProps {
  block: MasonryBlockData;
  columnWidth: number;
}

export function MasonryBlock({ block, columnWidth }: MasonryBlockProps) {
  return (
    <View style={styles.row} testID="masonry-block">
      <View style={[styles.col, { gap: COL_GAP }]}>
        {block.left.map((item) => (
          <PhotoTile
            key={item.photo.id}
            photo={item.photo}
            tileWidth={columnWidth}
            tileHeight={item.tileHeight}
          />
        ))}
      </View>
      <View style={[styles.col, { gap: COL_GAP }]}>
        {block.right.map((item) => (
          <PhotoTile
            key={item.photo.id}
            photo={item.photo}
            tileWidth={columnWidth}
            tileHeight={item.tileHeight}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: COL_GAP,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  col: {
    flex: 1,
    flexDirection: 'column',
  },
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/components/timeline/MasonryBlock.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/MasonryBlock.tsx \
        mobile/src/components/timeline/MasonryBlock.test.tsx
git commit -m "feat(mobile): add MasonryBlock component with greedy 2-column distribution"
```

---

## Task 10: Refactor TimelineFeed

**Files:**
- Modify: `mobile/src/components/timeline/TimelineFeed.tsx`
- Modify: `mobile/src/components/timeline/TimelineFeed.test.tsx`

- [ ] **Step 1: Rewrite TimelineFeed.tsx**

Replace `mobile/src/components/timeline/TimelineFeed.tsx` entirely:

```typescript
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, View, Text, useWindowDimensions } from 'react-native';
import { useTimeline, TimelineItem, TimelineMilestone } from '@/hooks/useTimeline';
import { MasonryBlock, MasonryBlockData, distributeMasonry } from './MasonryBlock';
import { MilestoneRow } from './MilestoneRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { colors, spacing, typography } from '@/constants/theme';
import { formatVnDayLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const H_PADDING = 6;
const COL_GAP = 4;

interface FlatListItem {
  type: 'dayHeader' | 'masonryBlock' | 'milestone';
  key: string;
  label?: string;
  block?: MasonryBlockData;
  milestone?: TimelineMilestone;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } =
    useTimeline();
  const { width: screenWidth } = useWindowDimensions();
  const columnWidth = (screenWidth - H_PADDING * 2 - COL_GAP) / 2;

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentDay = '';
    let photoBuffer: TimelinePhoto[] = [];

    const flushPhotos = (dayKey: string, anchorId: string) => {
      if (photoBuffer.length === 0) return;
      const block = distributeMasonry(photoBuffer, columnWidth);
      result.push({ type: 'masonryBlock', key: `masonry-${dayKey}-${anchorId}`, block });
      photoBuffer = [];
    };

    for (const item of allItems) {
      const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
      const dayKey = dateStr.slice(0, 10);

      if (dayKey !== currentDay) {
        if (currentDay) flushPhotos(currentDay, photoBuffer[0]?.id ?? 'end');
        currentDay = dayKey;
        result.push({ type: 'dayHeader', key: `day-${dayKey}`, label: formatVnDayLabel(dateStr) });
      }

      if (item.type === 'photo') {
        photoBuffer.push(item as TimelinePhoto);
      } else {
        flushPhotos(dayKey, item.id);
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item as TimelineMilestone });
      }
    }
    if (photoBuffer.length > 0) flushPhotos(currentDay, photoBuffer[0].id);

    return result;
  }, [data, columnWidth]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.skel}>
        <SkeletonRow rowIndex={0} />
        <SkeletonRow rowIndex={1} />
      </View>
    );
  }
  if (!items.length) return <EmptyState emoji="🌸" message={t('home.empty_message')} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.content}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pink} />
      }
      renderItem={({ item }) => {
        if (item.type === 'dayHeader') {
          return (
            <Text style={styles.dayHeader} testID={`day-header-${item.key}`}>
              {item.label}
            </Text>
          );
        }
        if (item.type === 'masonryBlock') {
          return <MasonryBlock block={item.block!} columnWidth={columnWidth} />;
        }
        return <MilestoneRow milestone={item.milestone!} />;
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: H_PADDING, paddingBottom: spacing['4xl'] },
  skel: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg },
  dayHeader: {
    ...typography.bodySmall,
    color: colors.pink,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 2,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
});
```

- [ ] **Step 2: Update TimelineFeed tests**

In `mobile/src/components/timeline/TimelineFeed.test.tsx`, update mock data and assertions to match the new rendering:
- Mock `distributeMasonry` if tests become brittle, or just verify `testID="masonry-block"` appears
- Remove assertions for `polaroid` and `photoRow` types
- Add assertions for `day-header-*` testIDs

Refer to the existing test file for the mock setup pattern. Key assertion to add:

```typescript
// After rendering with a mock that returns photo items:
expect(getByTestId(/day-header/)).toBeTruthy();
expect(getByTestId('masonry-block')).toBeTruthy();
```

- [ ] **Step 3: Run tests**

```bash
cd mobile && npx jest src/components/timeline/TimelineFeed.test.tsx --no-coverage
```

Expected: PASS (adapt failing tests to the new rendering structure).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/timeline/TimelineFeed.tsx \
        mobile/src/components/timeline/TimelineFeed.test.tsx
git commit -m "feat(mobile): refactor TimelineFeed to masonry grid grouped by day"
```

---

## Task 11: CalendarView component

**Files:**
- Create: `mobile/src/components/timeline/CalendarView.tsx`
- Create: `mobile/src/components/timeline/CalendarView.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/src/components/timeline/CalendarView.test.tsx`:

```typescript
jest.mock('@/hooks/useCalendar', () => ({
  useCalendar: jest.fn(),
}));
jest.mock('@/hooks/useTimeline', () => ({
  useTimeline: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarView } from '@/components/timeline/CalendarView';
import { useCalendar } from '@/hooks/useCalendar';
import { useTimeline } from '@/hooks/useTimeline';

const mockUseCalendar = useCalendar as jest.Mock;
const mockUseTimeline = useTimeline as jest.Mock;

beforeEach(() => {
  mockUseCalendar.mockReturnValue({ data: {}, isLoading: false });
  mockUseTimeline.mockReturnValue({ data: null });
});

test('renders month navigation arrows', () => {
  const { getByTestId } = render(<CalendarView />);
  expect(getByTestId('cal-prev')).toBeTruthy();
  expect(getByTestId('cal-next')).toBeTruthy();
});

test('shows colored cell for a day with a photo', () => {
  mockUseCalendar.mockReturnValue({
    data: { '2026-06-04': { photo: true, capture: false, milestone: false } },
    isLoading: false,
  });
  const { getByTestId } = render(<CalendarView />);
  expect(getByTestId('cal-day-2026-06-04')).toBeTruthy();
});

test('pressing next month arrow changes displayed month label', () => {
  mockUseCalendar.mockReturnValue({ data: {}, isLoading: false });
  const { getByTestId, getByText } = render(<CalendarView />);
  const now = new Date();
  const nextMonth = now.getMonth() + 2; // 1-indexed
  fireEvent.press(getByTestId('cal-next'));
  // Month label includes the next month number
  expect(getByText(new RegExp(`Tháng ${nextMonth > 12 ? nextMonth - 12 : nextMonth}`))).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/components/timeline/CalendarView.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create CalendarView.tsx**

Create `mobile/src/components/timeline/CalendarView.tsx`:

```typescript
import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCalendar } from '@/hooks/useCalendar';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { colors, spacing, typography } from '@/constants/theme';
import { formatVnDayLabel } from '@/lib/format';

const DOW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function getFirstDayOfWeek(year: number, month: number): number {
  // Returns 0-6 where 0=Monday … 6=Sunday (Vietnamese week starts Monday)
  const d = new Date(year, month - 1, 1).getDay(); // 0=Sun…6=Sat
  return d === 0 ? 6 : d - 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: calData = {} } = useCalendar(year, month);
  const { data: timelineData } = useTimeline();

  const totalDays = daysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const todayKey = toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Items for the selected day from the cached timeline
  const selectedItems = useMemo<TimelineItem[]>(() => {
    if (!selectedDay || !timelineData) return [];
    return timelineData.pages
      .flatMap(p => p.items)
      .filter(item => {
        const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
        return dateStr.slice(0, 10) === selectedDay;
      });
  }, [selectedDay, timelineData]);

  function getDayStyle(dayKey: string) {
    const info = calData[dayKey];
    if (!info) return styles.dayEmpty;
    if (info.capture) return styles.dayCapture;
    if (info.photo) return styles.dayPhoto;
    if (info.milestone) return styles.dayMilestone;
    return styles.dayEmpty;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Month navigation */}
      <View style={styles.nav}>
        <TouchableOpacity testID="cal-prev" onPress={prevMonth} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>Tháng {month} · {year}</Text>
        <TouchableOpacity testID="cal-next" onPress={nextMonth} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dowRow}>
        {DOW_LABELS.map(d => <Text key={d} style={styles.dowLabel}>{d}</Text>)}
      </View>

      {/* Day grid */}
      <View style={styles.grid}>
        {/* Empty offset cells */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dayKey = toDateKey(year, month, day);
          const isToday = dayKey === todayKey;
          const isSelected = dayKey === selectedDay;
          return (
            <TouchableOpacity
              key={dayKey}
              testID={`cal-day-${dayKey}`}
              style={[
                styles.dayCell,
                getDayStyle(dayKey),
                isToday && styles.dayToday,
                isSelected && styles.daySelected,
              ]}
              onPress={() => setSelectedDay(dayKey === selectedDay ? null : dayKey)}
            >
              <Text style={[
                styles.dayNum,
                calData[dayKey] && styles.dayNumActive,
                isToday && styles.dayNumToday,
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: colors.yellow }]} />
          <Text style={styles.legText}>Ảnh upload</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: colors.pink }]} />
          <Text style={styles.legText}>Capture</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: colors.mint }]} />
          <Text style={styles.legText}>Cột mốc</Text>
        </View>
      </View>

      {/* Day detail panel */}
      {selectedDay && (
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>{formatVnDayLabel(selectedDay + 'T00:00:00Z')}</Text>
          {selectedItems.length === 0 && (
            <Text style={styles.detailEmpty}>Không có nội dung cho ngày này trong bộ nhớ cache. Kéo feed để tải thêm.</Text>
          )}
          {selectedItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <View style={styles.detailDivider} />}
              <TouchableOpacity
                style={styles.detailItem}
                onPress={() =>
                  item.type === 'photo'
                    ? router.push(`/photo/${item.id}`)
                    : router.push(`/milestone/${item.id}`)
                }
              >
                <View style={styles.detailThumb}>
                  {item.type === 'photo' && (
                    <Image
                      source={{ uri: `${API_URL}/photos/${item.id}/thumb` }}
                      style={StyleSheet.absoluteFill as any}
                      contentFit="cover"
                    />
                  )}
                  {item.type === 'milestone' && (
                    <Text style={{ fontSize: 22 }}>🎯</Text>
                  )}
                </View>
                <View style={styles.detailMeta}>
                  <Text style={styles.detailCap} numberOfLines={1}>
                    {item.type === 'photo'
                      ? (item.caption ?? 'Ảnh')
                      : item.title}
                  </Text>
                  {item.type === 'milestone' && (
                    <Text style={styles.detailSub}>Cột mốc</Text>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing['4xl'] },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  arrow: { padding: spacing.sm },
  arrowText: { ...typography.heading, color: colors.inkMuted },
  monthLabel: { ...typography.title, color: colors.ink },
  dowRow: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  dowLabel: { flex: 1, textAlign: 'center', ...typography.bodySmall, color: colors.inkMuted, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, gap: 3 },
  dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayEmpty: { backgroundColor: 'transparent' },
  dayPhoto: { backgroundColor: colors.yellow },
  dayCapture: { backgroundColor: colors.pink },
  dayMilestone: { backgroundColor: colors.mint },
  dayToday: { borderWidth: 2, borderColor: colors.pink },
  daySelected: { borderWidth: 2.5, borderColor: colors.ink },
  dayNum: { ...typography.bodySmall, color: colors.inkMuted },
  dayNumActive: { color: colors.ink, fontWeight: '700' },
  dayNumToday: { color: colors.pink, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 3 },
  legText: { ...typography.bodySmall, color: colors.inkSoft },
  detail: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  detailLabel: { ...typography.bodySmall, color: colors.pink, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  detailEmpty: { ...typography.bodySmall, color: colors.inkMuted, textAlign: 'center', paddingVertical: spacing.md },
  detailItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 5 },
  detailThumb: { width: 50, height: 50, borderRadius: 9, backgroundColor: colors.borderSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailMeta: { flex: 1 },
  detailCap: { ...typography.body, color: colors.ink },
  detailSub: { ...typography.bodySmall, color: colors.inkMuted },
  detailDivider: { height: 1, backgroundColor: colors.borderSoft },
});
```

Note: The `StyleSheet.absoluteFill as any` cast works around a minor type mismatch with expo-image style prop. Alternatively import `StyleSheet` and use `{ ...StyleSheet.absoluteFill }`.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/components/timeline/CalendarView.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/CalendarView.tsx \
        mobile/src/components/timeline/CalendarView.test.tsx
git commit -m "feat(mobile): add CalendarView component (Locket-style)"
```

---

## Task 12: HomeScreen toggle

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Add toggle state and render CalendarView**

In `mobile/app/(tabs)/index.tsx`, make the following changes:

**a) Add import:**

```typescript
import { CalendarView } from '@/components/timeline/CalendarView';
```

**b) Add state at the top of `HomeScreen`:**

```typescript
const [feedMode, setFeedMode] = useState<'feed' | 'calendar'>('feed');
```

**c) Add the toggle buttons inside `JoyfulHeader`, after the avatarRow `TouchableOpacity` (and remove the existing `cameraBtn` placement — put camera button only in feed mode). Replace the existing `cameraBtn` block:**

```typescript
{/* Feed / Calendar toggle */}
<View style={styles.toggleRow}>
  <TouchableOpacity
    style={[styles.toggleBtn, feedMode === 'feed' && styles.toggleBtnActive]}
    onPress={() => setFeedMode('feed')}
    testID="toggle-feed"
  >
    <Ionicons name="grid-outline" size={16} color={feedMode === 'feed' ? colors.white : colors.ink} />
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.toggleBtn, feedMode === 'calendar' && styles.toggleBtnActive]}
    onPress={() => setFeedMode('calendar')}
    testID="toggle-calendar"
  >
    <Ionicons name="calendar-outline" size={16} color={feedMode === 'calendar' ? colors.white : colors.ink} />
  </TouchableOpacity>
</View>
{feedMode === 'feed' && (
  <TouchableOpacity style={styles.cameraBtn} onPress={handleCameraPress}>
    <Ionicons name="camera-outline" size={22} color={canCapture ? colors.ink : colors.inkMuted} />
  </TouchableOpacity>
)}
```

**d) Replace `<TimelineFeed childBirthdate={birthdate} />` with:**

```typescript
{feedMode === 'feed'
  ? <TimelineFeed childBirthdate={birthdate} />
  : <CalendarView />
}
```

**e) Add styles:**

```typescript
toggleRow: { flexDirection: 'row', gap: 4, position: 'absolute', right: 0, top: 0 },
toggleBtn: {
  width: 28, height: 28, borderRadius: 8,
  borderWidth: 1.5, borderColor: colors.ink,
  backgroundColor: colors.white,
  alignItems: 'center', justifyContent: 'center',
},
toggleBtnActive: { backgroundColor: colors.pink, borderColor: colors.pink },
```

- [ ] **Step 2: Run the mobile test suite**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all green (the HomeScreen tests may need minor updates for the new toggle elements — add `jest.mock('@/components/timeline/CalendarView', ...)` if CalendarView imports cause issues in that test file).

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/index.tsx
git commit -m "feat(mobile): add feed/calendar toggle to HomeScreen"
```

---

## Task 13: Build and smoke test

- [ ] **Step 1: Run full test suites**

```bash
cd backend && npx jest --no-coverage
cd mobile  && npx jest --no-coverage
```

Expected: all green.

- [ ] **Step 2: Build backend**

```bash
cd backend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Build mobile**

```bash
cd mobile && npx expo export --platform ios --dev 2>&1 | tail -20
```

Expected: bundle builds without error.

- [ ] **Step 4: Start dev server and verify**

```bash
cd mobile && npx expo start
```

Open on device/simulator. Verify:
- Feed shows masonry 2-column grid grouped by day
- Tapping 📅 toggles to calendar
- Calendar shows colored dots for days with content
- Tapping a day shows photos below
- Tapping ⊞ returns to feed
- Long-pressing a photo opens reaction picker

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup — timeline feed + calendar complete"
```
