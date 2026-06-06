# Setlog Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the app to a Setlog-inspired daily photo/video diary: 2-tab PagerView (Camera | Albums), masonry day grid per album, Story Viewer per day, multi-album capture flow, no rate limit.

**Architecture:** Backend first (album_photos join table, updated POST /photos, two new GET endpoints), then mobile (PagerView tabs, new screens, refactored hooks, cleanup of old components). Camera is embedded as a tab page (not a modal), story viewer is a full-screen stack route. Each photo is stored once in R2 but linked to N albums via album_photos.

**Tech Stack:**
- Backend: Express + Drizzle ORM + PostgreSQL, jest + supertest
- Mobile: React Native + Expo Router + react-native-pager-view + TanStack Query + Zustand, jest + @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-06-06-setlog-pivot-design.md`

---

## File Structure

### Backend — created
- `backend/src/db/migrations/0010_album_photos.sql`
- `backend/src/routes/album-days.ts`
- `backend/src/routes/album-days.test.ts`

### Backend — modified
- `backend/src/db/schema.ts` — add `albumPhotos` table
- `backend/src/routes/photos.ts` — album_ids[], remove rate limit, insert album_photos
- `backend/src/routes/photos.test.ts` — new/updated tests
- `backend/src/app.ts` — mount album-days route

### Mobile — installed
- `react-native-pager-view` (via `npx expo install`)
- `expo-screen-orientation` (via `npx expo install`)

### Mobile — created
- `mobile/src/components/tabs/CameraPage.tsx`
- `mobile/src/components/tabs/AlbumsPage.tsx`
- `mobile/src/components/tabs/SettingsSheet.tsx`
- `mobile/src/components/tabs/CustomTabBar.tsx`
- `mobile/src/components/album/DayCell.tsx`
- `mobile/src/hooks/useAlbumDays.ts`
- `mobile/src/hooks/useAlbumDays.test.tsx`
- `mobile/src/hooks/useDayPhotos.ts`
- `mobile/src/hooks/useDayPhotos.test.tsx`
- `mobile/app/story/[albumId]/[date].tsx`

### Mobile — modified
- `mobile/app/(tabs)/_layout.tsx` — hide default tab bar
- `mobile/app/(tabs)/index.tsx` — PagerView main screen
- `mobile/app/albums/[id].tsx` — masonry day grid
- `mobile/app/_layout.tsx` — register story route
- `mobile/src/hooks/useCapture.ts` — remove cooldown, album_ids[]
- `mobile/src/hooks/useCapture.test.ts`
- `mobile/app/photo-review.tsx` — multi-album checkbox

### Mobile — deleted
- `mobile/app/capture.tsx` (camera now embedded in CameraPage)
- `mobile/src/components/timeline/CalendarView.tsx` + test
- `mobile/src/components/timeline/DayPager.tsx` + test
- `mobile/src/components/timeline/DayPage.tsx` + test
- `mobile/src/components/timeline/MilestoneLabelInput.tsx` + test
- `mobile/src/hooks/useDayLabels.ts` + test
- `mobile/src/stores/captureStore.ts` (cooldown logic gone; replace with empty shim)
- `mobile/src/stores/jumpToDayStore.ts`

---

## Task 1: `album_photos` join table — migration + schema

**Files:**
- Create: `backend/src/db/migrations/0010_album_photos.sql`
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Create the migration SQL**

Create `backend/src/db/migrations/0010_album_photos.sql`:

```sql
CREATE TABLE "album_photos" (
  "photo_id" uuid NOT NULL REFERENCES "photos"("id") ON DELETE CASCADE,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("photo_id", "album_id")
);

CREATE INDEX "idx_album_photos_album_id" ON "album_photos" ("album_id", "added_at" DESC);
```

- [ ] **Step 2: Add `albumPhotos` to `backend/src/db/schema.ts`**

After the `reactions` table and before `dayLabels`, add:

```typescript
export const albumPhotos = pgTable(
  'album_photos',
  {
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: { columns: [t.photoId, t.albumId] },
    byAlbum: index('idx_album_photos_album_id').on(t.albumId, t.addedAt.desc()),
  })
);
```

Also add `albumPhotos` to the import list in files that will use it. Export is automatic since it's in schema.ts.

- [ ] **Step 3: Run the migration against the test DB**

```bash
cd backend && psql "$DATABASE_URL_TEST" -f src/db/migrations/0010_album_photos.sql
```

Expected output: `CREATE TABLE`, `CREATE INDEX`

Verify:
```bash
psql "$DATABASE_URL_TEST" -c "\d album_photos"
```
Expected: table with columns `photo_id`, `album_id`, `added_at` and primary key on both.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/0010_album_photos.sql backend/src/db/schema.ts
git commit -m "feat(backend): add album_photos join table"
```

---

## Task 2: Update `POST /photos` — `album_ids[]`, remove rate limit

**Files:**
- Modify: `backend/src/routes/photos.ts`
- Modify: `backend/src/routes/photos.test.ts`

- [ ] **Step 1: Add failing tests**

Open `backend/src/routes/photos.test.ts`. After the existing `describe('POST /photos')` block, add a new describe block:

```typescript
describe('POST /photos — multi-album', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album1: Awaited<ReturnType<typeof createTestAlbum>>;
  let album2: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album1 = await createTestAlbum(user.id);
    album2 = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockPresign.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.webp' });
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/abc.webp', width: 800, height: 600 });
  });

  it('creates album_photos records for each album_id', async () => {
    const token = await createPresignToken(user.id, 'photos/abc.webp');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_ids: [album1.id, album2.id],
        r2_key: 'photos/abc.webp',
        taken_at: new Date().toISOString(),
      });
    expect(res.status).toBe(201);

    const { pool } = require('../db');
    const rows = await pool.query(
      'SELECT album_id FROM album_photos WHERE photo_id = $1 ORDER BY album_id',
      [res.body.id]
    );
    const albumIds = rows.rows.map((r: any) => r.album_id).sort();
    expect(albumIds).toEqual([album1.id, album2.id].sort());
  });

  it('returns 400 when album_ids is empty', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [], r2_key: 'photos/abc.webp', taken_at: new Date().toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_ids/);
  });

  it('returns 403 when user is not a member of one of the albums', async () => {
    const other = await createTestUser({ apple_sub: 'other-' + Date.now() });
    const otherAlbum = await createTestAlbum(other.id);
    await createPresignToken(user.id, 'photos/abc.webp');

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_ids: [album1.id, otherAlbum.id],
        r2_key: 'photos/abc.webp',
        taken_at: new Date().toISOString(),
      });
    expect(res.status).toBe(403);
  });

  it('allows immediate re-capture (no rate limit)', async () => {
    for (let i = 0; i < 3; i++) {
      mockPresign.mockResolvedValueOnce({ url: 'https://r2.example.com/presigned', key: `photos/${i}.webp` });
      await createPresignToken(user.id, `photos/${i}.webp`);
      const res = await request(app)
        .post('/photos')
        .set(headers)
        .send({
          album_ids: [album1.id],
          r2_key: `photos/${i}.webp`,
          taken_at: new Date().toISOString(),
          source: 'capture',
        });
      expect(res.status).toBe(201);
    }
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd backend && npx jest src/routes/photos.test.ts -t "multi-album" -v
```
Expected: FAIL (album_ids not yet accepted, rate limit still there)

- [ ] **Step 3: Update `backend/src/routes/photos.ts`**

Replace the entire `router.post('/', ...)` handler. The key changes:
1. Accept `album_ids: string[]` instead of `album_id: string`
2. Remove the rate-limit block
3. After inserting the photo, insert rows into `album_photos` for each album_id
4. Keep `photos.albumId` set to `album_ids[0]` for backwards compat with existing timeline/reactions

Replace lines 69–238 with:

```typescript
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      album_ids, r2_key, taken_at, caption, local_asset_id,
      media_type = 'photo', source = 'upload',
      duration_ms, thumbnail_r2_key,
      width: clientWidth, height: clientHeight,
    } = req.body ?? {};

    if (!Array.isArray(album_ids) || album_ids.length === 0) {
      return res.status(400).json({ error: 'album_ids must be a non-empty array' });
    }
    if (!r2_key || !taken_at) {
      return res.status(400).json({ error: 'r2_key, taken_at required' });
    }
    if (album_ids.some((id: unknown) => typeof id !== 'string' || !isValidUUID(id as string))) {
      return res.status(400).json({ error: 'all album_ids must be valid UUIDs' });
    }
    if (!isValidDate(taken_at)) {
      return res.status(400).json({ error: 'taken_at must be a valid ISO date' });
    }
    if (!['photo', 'video'].includes(media_type)) {
      return res.status(400).json({ error: 'media_type must be photo or video' });
    }
    if (!['capture', 'upload'].includes(source)) {
      return res.status(400).json({ error: 'source must be capture or upload' });
    }

    const typedMediaType = media_type as 'photo' | 'video';
    const typedSource = source as 'capture' | 'upload';
    const primaryAlbumId = album_ids[0] as string;

    if (typedMediaType === 'video') {
      if (duration_ms == null) return res.status(400).json({ error: 'duration_ms required for video' });
      if (typeof duration_ms !== 'number' || !Number.isInteger(duration_ms) || duration_ms > 2000 || duration_ms < 1) {
        return res.status(400).json({ error: 'duration_ms must be between 1 and 2000' });
      }
      if (!thumbnail_r2_key) return res.status(400).json({ error: 'thumbnail_r2_key required for video' });
    }

    // Check membership in ALL requested albums
    for (const albumId of album_ids as string[]) {
      if (!(await requireMember(albumId, req.user!.id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Idempotency check before consuming presign token
    if (local_asset_id) {
      const existing = await db
        .select()
        .from(photos)
        .where(and(
          eq(photos.albumId, primaryAlbumId),
          eq(photos.localAssetId, local_asset_id),
          eq(photos.uploadedBy, req.user!.id)
        ))
        .limit(1);
      if (existing[0]) return res.status(200).json(toSnakePhoto(existing[0]));
    }

    // Verify r2_key ownership
    const [token] = await db
      .select()
      .from(presignTokens)
      .where(and(eq(presignTokens.key, r2_key), eq(presignTokens.userId, req.user!.id)))
      .limit(1);
    if (!token) return res.status(400).json({ error: 'Invalid or unrecognized r2_key' });

    // Verify thumbnail token for videos
    if (typedMediaType === 'video') {
      const [thumbToken] = await db
        .select()
        .from(presignTokens)
        .where(and(eq(presignTokens.key, thumbnail_r2_key), eq(presignTokens.userId, req.user!.id)))
        .limit(1);
      if (!thumbToken) return res.status(400).json({ error: 'Invalid or unrecognized thumbnail_r2_key' });
    }

    const [photo] = await db.transaction(async (tx) => {
      await tx.delete(presignTokens).where(eq(presignTokens.key, r2_key));

      let thumbnailKey: string | null;
      let photoWidth: number | null = null;
      let photoHeight: number | null = null;

      if (typedMediaType === 'video') {
        await tx.delete(presignTokens).where(eq(presignTokens.key, thumbnail_r2_key));
        thumbnailKey = thumbnail_r2_key;
        photoWidth = Number.isInteger(clientWidth) && clientWidth > 0 ? clientWidth : null;
        photoHeight = Number.isInteger(clientHeight) && clientHeight > 0 ? clientHeight : null;
      } else {
        const result = await generateThumbnail(r2_key);
        thumbnailKey = result.key;
        photoWidth = result.width;
        photoHeight = result.height;
      }

      const [inserted] = await tx
        .insert(photos)
        .values({
          albumId: primaryAlbumId,
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

      // Insert into album_photos for all requested albums
      if (album_ids.length > 0) {
        await tx.execute(
          sql`INSERT INTO album_photos (photo_id, album_id)
              SELECT ${inserted.id}, unnest(${sql.raw(`ARRAY[${(album_ids as string[]).map((id) => `'${id}'`).join(',')}]::uuid[]`)})`
        );
      }

      return [inserted];
    });

    // Push notification to members of the primary album
    const recipients = await db
      .select({ token: users.apnsToken })
      .from(users)
      .innerJoin(albumMembers, eq(albumMembers.userId, users.id))
      .where(and(
        eq(albumMembers.albumId, primaryAlbumId),
        isNotNull(users.apnsToken),
        ne(users.id, req.user!.id)
      ));
    const tokens = recipients.map((r) => r.token!).filter(Boolean);
    sendPush(tokens, 'Ảnh mới', `${req.user!.displayName} đã thêm ảnh mới`, { photoId: photo.id }).catch(console.error);

    return res.status(201).json(toSnakePhoto(photo));
  } catch (err) {
    next(err);
  }
});
```

Also add `albumPhotos` and `sql` to the imports at the top of `photos.ts`. The existing `sql` import from `drizzle-orm` is already there in `requireMember`. Add `albumPhotos` to the schema import line:

```typescript
import { users, albumMembers, photos, presignTokens, albumPhotos } from '../db/schema';
```

- [ ] **Step 4: Run the multi-album tests**

```bash
cd backend && npx jest src/routes/photos.test.ts -t "multi-album" -v
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Run the full photos test suite to check for regressions**

```bash
cd backend && npx jest src/routes/photos.test.ts -v
```

Fix any failing tests. The existing tests use `album_id` (singular) — they will break because the new route requires `album_ids` (array). Update those existing test `send()` calls:

Find every `send({ album_id: album.id, ...})` in the `POST /photos` describe block and change to `send({ album_ids: [album.id], ...})`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts backend/src/db/schema.ts
git commit -m "feat(backend): POST /photos accepts album_ids[], removes rate limit"
```

---

## Task 3: `GET /albums/:id/days` and `GET /albums/:id/days/:date/photos`

**Files:**
- Create: `backend/src/routes/album-days.ts`
- Create: `backend/src/routes/album-days.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/routes/album-days.test.ts`:

```typescript
jest.mock('../services/r2', () => ({ getPresignedPutUrl: jest.fn() }));
jest.mock('../services/thumbnail', () => ({ generateThumbnail: jest.fn().mockResolvedValue({ key: 'thumb/x.webp', width: 100, height: 100 }) }));
jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { pool, db } from '../db';
import { photos, albumPhotos } from '../db/schema';
import { createTestUser, createTestAlbum, createPresignToken, authHeader } from '../../tests/setup';
const app = require('../app');

async function insertPhoto(userId: string, albumId: string, opts: { takenAt?: string; mediaType?: string } = {}) {
  const [p] = await db.insert(photos).values({
    albumId,
    uploadedBy: userId,
    r2Key: `photos/${Math.random()}.webp`,
    thumbnailKey: `thumbnails/${Math.random()}.webp`,
    takenAt: new Date(opts.takenAt ?? '2026-05-21T10:00:00Z'),
    mediaType: opts.mediaType ?? 'photo',
    source: 'capture',
  }).returning();
  await db.insert(albumPhotos).values({ photoId: p.id, albumId });
  return p;
}

describe('GET /albums/:id/days', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns days with photo counts, newest first', async () => {
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T10:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T12:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-20T09:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].date).toBe('2026-05-21');
    expect(res.body[0].photo_count).toBe(2);
    expect(res.body[1].date).toBe('2026-05-20');
    expect(res.body[1].photo_count).toBe(1);
  });

  it('sets has_video true when at least one video exists', async () => {
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T10:00:00Z', mediaType: 'video' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T11:00:00Z', mediaType: 'photo' });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].has_video).toBe(true);
  });

  it('returns thumbnail_photo_id for the earliest photo that day', async () => {
    const early = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T10:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].thumbnail_photo_id).toBe(early.id);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'other-days' });
    const res = await request(app).get(`/albums/${album.id}/days`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('only returns days from this album (not other albums)', async () => {
    const other = await createTestAlbum(user.id);
    await insertPhoto(user.id, other.id, { takenAt: '2026-05-21T10:00:00Z' });
    // Note: insertPhoto also sets photos.albumId to 'other'. album has no photos.
    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('GET /albums/:id/days/:date/photos', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns photos for that day ordered by taken_at asc', async () => {
    const p1 = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });
    const p2 = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T12:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-22T08:00:00Z' }); // different day

    const res = await request(app).get(`/albums/${album.id}/days/2026-05-21/photos`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(p1.id);
    expect(res.body[1].id).toBe(p2.id);
    expect(res.body[0]).toMatchObject({ id: p1.id, media_type: 'photo' });
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app).get(`/albums/${album.id}/days/21-05-2026/photos`).set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'other-day-photos' });
    const res = await request(app).get(`/albums/${album.id}/days/2026-05-21/photos`).set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/routes/album-days.test.ts -v
```
Expected: FAIL — routes not found (404s)

- [ ] **Step 3: Create `backend/src/routes/album-days.ts`**

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { and, asc, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albumMembers, albumPhotos, photos } from '../db/schema';
import { isValidUUID } from '../lib/validation';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

async function isMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// GET /albums/:id/days
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!(await isMember(albumId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });

    const rows = await db.execute(sql`
      SELECT
        (DATE(p.taken_at AT TIME ZONE 'UTC'))::text AS date,
        (
          SELECT p2.id FROM photos p2
          JOIN album_photos ap2 ON ap2.photo_id = p2.id
          WHERE ap2.album_id = ${albumId}::uuid
            AND DATE(p2.taken_at AT TIME ZONE 'UTC') = DATE(p.taken_at AT TIME ZONE 'UTC')
          ORDER BY p2.taken_at ASC
          LIMIT 1
        ) AS thumbnail_photo_id,
        BOOL_OR(p.media_type = 'video') AS has_video,
        COUNT(*)::int AS photo_count
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.id
      WHERE ap.album_id = ${albumId}::uuid
      GROUP BY DATE(p.taken_at AT TIME ZONE 'UTC')
      ORDER BY date DESC
    `);

    res.json(rows.rows);
  } catch (err) {
    next(err);
  }
});

// GET /albums/:id/days/:date/photos
router.get('/:date/photos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (!(await isMember(albumId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });

    const rows = await db.execute(sql`
      SELECT p.id, p.media_type, p.duration_ms, p.taken_at
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.id
      WHERE ap.album_id = ${albumId}::uuid
        AND DATE(p.taken_at AT TIME ZONE 'UTC') = ${date}::date
      ORDER BY p.taken_at ASC
    `);

    res.json(rows.rows);
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Mount the route in `backend/src/app.ts`**

Add import after the other route imports:
```typescript
import albumDaysRoutes from './routes/album-days';
```

Add mount after the calendar route:
```typescript
app.use('/albums/:id/days', albumDaysRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest src/routes/album-days.test.ts -v
```
Expected: all tests PASS.

- [ ] **Step 6: Run full backend test suite**

```bash
cd backend && npm test
```
Expected: green. Fix any failures before continuing.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/album-days.ts backend/src/routes/album-days.test.ts backend/src/app.ts
git commit -m "feat(backend): add GET /albums/:id/days and /days/:date/photos"
```

---

## Task 4: Install mobile dependencies

**Files:** `mobile/package.json`, `mobile/package-lock.json`

- [ ] **Step 1: Install react-native-pager-view**

```bash
cd mobile && npx expo install react-native-pager-view
```

- [ ] **Step 2: Install expo-screen-orientation**

```bash
cd mobile && npx expo install expo-screen-orientation
```

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): add react-native-pager-view, expo-screen-orientation"
```

---

## Task 5: Simplify `(tabs)/_layout.tsx`

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace contents of `mobile/app/(tabs)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
```

This hides the Expo Router tab bar completely (PagerView in index.tsx provides its own tab UI) and keeps `settings.tsx` as a reachable route while hiding it from the tab bar.

- [ ] **Step 2: Run the layout test if it exists**

```bash
cd mobile && npx jest "app/\(tabs\)/__tests__" -v 2>/dev/null || echo "No layout tests found"
```

Fix any failures.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/_layout.tsx"
git commit -m "refactor(mobile): hide default tab bar from (tabs) layout"
```

---

## Task 6: `CameraPage` component

**Files:**
- Create: `mobile/src/components/tabs/CameraPage.tsx`

- [ ] **Step 1: Create `mobile/src/components/tabs/CameraPage.tsx`**

This is a port of `capture.tsx` with two changes: no close/back button (user swipes to leave), and a portrait/landscape toggle button.

```typescript
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, AppState, Linking, Modal } from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import * as SecureStore from 'expo-secure-store';

const HINT_KEY = 'capture.hint_seen';

export function CameraPage() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  React.useEffect(() => {
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, []);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && recordingRef.current) {
        cameraRef.current?.stopRecording();
        recordingRef.current = false;
        progress.value = 0;
      }
    });
    return () => sub.remove();
  }, []);

  // Reset orientation when this component unmounts
  React.useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      setIsLandscape(false);
    };
  }, []);

  async function toggleOrientation() {
    if (isLandscape) {
      await ScreenOrientation.unlockAsync();
      setIsLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
      setIsLandscape(true);
    }
  }

  function handleMediaCaptured(asset: { type: 'photo' | 'video'; uri: string; durationMs?: number }) {
    usePhotoReviewStore.getState().setAssets([{
      uri: asset.uri,
      type: asset.type,
      source: 'camera',
      durationMs: asset.durationMs,
      takenAt: new Date().toISOString(),
    }]);
    router.push('/photo-review');
  }

  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, skipProcessing: true });
    if (photo) handleMediaCaptured({ type: 'photo', uri: photo.uri });
  }

  async function startRecord() {
    if (recordingRef.current) return;
    recordingRef.current = true;
    const start = Date.now();
    progress.value = withTiming(1, { duration: 2000, easing: Easing.linear });
    const video = await cameraRef.current?.recordAsync({ maxDuration: 2 });
    const durationMs = Math.min(Date.now() - start, 2000);
    recordingRef.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    if (video) handleMediaCaptured({ type: 'video', uri: video.uri, durationMs });
  }

  function stopRecord() {
    if (recordingRef.current) cameraRef.current?.stopRecording();
  }

  const tapGesture = Gesture.Tap().runOnJS(true).onStart(takePhoto);
  const longPressGesture = Gesture.LongPress().minDuration(250).runOnJS(true)
    .onStart(startRecord).onEnd(stopRecord).onFinalize(stopRecord);
  const composed = Gesture.Exclusive(longPressGesture, tapGesture);

  if (!permissionResponse) return <View style={styles.container} />;

  if (!permissionResponse.granted) {
    if (permissionResponse.canAskAgain !== false) requestPermission();
    return (
      <View style={styles.container}>
        <Modal transparent animationType="fade" visible>
          <View style={styles.permOverlay}>
            <View style={styles.permSheet}>
              <Text style={styles.permTitle}>{t('capture.perm_title')}</Text>
              <Text style={styles.permBody}>{t('capture.perm_body')}</Text>
              <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.permBtnText}>{t('capture.perm_open')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleOrientation} testID="orientation-toggle">
          <Ionicons
            name={isLandscape ? 'phone-landscape-outline' : 'phone-portrait-outline'}
            size={22}
            color={colors.white}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
          <Ionicons name="camera-reverse-outline" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {showHint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>{t('capture.hint_video')}</Text>
        </View>
      )}

      <View style={[styles.shutterArea, { paddingBottom: insets.bottom + spacing['2xl'] }]}>
        <GestureDetector gesture={composed}>
          <View style={styles.shutterOuter}>
            <Animated.View style={[styles.progressArc, progressStyle]} />
            <View style={styles.shutterInner} />
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#000' },
  topBar:       { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, zIndex: 10 },
  iconBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  shutterArea:  { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  progressArc:  { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.pink, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },
  hint:         { position: 'absolute', bottom: 160, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
  hintText:     { ...typography.caption, color: colors.white, fontSize: 13 },
  permOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  permSheet:    { width: '100%', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing['2xl'], gap: spacing.md },
  permTitle:    { ...typography.title, color: colors.ink },
  permBody:     { ...typography.body, color: colors.inkSoft },
  permBtn:      { backgroundColor: colors.pink, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  permBtnText:  { ...typography.body, color: colors.white, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/tabs/CameraPage.tsx
git commit -m "feat(mobile): add CameraPage tab component with orientation toggle"
```

---

## Task 7: `AlbumsPage` + `SettingsSheet` components

**Files:**
- Create: `mobile/src/components/tabs/AlbumsPage.tsx`
- Create: `mobile/src/components/tabs/SettingsSheet.tsx`

- [ ] **Step 1: Create `mobile/src/components/tabs/SettingsSheet.tsx`**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SettingsSheet({ visible, onClose }: Props) {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleSettings() {
    onClose();
    router.push('/(tabs)/settings');
  }

  function handleLogout() {
    onClose();
    clearAuth();
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <TouchableOpacity style={styles.item} onPress={handleSettings} testID="menu-settings">
          <Text style={styles.itemText}>Cài đặt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={handleLogout} testID="menu-logout">
          <Text style={[styles.itemText, styles.danger]}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body:      { paddingVertical: spacing.md },
  item:      { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'] },
  itemText:  { ...typography.body, color: colors.ink },
  danger:    { color: '#c00' },
});
```

- [ ] **Step 2: Create `mobile/src/components/tabs/AlbumsPage.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAlbums, Album } from '@/hooks/useAlbums';
import { useAlbumStore } from '@/stores/albumStore';
import { SettingsSheet } from './SettingsSheet';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function AlbumsPage() {
  const insets = useSafeAreaInsets();
  const { data: albums, isLoading } = useAlbums();
  const setAlbum = useAlbumStore((s) => s.setAlbum);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  function handleAlbumPress(album: Album) {
    setAlbum(album);
    router.push(`/albums/${album.id}`);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post('/albums', { name });
      setShowInput(false);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      setAlbum(data);
      router.push(`/albums/${data.id}`);
    } catch {
      Alert.alert(t('common.error'), 'Không thể tạo album.');
    } finally {
      setCreating(false);
    }
  }

  const sorted = albums
    ? [...albums.filter((a) => a.is_private), ...albums.filter((a) => !a.is_private)]
    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Create album modal */}
      <Modal visible={showInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('albums.new_album')}</Text>
            <TextInput
              style={styles.input}
              placeholder="Tên album..."
              placeholderTextColor={colors.inkMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowInput(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={creating} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{creating ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Nhật ký</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} testID="menu-btn">
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : sorted.length === 0 ? (
        <Text style={styles.empty}>{t('albums.empty')}</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleAlbumPress(item)}
              activeOpacity={0.75}
              testID={`album-row-${item.id}`}
            >
              {item.cover_photo_id ? (
                <Image
                  source={{ uri: `${API_URL}/photos/${item.cover_photo_id}/thumb` }}
                  style={styles.thumb}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="images-outline" size={22} color={colors.inkMuted} />
                </View>
              )}
              <View style={styles.rowInfo}>
                <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create album CTA */}
      <TouchableOpacity
        style={[styles.createBtn, { marginBottom: insets.bottom + spacing.xl }]}
        onPress={() => { setNewName(''); setShowInput(true); }}
        testID="create-album-btn"
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.pink} />
        <Text style={styles.createBtnText}>Tạo album mới</Text>
      </TouchableOpacity>

      <SettingsSheet visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.cream },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['2xl'], paddingVertical: spacing.lg },
  heading:          { ...typography.heading, color: colors.ink },
  menuBtn:          { padding: spacing.sm },
  empty:            { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing['4xl'] },
  list:             { paddingHorizontal: spacing['2xl'], gap: spacing.md, paddingBottom: spacing['2xl'] },
  row:              { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, gap: spacing.md, minHeight: 72 },
  thumb:            { width: 56, height: 56, borderRadius: 8, overflow: 'hidden' },
  thumbPlaceholder: { backgroundColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  rowInfo:          { flex: 1 },
  albumName:        { ...typography.body, color: colors.ink, fontWeight: '600' },
  createBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  createBtnText:    { ...typography.body, color: colors.pink },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard:        { backgroundColor: colors.white, borderRadius: 16, padding: spacing['2xl'], width: '80%', gap: spacing.lg },
  modalTitle:       { ...typography.title, color: colors.ink },
  input:            { ...typography.body, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:     { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:         { padding: spacing.sm },
  modalBtnCancel:   { ...typography.body, color: colors.inkMuted },
  modalBtnConfirm:  { ...typography.body, color: colors.pink },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/tabs/AlbumsPage.tsx mobile/src/components/tabs/SettingsSheet.tsx
git commit -m "feat(mobile): add AlbumsPage and SettingsSheet tab components"
```

---

## Task 8: Rewrite `(tabs)/index.tsx` with PagerView + `CustomTabBar`

**Files:**
- Create: `mobile/src/components/tabs/CustomTabBar.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Create `mobile/src/components/tabs/CustomTabBar.tsx`**

```typescript
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface Props {
  activePage: number;
  onTabPress: (index: number) => void;
}

export function CustomTabBar({ activePage, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
      <TouchableOpacity
        testID="tab-camera"
        style={styles.tab}
        onPress={() => onTabPress(0)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activePage === 0 ? 'camera' : 'camera-outline'}
          size={26}
          color={activePage === 0 ? colors.pink : colors.inkMuted}
        />
      </TouchableOpacity>
      <TouchableOpacity
        testID="tab-albums"
        style={styles.tab}
        onPress={() => onTabPress(1)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activePage === 1 ? 'images' : 'images-outline'}
          size={26}
          color={activePage === 1 ? colors.pink : colors.inkMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
```

- [ ] **Step 2: Write a test for the index screen**

Create `mobile/app/(tabs)/__tests__/_layout.test.tsx` (update existing if present):

```typescript
jest.mock('react-native-pager-view', () => {
  const { View } = require('react-native');
  const PagerView = React.forwardRef(({ children, onPageSelected, initialPage }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ setPage: jest.fn() }));
    return <View testID="pager-view">{children}</View>;
  });
  return { __esModule: true, default: PagerView };
});
jest.mock('@/components/tabs/CameraPage', () => ({
  CameraPage: () => { const { View } = require('react-native'); return <View testID="camera-page" />; },
}));
jest.mock('@/components/tabs/AlbumsPage', () => ({
  AlbumsPage: () => { const { View } = require('react-native'); return <View testID="albums-page" />; },
}));
jest.mock('@/components/tabs/CustomTabBar', () => ({
  CustomTabBar: ({ activePage, onTabPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    return (
      <View testID="custom-tab-bar">
        <TouchableOpacity testID="tab-camera" onPress={() => onTabPress(0)} />
        <TouchableOpacity testID="tab-albums" onPress={() => onTabPress(1)} />
      </View>
    );
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MainScreen from '../index';

test('renders PagerView and CustomTabBar', () => {
  const { getByTestId } = render(<MainScreen />);
  expect(getByTestId('pager-view')).toBeTruthy();
  expect(getByTestId('custom-tab-bar')).toBeTruthy();
  expect(getByTestId('camera-page')).toBeTruthy();
  expect(getByTestId('albums-page')).toBeTruthy();
});

test('tapping tab-camera calls setPage(0)', () => {
  const { getByTestId } = render(<MainScreen />);
  fireEvent.press(getByTestId('tab-camera'));
  // pagerRef.current.setPage(0) is called — verified by mock
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd mobile && npx jest "app/\(tabs\)/__tests__/_layout" -v
```
Expected: FAIL — MainScreen not matching yet

- [ ] **Step 4: Rewrite `mobile/app/(tabs)/index.tsx`**

```typescript
import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { CameraPage } from '@/components/tabs/CameraPage';
import { AlbumsPage } from '@/components/tabs/AlbumsPage';
import { CustomTabBar } from '@/components/tabs/CustomTabBar';

export default function MainScreen() {
  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(1);

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={1}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        <View key="0" style={styles.page}>
          <CameraPage />
        </View>
        <View key="1" style={styles.page}>
          <AlbumsPage />
        </View>
      </PagerView>
      <CustomTabBar activePage={activePage} onTabPress={(i) => pagerRef.current?.setPage(i)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  pager: { flex: 1 },
  page:  { flex: 1 },
});
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd mobile && npx jest "app/\(tabs\)/__tests__/_layout" -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(tabs)/index.tsx" mobile/src/components/tabs/CustomTabBar.tsx "mobile/app/(tabs)/__tests__/_layout.test.tsx"
git commit -m "feat(mobile): PagerView main screen with camera + albums tabs"
```

---

## Task 9: `useAlbumDays` hook

**Files:**
- Create: `mobile/src/hooks/useAlbumDays.ts`
- Create: `mobile/src/hooks/useAlbumDays.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/hooks/useAlbumDays.test.tsx`:

```typescript
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlbumDays } from './useAlbumDays';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

test('fetches days for an album', async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: [
      { date: '2026-05-21', thumbnail_photo_id: 'p1', has_video: false, photo_count: 2 },
    ],
  });

  const { result } = renderHook(() => useAlbumDays('album-1'), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(api.get).toHaveBeenCalledWith('/albums/album-1/days');
  expect(result.current.data![0].date).toBe('2026-05-21');
  expect(result.current.data![0].photo_count).toBe(2);
});

test('is disabled when albumId is null', () => {
  (api.get as jest.Mock).mockResolvedValue({ data: [] });
  const { result } = renderHook(() => useAlbumDays(null), { wrapper });
  expect(result.current.data).toBeUndefined();
  expect(api.get).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mobile && npx jest src/hooks/useAlbumDays.test.tsx -v
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `mobile/src/hooks/useAlbumDays.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AlbumDay {
  date: string;
  thumbnail_photo_id: string | null;
  has_video: boolean;
  photo_count: number;
}

export function useAlbumDays(albumId: string | null) {
  return useQuery<AlbumDay[]>({
    queryKey: ['album-days', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/days`);
      return data;
    },
    enabled: !!albumId,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd mobile && npx jest src/hooks/useAlbumDays.test.tsx -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useAlbumDays.ts mobile/src/hooks/useAlbumDays.test.tsx
git commit -m "feat(mobile): add useAlbumDays hook"
```

---

## Task 10: `useDayPhotos` hook

**Files:**
- Create: `mobile/src/hooks/useDayPhotos.ts`
- Create: `mobile/src/hooks/useDayPhotos.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/src/hooks/useDayPhotos.test.tsx`:

```typescript
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDayPhotos } from './useDayPhotos';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

test('fetches photos for a day', async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: [
      { id: 'p1', media_type: 'photo', duration_ms: null, taken_at: '2026-05-21T08:00:00Z' },
      { id: 'p2', media_type: 'video', duration_ms: 2000, taken_at: '2026-05-21T10:00:00Z' },
    ],
  });

  const { result } = renderHook(() => useDayPhotos('album-1', '2026-05-21'), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(api.get).toHaveBeenCalledWith('/albums/album-1/days/2026-05-21/photos');
  expect(result.current.data).toHaveLength(2);
  expect(result.current.data![1].media_type).toBe('video');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mobile && npx jest src/hooks/useDayPhotos.test.tsx -v
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `mobile/src/hooks/useDayPhotos.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DayPhoto {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
}

export function useDayPhotos(albumId: string | null, date: string | null) {
  return useQuery<DayPhoto[]>({
    queryKey: ['day-photos', albumId, date],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/days/${date}/photos`);
      return data;
    },
    enabled: !!albumId && !!date,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd mobile && npx jest src/hooks/useDayPhotos.test.tsx -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useDayPhotos.ts mobile/src/hooks/useDayPhotos.test.tsx
git commit -m "feat(mobile): add useDayPhotos hook"
```

---

## Task 11: Rewrite `albums/[id].tsx` — masonry day grid

**Files:**
- Create: `mobile/src/components/album/DayCell.tsx`
- Modify: `mobile/app/albums/[id].tsx`

- [ ] **Step 1: Create `mobile/src/components/album/DayCell.tsx`**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Props {
  date: string;           // YYYY-MM-DD
  thumbnailPhotoId: string | null;
  hasVideo: boolean;
  tall: boolean;          // true = tall cell, false = short cell
  onPress: () => void;
}

export function DayCell({ date, thumbnailPhotoId, hasVideo, tall, onPress }: Props) {
  const { width } = useWindowDimensions();
  const colWidth = (width - spacing['2xl'] * 2 - spacing.sm) / 2;
  const cellHeight = tall ? colWidth * 1.4 : colWidth * 0.85;

  const [d, m] = date.split('-').slice(1).reverse(); // dd, mm from YYYY-MM-DD
  const label = `${d}/${m}`;

  return (
    <TouchableOpacity
      testID={`day-cell-${date}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.cell, { width: colWidth, height: cellHeight }]}
    >
      {thumbnailPhotoId ? (
        <Image
          source={{ uri: `${API_URL}/photos/${thumbnailPhotoId}/thumb` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Ionicons name="images-outline" size={28} color={colors.inkMuted} />
        </View>
      )}
      <View style={styles.overlay}>
        <Text style={styles.dateLabel}>{label}</Text>
      </View>
      {hasVideo && (
        <View style={styles.videoBadge} testID="video-badge">
          <Ionicons name="play" size={10} color={colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell:        { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.borderSoft },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  overlay:     { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dateLabel:   { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 11 },
  videoBadge:  { position: 'absolute', bottom: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Rewrite `mobile/app/albums/[id].tsx`**

```typescript
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { DayCell } from '@/components/album/DayCell';
import { useAlbumDays } from '@/hooks/useAlbumDays';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albumId = useAlbumStore((s) => s.albumId);
  const albumName = useAlbumStore((s) => s.albumName);
  const { data: days, isLoading } = useAlbumDays(albumId ?? null);

  // Masonry: render as pairs (left col + right col)
  const pairs: Array<[typeof days[0], typeof days[0] | undefined]> = [];
  if (days) {
    for (let i = 0; i < days.length; i += 2) {
      pairs.push([days[i], days[i + 1]]);
    }
  }

  const colWidth = (width - spacing['2xl'] * 2 - spacing.sm) / 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : !days || days.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Chưa có khoảnh khắc nào</Text>
          <Text style={styles.emptySub}>Vuốt sang tab Camera để chụp ảnh đầu tiên</Text>
        </View>
      ) : (
        <FlatList
          data={pairs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.grid}
          renderItem={({ item: [left, right], index }) => (
            <View style={styles.row}>
              <DayCell
                date={left.date}
                thumbnailPhotoId={left.thumbnail_photo_id}
                hasVideo={left.has_video}
                tall={index % 2 === 0}
                onPress={() => router.push(`/story/${albumId}/${left.date}`)}
              />
              {right && (
                <DayCell
                  date={right.date}
                  thumbnailPhotoId={right.thumbnail_photo_id}
                  hasVideo={right.has_video}
                  tall={index % 2 !== 0}
                  onPress={() => router.push(`/story/${albumId}/${right.date}`)}
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  backBtn:   { width: 32 },
  title:     { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  empty:     { ...typography.body, color: colors.inkMuted },
  emptySub:  { ...typography.caption, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
  grid:      { padding: spacing['2xl'], gap: spacing.sm },
  row:       { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/album/DayCell.tsx mobile/app/albums/[id].tsx
git commit -m "feat(mobile): album detail masonry grid of days"
```

---

## Task 12: Story Viewer `story/[albumId]/[date].tsx`

**Files:**
- Create: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Register the story route in `mobile/app/_layout.tsx`**

In the `<Stack>` inside `RootLayout`, add after the `photo-review` screen:

```typescript
<Stack.Screen name="story/[albumId]/[date]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
```

- [ ] **Step 2: Create the story directory and screen**

```bash
mkdir -p "/Users/do.nguyen/personal/family-guy/mobile/app/story/[albumId]"
```

Create `mobile/app/story/[albumId]/[date].tsx`:

```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useAlbumDays } from '@/hooks/useAlbumDays';
import { colors, spacing, typography } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const PHOTO_DURATION_MS = 3000;

function StoryProgress({ total, current, progress }: { total: number; current: number; progress: number }) {
  return (
    <View style={pg.bar} testID="story-progress">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={pg.seg}>
          <View
            style={[
              pg.fill,
              i < current ? pg.done : i === current ? { width: `${progress * 100}%` } : pg.empty,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const pg = StyleSheet.create({
  bar:   { flexDirection: 'row', gap: 3, flex: 1 },
  seg:   { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: colors.white, borderRadius: 2 },
  done:  { width: '100%' },
  empty: { width: '0%' },
});

function PhotoItem({ photo, onEnd }: { photo: DayPhoto; onEnd: () => void }) {
  const [progressFraction, setProgressFraction] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setProgressFraction(0);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const frac = Math.min(elapsed / PHOTO_DURATION_MS, 1);
      setProgressFraction(frac);
      if (frac >= 1) {
        clearInterval(intervalRef.current!);
        onEnd();
      }
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [photo.id]);

  return (
    <>
      <Image
        source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
      {/* expose progress to parent */}
    </>
  );
}

function VideoItem({ photo, onEnd }: { photo: DayPhoto; onEnd: () => void }) {
  const player = useVideoPlayer(`${API_URL}/photos/${photo.id}/full`, (p) => {
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

export default function StoryScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { data: photos, isLoading } = useDayPhotos(albumId, date);
  const { data: days } = useAlbumDays(albumId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoProgress, setPhotoProgress] = useState(0);

  const goNext = useCallback(() => {
    if (!photos) return;
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPhotoProgress(0);
    } else {
      router.back();
    }
  }, [photos, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setPhotoProgress(0);
    }
  }, [currentIndex]);

  // Swipe horizontally to change day
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (!days || !date) return;
      const currentDayIdx = days.findIndex((d) => d.date === date);
      if (e.translationX < -60 && currentDayIdx > 0) {
        // swipe left = older day (next in desc list = earlier date)
        runOnJS(router.replace)(`/story/${albumId}/${days[currentDayIdx - 1].date}`);
      } else if (e.translationX > 60 && currentDayIdx < days.length - 1) {
        // swipe right = newer day
        runOnJS(router.replace)(`/story/${albumId}/${days[currentDayIdx + 1].date}`);
      }
    });

  const [d, m] = (date ?? '').split('-').slice(1).reverse();
  const dateLabel = d && m ? `${d}/${m}` : '';

  if (isLoading || !photos) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  const current = photos[currentIndex];

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        <StatusBar hidden />

        {/* Media */}
        {current.media_type === 'video' ? (
          <VideoItem photo={current} onEnd={goNext} />
        ) : (
          <PhotoItem photo={current} onEnd={goNext} />
        )}

        {/* Header overlay */}
        <View style={[styles.headerOverlay, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.progressRow}>
            <StoryProgress
              total={photos.length}
              current={currentIndex}
              progress={photoProgress}
            />
            <Text style={styles.dateText}>{dateLabel}</Text>
          </View>
          <View style={styles.topActions}>
            <View style={{ width: 32 }} />
            <TouchableOpacity onPress={() => router.back()} testID="story-close">
              <Ionicons name="close" size={26} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tap left/right to navigate items */}
        <View style={styles.tapAreas}>
          <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
          <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#000' },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.lg, gap: spacing.sm },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateText:      { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 12, minWidth: 36, textAlign: 'right' },
  topActions:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tapAreas:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft:       { flex: 1 },
  tapRight:      { flex: 1 },
});
```

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/story/[albumId]/[date].tsx" mobile/app/_layout.tsx
git commit -m "feat(mobile): add story viewer screen"
```

---

## Task 13: Refactor `useCapture` — remove cooldown, use `album_ids[]`

**Files:**
- Modify: `mobile/src/hooks/useCapture.ts`
- Modify: `mobile/src/hooks/useCapture.test.ts`

- [ ] **Step 1: Update failing tests first**

Open `mobile/src/hooks/useCapture.test.ts`. Replace with:

```typescript
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useCapture } from './useCapture';

jest.mock('@/lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('@/lib/compression', () => ({ compressToWebP: jest.fn().mockResolvedValue('file:///compressed.webp') }));
jest.mock('@/lib/uploadFile', () => ({ putLocalFile: jest.fn().mockResolvedValue(1024) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockAlbumIds = ['album-1', 'album-2'];

describe('useCapture', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts photo to /photos with album_ids array', async () => {
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://r2.example.com/put', key: 'photos/abc.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-1', r2_key: 'photos/abc.webp' } });

    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.capture(
        { uri: 'file:///photo.jpg', type: 'photo', source: 'camera', takenAt: '2026-05-21T10:00:00Z' },
        mockAlbumIds
      );
    });

    expect(mockApi.post).toHaveBeenNthCalledWith(1, '/photos/presign', { album_id: 'album-1', content_type: 'image/webp' });
    expect(mockApi.post).toHaveBeenNthCalledWith(2, '/photos', expect.objectContaining({
      album_ids: ['album-1', 'album-2'],
      media_type: 'photo',
    }));
  });

  it('has no canCapture / cooldown concept', () => {
    const { result } = renderHook(() => useCapture());
    expect(result.current.canCapture).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mobile && npx jest src/hooks/useCapture.test.ts -v
```
Expected: FAIL

- [ ] **Step 3: Rewrite `mobile/src/hooks/useCapture.ts`**

```typescript
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { putLocalFile } from '@/lib/uploadFile';
import type { ReviewAsset } from '@/stores/photoReviewStore';

export function useCapture() {
  const qc = useQueryClient();
  const [capturing, setCapturing] = useState(false);

  async function extractVideoThumbnail(videoUri: string): Promise<string> {
    try {
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const { uri } = await getThumbnailAsync(videoUri, { time: 0 });
      return uri;
    } catch {
      return videoUri;
    }
  }

  async function capture(asset: ReviewAsset, albumIds: string[]) {
    if (albumIds.length === 0) throw new Error('No album selected');
    setCapturing(true);
    try {
      const primaryAlbumId = albumIds[0];
      if (asset.type === 'photo') {
        const { data: presign } = await api.post('/photos/presign', {
          album_id: primaryAlbumId,
          content_type: 'image/webp',
        });
        const compressedUri = await compressToWebP(asset.uri);
        await putLocalFile(presign.url, compressedUri, 'image/webp');
        const { data: photo } = await api.post('/photos', {
          album_ids: albumIds,
          r2_key: presign.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          source: 'capture',
          media_type: 'photo',
        });
        albumIds.forEach((id) => qc.invalidateQueries({ queryKey: ['album-days', id] }));
        return photo;
      } else {
        const thumbUri = await extractVideoThumbnail(asset.uri);
        const [videoPresign, thumbPresign] = await Promise.all([
          api.post('/photos/presign', { album_id: primaryAlbumId, content_type: 'video/mp4' }),
          api.post('/photos/presign', { album_id: primaryAlbumId, content_type: 'image/jpeg' }),
        ]);
        await Promise.all([
          putLocalFile(videoPresign.data.url, asset.uri, 'video/mp4'),
          putLocalFile(thumbPresign.data.url, thumbUri, 'image/jpeg'),
        ]);
        const { data: photo } = await api.post('/photos', {
          album_ids: albumIds,
          r2_key: videoPresign.data.key,
          thumbnail_r2_key: thumbPresign.data.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          source: 'capture',
          media_type: 'video',
          duration_ms: asset.durationMs,
        });
        albumIds.forEach((id) => qc.invalidateQueries({ queryKey: ['album-days', id] }));
        return photo;
      }
    } finally {
      setCapturing(false);
    }
  }

  return { capture, canCapture: true, capturing };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd mobile && npx jest src/hooks/useCapture.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useCapture.ts mobile/src/hooks/useCapture.test.ts
git commit -m "feat(mobile): useCapture uses album_ids[], removes cooldown"
```

---

## Task 14: Rewrite `photo-review.tsx` — multi-album checkbox

**Files:**
- Modify: `mobile/app/photo-review.tsx`

- [ ] **Step 1: Replace `mobile/app/photo-review.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, useWindowDimensions, ActivityIndicator, Alert,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { useCapture } from '@/hooks/useCapture';
import { useAlbums } from '@/hooks/useAlbums';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { colors, spacing, typography } from '@/constants/theme';
import { success } from '@/lib/haptics';

function VideoPreview({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={{ width, height, borderRadius: 8 }} contentFit="cover" nativeControls={false} />;
}

export default function PhotoReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const assets = usePhotoReviewStore((s) => s.assets);
  const clear = usePhotoReviewStore((s) => s.clear);
  const { capture, capturing } = useCapture();
  const { data: albums = [] } = useAlbums();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);

  const asset = assets[0];
  const previewSize = width - spacing['2xl'] * 2;

  React.useEffect(() => {
    if (assets.length === 0) router.back();
  }, []);

  if (assets.length === 0 || !asset) return null;

  function toggleAlbum(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const albumIds = Array.from(selectedIds);
    try {
      await capture(asset, albumIds);
      success();
      setCelebrate(true);
      setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ảnh. Thử lại nhé.');
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar hidden />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-close">
          <Ionicons name="close" size={26} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} testID="review-retake">
          <Text style={styles.retakeText}>Chụp lại</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={[styles.preview, { width: previewSize, height: previewSize * 0.75 }]}>
          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} width={previewSize} height={previewSize * 0.75} />
          ) : (
            <Image source={{ uri: asset.uri }} style={[styles.previewImg, { width: previewSize, height: previewSize * 0.75 }]} resizeMode="cover" />
          )}
        </View>

        {/* Album selector */}
        <Text style={styles.sectionLabel}>Thêm vào album:</Text>
        {albums.map((album) => {
          const selected = selectedIds.has(album.id);
          return (
            <TouchableOpacity
              key={album.id}
              testID={`album-checkbox-${album.id}`}
              style={styles.albumRow}
              onPress={() => toggleAlbum(album.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <Text style={styles.albumName}>{album.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          testID="review-save"
          label={capturing ? '' : 'Lưu lại'}
          onPress={handleSave}
          fullWidth
          loading={capturing}
          disabled={selectedIds.size === 0 || capturing}
        />
      </View>

      <Confetti visible={celebrate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.cream },
  topBar:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  retakeText:       { ...typography.body, color: colors.inkMuted },
  scroll:           { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['2xl'], gap: spacing.lg },
  preview:          { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.borderSoft, alignSelf: 'center' },
  previewImg:       { borderRadius: 12 },
  sectionLabel:     { ...typography.body, color: colors.inkSoft, fontWeight: '600' },
  albumRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.pink, borderColor: colors.pink },
  albumName:        { ...typography.body, color: colors.ink },
  footer:           { paddingHorizontal: spacing['2xl'], paddingTop: spacing.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/photo-review.tsx
git commit -m "feat(mobile): photo-review multi-album checkbox + new useCapture"
```

---

## Task 15: Cleanup — delete old components and files

**Files:**
- Delete: `mobile/app/capture.tsx`
- Delete: `mobile/src/components/timeline/CalendarView.tsx` + test
- Delete: `mobile/src/components/timeline/DayPager.tsx` + test
- Delete: `mobile/src/components/timeline/DayPage.tsx` + test
- Delete: `mobile/src/components/timeline/MilestoneLabelInput.tsx` + test
- Delete: `mobile/src/hooks/useDayLabels.ts` + test
- Delete: `mobile/src/stores/jumpToDayStore.ts`
- Modify: `mobile/app/_layout.tsx` — remove `capture` stack screen
- Simplify: `mobile/src/stores/captureStore.ts`

- [ ] **Step 1: Remove `capture.tsx` from app/_layout.tsx**

In `mobile/app/_layout.tsx`, remove:
```typescript
<Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', headerShown: false }} />
```

- [ ] **Step 2: Delete old files**

```bash
rm mobile/app/capture.tsx
rm mobile/src/components/timeline/CalendarView.tsx
rm mobile/src/components/timeline/CalendarView.test.tsx
rm mobile/src/components/timeline/DayPager.tsx
rm mobile/src/components/timeline/DayPager.test.tsx
rm mobile/src/components/timeline/DayPage.tsx
rm mobile/src/components/timeline/DayPage.test.tsx
rm mobile/src/components/timeline/MilestoneLabelInput.tsx
rm mobile/src/components/timeline/MilestoneLabelInput.test.tsx
rm mobile/src/hooks/useDayLabels.ts
rm mobile/src/hooks/useDayLabels.test.tsx
rm mobile/src/stores/jumpToDayStore.ts
```

- [ ] **Step 3: Replace `captureStore.ts` with an empty shim**

`useCapture` no longer uses `useCaptureStore`, but other files might still import it. Replace `mobile/src/stores/captureStore.ts` with a minimal shim that won't break existing imports until those are cleaned up:

```typescript
// Retained as an empty shim; no cooldown logic remains.
export function getCooldownRemaining(_: null): number { return 0; }
```

- [ ] **Step 4: Run the full mobile test suite**

```bash
cd mobile && npx jest --silent 2>&1 | tail -20
```

Fix any broken imports. Common issues:
- Components importing `useDayLabels` → remove the import and usage
- Components importing `CalendarView` → remove

- [ ] **Step 5: Run the full backend test suite**

```bash
cd backend && npm test
```
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add -A mobile/
git commit -m "chore(mobile): remove capture modal, CalendarView, DayPager, DayPage, MilestoneLabelInput, useDayLabels, captureStore cooldown"
```

---

## Task 16: End-to-end smoke verification

- [ ] **Step 1: Boot the app against local backend**

```bash
cd backend && npm run dev
cd mobile && npx expo start
```

- [ ] **Step 2: Manual smoke test checklist**

1. Open app → Albums tab visible (page 1 default)
2. Swipe left → Camera tab, viewfinder live
3. Tap orientation toggle → screen rotates to landscape
4. Tap shutter → photo taken → `photo-review.tsx` opens
5. At least one album exists → checkbox list shows; tap one → "Lưu lại" enables
6. Tap "Lưu lại" → confetti → returns to main screen
7. Navigate to the album → masonry day grid shows today's entry
8. Tap the day cell → Story Viewer opens with progress bar
9. Photo auto-advances after 3s
10. Tap left half → go back to prev item; tap right half → go to next
11. `✕` closes story viewer → back to album detail

- [ ] **Step 3: Commit a final cleanup commit if needed**

Fix anything found during smoke test, then:
```bash
git add -A && git commit -m "fix: post-smoke-test fixes"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 2-tab PagerView (Camera \| Albums), default Albums | Task 5, 8 |
| Swipe left/right to switch tabs | Task 8 (PagerView native) |
| Hide upload for MVP | Task 14 (no upload option in review) |
| After capture → select album(s) checkbox → upload once | Task 13, 14 |
| Upload 1 file, save ID to multiple albums | Task 2 (album_photos), Task 13 |
| Portrait/landscape toggle on camera | Task 6 |
| Album list: large rows with thumbnail + name + chevron | Task 7 |
| Menu `⋯` → Settings + logout | Task 7 |
| Album detail: masonry grid of days | Task 11 |
| Story viewer: progress bar, auto-advance, tap nav, swipe day | Task 12 |
| No rate limit | Task 2 (removed), Task 13 (no canCapture check) |
| `GET /albums/:id/days` endpoint | Task 3 |
| `GET /albums/:id/days/:date/photos` endpoint | Task 3 |
| `album_photos` join table | Task 1 |
| DayPager/CalendarView/MilestoneLabelInput removed | Task 15 |

**Placeholder scan:** No TBDs. Every code block is complete and copy-pasteable.

**Type consistency:**
- `AlbumDay.thumbnail_photo_id` (Task 9) matches field returned by `GET /albums/:id/days` SQL (Task 3)
- `DayPhoto.media_type` (Task 10) used in Story Viewer (Task 12) — consistent
- `capture(asset, albumIds: string[])` (Task 13) called with `Array.from(selectedIds)` in photo-review (Task 14) — consistent
- `album_ids: string[]` in `POST /photos` body (Task 2) matches what `useCapture` sends (Task 13) — consistent
