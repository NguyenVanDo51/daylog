# Day Soundtrack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép gán 1 soundtrack (từ library bundled server-side) cho mỗi day của album. Story viewer phát soundtrack trong app; export MP4 có nhạc baked in.

**Architecture:** Source of truth là `backend/assets/soundtracks/*.mp3` + 2 bảng Postgres (`soundtracks` catalog, `day_soundtracks` per-day assignment). Backend stream mp3 qua endpoint riêng và mix vào ffmpeg pipeline đã có cho `/stories/export`. Mobile cache file vào `FileSystem.cacheDirectory` rồi play bằng `expo-audio` đồng bộ với existing story playback.

**Tech Stack:** Node 20 + Express + Drizzle ORM + Postgres + ffmpeg-static (backend). React Native 0.81 + Expo SDK 56 + expo-audio + react-query + jest (mobile).

**Spec:** `docs/superpowers/specs/2026-06-12-day-soundtrack-design.md`

---

## File Map

### Backend — create
- `backend/src/routes/soundtracks.ts` — router cho library + per-day soundtrack endpoints
- `backend/src/routes/soundtracks.test.ts` — tests cho router trên
- `backend/src/db/migrations/0002_add_soundtracks.sql` — auto-generated DDL + manual seed INSERT
- `backend/assets/soundtracks/lullaby_01.mp3` — placeholder mp3 (silent 30s, sẽ thay bằng track thực sau)

### Backend — modify
- `backend/src/db/schema.ts` — thêm `soundtracks` + `daySoundtracks` table definitions
- `backend/src/routes/stories.ts` — thêm support `soundtrack_id` query param trong `/export`
- `backend/src/routes/stories.test.ts` — thêm test cases cho export-with-soundtrack
- `backend/src/app.ts` — mount router mới
- `backend/tests/setup.ts` — thêm `day_soundtracks, soundtracks` vào TRUNCATE list

### Mobile — create
- `mobile/src/hooks/useSoundtracks.ts` + `.test.tsx` — list library
- `mobile/src/hooks/useDaySoundtrack.ts` + `.test.tsx` — fetch per-day track
- `mobile/src/hooks/useSetDaySoundtrack.ts` + `.test.tsx` — mutation
- `mobile/src/hooks/useSoundtrackCache.ts` + `.test.ts` — FS cache helper
- `mobile/src/components/story/SoundtrackPickerSheet.tsx` + `.test.tsx` — picker UI

### Mobile — modify
- `mobile/package.json` — add `expo-audio`
- `mobile/src/hooks/useStoryExport.ts` — accept `soundtrackId?` param, append to URL
- `mobile/app/story/[albumId]/[date].tsx` — load/play audio + open picker

---

## Phase A — Backend: Data Model & Migration

### Task 1: Add schema definitions

**Files:**
- Modify: `backend/src/db/schema.ts` (append after `dayLabels`)

- [ ] **Step 1: Add `soundtracks` table**

Append to `backend/src/db/schema.ts` (after `dayLabels` definition, around line 144):

```ts
export const soundtracks = pgTable('soundtracks', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  key: varchar('key', { length: 64 }).notNull().unique(),
  title: varchar('title', { length: 128 }).notNull(),
  artist: varchar('artist', { length: 128 }),
  durationMs: integer('duration_ms').notNull(),
  filePath: text('file_path').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 2: Add `day_soundtracks` table**

Append after the `soundtracks` definition:

```ts
export const daySoundtracks = pgTable(
  'day_soundtracks',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    soundtrackId: uuid('soundtrack_id')
      .notNull()
      .references(() => soundtracks.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqAlbumDate: uniqueIndex('day_soundtracks_album_date_uniq').on(t.albumId, t.date),
  })
);
```

- [ ] **Step 3: Type-check schema**

Run from `backend/`: `npx tsc --noEmit`

Expected: no errors (or only pre-existing ones unrelated to our addition).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat(db): add soundtracks + day_soundtracks schema"
```

---

### Task 2: Generate migration + add seed INSERTs

**Files:**
- Create: `backend/src/db/migrations/0002_add_soundtracks.sql` (auto-generated, then edited)
- Modify: `backend/src/db/migrations/meta/_journal.json` (auto-updated)

- [ ] **Step 1: Generate migration via drizzle-kit**

Run from `backend/`: `npm run migrate:generate`

Expected: creates `backend/src/db/migrations/0002_<name>.sql` and updates `_journal.json`. If drizzle picks a different filename, rename to `0002_add_soundtracks.sql` and update the journal entry's `tag` to match.

- [ ] **Step 2: Inspect generated SQL**

Open `backend/src/db/migrations/0002_add_soundtracks.sql`. It should contain `CREATE TABLE "soundtracks"` and `CREATE TABLE "day_soundtracks"` with the unique index. If drizzle output uses `--> statement-breakpoint` between statements (matches existing migrations), keep that.

- [ ] **Step 3: Append seed INSERT for placeholder track**

Add at the end of the migration file:

```sql
--> statement-breakpoint
INSERT INTO "soundtracks" ("key", "title", "artist", "duration_ms", "file_path", "sort_order", "is_active")
VALUES ('lullaby_01', 'Mây trắng (placeholder)', NULL, 30000, 'lullaby_01.mp3', 0, true);
```

(Placeholder row chỉ để bootstrap. Tracks thực sự sẽ được seed bằng follow-up migration khi nhạc commission xong.)

- [ ] **Step 4: Run migration against local dev DB**

Run from `backend/`: `npm run migrate:push`

Expected: applies migration. Verify with `psql $DATABASE_URL -c "SELECT key FROM soundtracks;"` → returns `lullaby_01`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/migrations/0002_add_soundtracks.sql backend/src/db/migrations/meta/_journal.json
git commit -m "feat(db): migration for soundtracks + day_soundtracks + placeholder seed"
```

---

### Task 3: Add tables to test TRUNCATE list

**Files:**
- Modify: `backend/tests/setup.ts:55-57`

- [ ] **Step 1: Update TRUNCATE statement**

In `backend/tests/setup.ts`, find:

```ts
await db.execute(sql`TRUNCATE presign_tokens, invites, day_labels, photos, album_members, albums, users CASCADE`);
```

Replace with:

```ts
await db.execute(sql`TRUNCATE day_soundtracks, soundtracks, presign_tokens, invites, day_labels, photos, album_members, albums, users CASCADE`);
```

Order matters: `day_soundtracks` references `soundtracks`, so list it first. `soundtracks` doesn't reference others, just sits there. (CASCADE handles FK deletions but TRUNCATE order still affects identity reset.)

- [ ] **Step 2: Run an existing test to verify TRUNCATE still works**

Run from `backend/`: `npm test -- day-labels`

Expected: existing tests pass. If they fail with "relation X does not exist", the migration probably wasn't applied — re-run `npm run migrate:push`.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/setup.ts
git commit -m "test(setup): truncate soundtracks tables between tests"
```

---

### Task 4: Add placeholder mp3 asset

**Files:**
- Create: `backend/assets/soundtracks/lullaby_01.mp3`

- [ ] **Step 1: Generate placeholder silent mp3**

Use ffmpeg (already in dev dependencies via `ffmpeg-static`) to create a 30-second silent mp3:

```bash
cd backend
mkdir -p assets/soundtracks
./node_modules/.bin/ffmpeg-static -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 30 -c:a libmp3lame -b:a 128k assets/soundtracks/lullaby_01.mp3
```

If `./node_modules/.bin/ffmpeg-static` doesn't exist as a CLI, use the path from the package:

```bash
node -e "console.log(require('ffmpeg-static'))" 
# then use that path as the ffmpeg binary
```

Expected: `assets/soundtracks/lullaby_01.mp3` exists, ~470KB.

- [ ] **Step 2: Verify playable**

`file backend/assets/soundtracks/lullaby_01.mp3` → should report `Audio file with ID3 ...` or `MPEG ADTS, layer III`.

- [ ] **Step 3: Commit**

```bash
git add backend/assets/soundtracks/lullaby_01.mp3
git commit -m "chore(assets): add placeholder lullaby_01 silent mp3"
```

---

## Phase B — Backend: Library Endpoints (TDD)

### Task 5: Test + implement `GET /soundtracks`

**Files:**
- Create: `backend/src/routes/soundtracks.test.ts`
- Create: `backend/src/routes/soundtracks.ts`
- Modify: `backend/src/app.ts` (mount router)

- [ ] **Step 1: Write failing test for list endpoint**

Create `backend/src/routes/soundtracks.test.ts`:

```ts
import request from 'supertest';
import { db } from '../db';
import { soundtracks } from '../db/schema';
import { createTestUser, authHeader } from '../../tests/setup';

const app = require('../app');

describe('GET /soundtracks', () => {
  it('returns active tracks sorted by sort_order', async () => {
    const user = await createTestUser();
    await db.insert(soundtracks).values([
      { key: 'b', title: 'B', durationMs: 10000, filePath: 'b.mp3', sortOrder: 2, isActive: true },
      { key: 'a', title: 'A', durationMs: 10000, filePath: 'a.mp3', sortOrder: 1, isActive: true },
      { key: 'inactive', title: 'I', durationMs: 10000, filePath: 'i.mp3', sortOrder: 0, isActive: false },
    ]);

    const res = await request(app).get('/soundtracks').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.map((s: any) => s.key)).toEqual(['a', 'b']);
    expect(res.body[0]).toMatchObject({ key: 'a', title: 'A', duration_ms: 10000 });
  });

  it('requires auth', async () => {
    const res = await request(app).get('/soundtracks');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test, see it fail**

Run from `backend/`: `npm test -- soundtracks`

Expected: FAIL with "Cannot find module './soundtracks'" or 404. (App doesn't have the route yet.)

- [ ] **Step 3: Implement router with GET /soundtracks**

Create `backend/src/routes/soundtracks.ts`:

```ts
import express, { Request, Response, NextFunction } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { soundtracks } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select({
        id: soundtracks.id,
        key: soundtracks.key,
        title: soundtracks.title,
        artist: soundtracks.artist,
        duration_ms: soundtracks.durationMs,
      })
      .from(soundtracks)
      .where(eq(soundtracks.isActive, true))
      .orderBy(asc(soundtracks.sortOrder), asc(soundtracks.title));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Mount router in app.ts**

In `backend/src/app.ts`, after line 19 (`import usersRoutes`):

```ts
import soundtracksRoutes from './routes/soundtracks';
```

After line 53 (`app.use('/waitlist', ...)`):

```ts
app.use('/soundtracks', soundtracksRoutes);
```

- [ ] **Step 5: Run test, see it pass**

Run: `npm test -- soundtracks`

Expected: PASS for both `it` blocks.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/soundtracks.ts backend/src/routes/soundtracks.test.ts backend/src/app.ts
git commit -m "feat(api): GET /soundtracks list endpoint"
```

---

### Task 6: Test + implement `GET /soundtracks/:key/file`

**Files:**
- Modify: `backend/src/routes/soundtracks.test.ts` (add new describe)
- Modify: `backend/src/routes/soundtracks.ts` (add new handler)

- [ ] **Step 1: Write failing tests for file streaming**

Append to `backend/src/routes/soundtracks.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('GET /soundtracks/:key/file', () => {
  beforeEach(async () => {
    await db.insert(soundtracks).values({
      key: 'lullaby_01',
      title: 'Test',
      durationMs: 30000,
      filePath: 'lullaby_01.mp3',
      isActive: true,
    });
  });

  it('streams the mp3 with correct headers', async () => {
    const user = await createTestUser();
    const realPath = path.join(__dirname, '../../assets/soundtracks/lullaby_01.mp3');
    if (!fs.existsSync(realPath)) {
      throw new Error('fixture lullaby_01.mp3 missing — run Task 4 first');
    }

    const res = await request(app).get('/soundtracks/lullaby_01/file').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown key', async () => {
    const user = await createTestUser();
    const res = await request(app).get('/soundtracks/nope/file').set(authHeader(user));
    expect(res.status).toBe(404);
  });

  it('returns 404 when key exists but file missing', async () => {
    await db.insert(soundtracks).values({
      key: 'ghost',
      title: 'Ghost',
      durationMs: 10000,
      filePath: 'does-not-exist.mp3',
      isActive: true,
    });
    const user = await createTestUser();
    const res = await request(app).get('/soundtracks/ghost/file').set(authHeader(user));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test -- soundtracks`

Expected: 3 new tests fail (route not implemented).

- [ ] **Step 3: Add file streaming handler**

Append to `backend/src/routes/soundtracks.ts` (before `export = router`):

```ts
import fs from 'fs';
import path from 'path';

router.get('/:key/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key;
    const [track] = await db.select().from(soundtracks).where(eq(soundtracks.key, key)).limit(1);
    if (!track) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(__dirname, '../../assets/soundtracks', track.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests, see them pass**

Run: `npm test -- soundtracks`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/soundtracks.ts backend/src/routes/soundtracks.test.ts
git commit -m "feat(api): GET /soundtracks/:key/file stream mp3"
```

---

## Phase C — Backend: Per-day Endpoints (TDD)

### Task 7: Test + implement per-day GET/PUT/DELETE

**Files:**
- Modify: `backend/src/routes/soundtracks.test.ts`
- Modify: `backend/src/routes/soundtracks.ts`
- Modify: `backend/src/app.ts`

> Pattern follows `day-labels.ts` exactly — same auth, same `isAlbumMember` helper, same date regex.

- [ ] **Step 1: Write failing tests for per-day endpoints**

Append to `backend/src/routes/soundtracks.test.ts`:

```ts
import { createTestAlbum } from '../../tests/setup';
import { daySoundtracks } from '../db/schema';

describe('Per-day soundtrack endpoints', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;
  let trackId: string;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    const [t] = await db.insert(soundtracks).values({
      key: 'lullaby_01',
      title: 'Mây trắng',
      durationMs: 30000,
      filePath: 'lullaby_01.mp3',
      isActive: true,
    }).returning();
    trackId = t.id;
  });

  describe('GET /albums/:id/days/:date/soundtrack', () => {
    it('returns null when no soundtrack assigned', async () => {
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns the soundtrack row when assigned', async () => {
      await db.insert(daySoundtracks).values({
        albumId: album.id,
        date: '2026-06-15',
        soundtrackId: trackId,
        updatedBy: user.id,
      });
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: trackId, key: 'lullaby_01', title: 'Mây trắng' });
    });

    it('returns inactive track too (mobile shows "unavailable" toast)', async () => {
      const [inactive] = await db.insert(soundtracks).values({
        key: 'old', title: 'Old', durationMs: 10000, filePath: 'old.mp3', isActive: false,
      }).returning();
      await db.insert(daySoundtracks).values({
        albumId: album.id, date: '2026-06-15', soundtrackId: inactive.id, updatedBy: user.id,
      });
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ key: 'old', is_active: false });
    });

    it('403 for non-member', async () => {
      const other = await createTestUser();
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(authHeader(other));
      expect(res.status).toBe(403);
    });

    it('400 for bad date format', async () => {
      const res = await request(app)
        .get(`/albums/${album.id}/days/15-06-2026/soundtrack`)
        .set(headers);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /albums/:id/days/:date/soundtrack', () => {
    it('upserts an assignment', async () => {
      const res1 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: trackId });
      expect(res1.status).toBe(200);
      expect(res1.body.soundtrack_id).toBe(trackId);

      const [t2] = await db.insert(soundtracks).values({
        key: 'lullaby_02', title: 'Bình minh', durationMs: 40000, filePath: 'lullaby_02.mp3', isActive: true,
      }).returning();
      const res2 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: t2.id });
      expect(res2.status).toBe(200);
      expect(res2.body.soundtrack_id).toBe(t2.id);
    });

    it('400 when soundtrack_id missing or invalid UUID', async () => {
      const r1 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({});
      expect(r1.status).toBe(400);

      const r2 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: 'not-a-uuid' });
      expect(r2.status).toBe(400);
    });

    it('400 when soundtrack does not exist', async () => {
      const res = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(400);
    });

    it('400 when soundtrack is inactive', async () => {
      const [inactive] = await db.insert(soundtracks).values({
        key: 'old2', title: 'Old', durationMs: 10000, filePath: 'old.mp3', isActive: false,
      }).returning();
      const res = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: inactive.id });
      expect(res.status).toBe(400);
    });

    it('403 for non-member', async () => {
      const other = await createTestUser();
      const res = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(authHeader(other)).send({ soundtrack_id: trackId });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /albums/:id/days/:date/soundtrack', () => {
    it('removes the assignment', async () => {
      await db.insert(daySoundtracks).values({
        albumId: album.id, date: '2026-06-15', soundtrackId: trackId, updatedBy: user.id,
      });
      const del = await request(app)
        .delete(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(del.status).toBe(204);

      const get = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(get.body).toBeNull();
    });

    it('204 idempotent', async () => {
      const res = await request(app)
        .delete(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(204);
    });

    it('403 for non-member', async () => {
      const other = await createTestUser();
      const res = await request(app)
        .delete(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(authHeader(other));
      expect(res.status).toBe(403);
    });
  });
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test -- soundtracks`

Expected: all new describe blocks fail (route missing).

- [ ] **Step 3: Create new file for per-day router**

Per-day endpoints are mounted under `/albums/:id/days/:date/soundtrack` — different prefix than library endpoints (`/soundtracks`), so they need a separate router file or the same file with `mergeParams: true`. To keep concerns together, create a second router and mount both in `app.ts`.

Create `backend/src/routes/day-soundtracks.ts`:

```ts
import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { albumMembers, daySoundtracks, soundtracks } from '../db/schema';
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

router.get('/:date/soundtrack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await db
      .select({
        id: soundtracks.id,
        key: soundtracks.key,
        title: soundtracks.title,
        artist: soundtracks.artist,
        duration_ms: soundtracks.durationMs,
        is_active: soundtracks.isActive,
      })
      .from(daySoundtracks)
      .innerJoin(soundtracks, eq(soundtracks.id, daySoundtracks.soundtrackId))
      .where(and(eq(daySoundtracks.albumId, albumId), eq(daySoundtracks.date, date)))
      .limit(1);

    res.json(rows[0] ?? null);
  } catch (err) {
    next(err);
  }
});

router.put('/:date/soundtrack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    const soundtrackId = req.body?.soundtrack_id;

    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });
    if (!soundtrackId || !isValidUUID(soundtrackId)) {
      return res.status(400).json({ error: 'soundtrack_id required (valid UUID)' });
    }

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [track] = await db.select().from(soundtracks)
      .where(and(eq(soundtracks.id, soundtrackId), eq(soundtracks.isActive, true)))
      .limit(1);
    if (!track) return res.status(400).json({ error: 'Soundtrack not found or inactive' });

    const [row] = await db
      .insert(daySoundtracks)
      .values({ albumId, date, soundtrackId, updatedBy: req.user!.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [daySoundtracks.albumId, daySoundtracks.date],
        set: { soundtrackId, updatedBy: req.user!.id, updatedAt: new Date() },
      })
      .returning({
        date: daySoundtracks.date,
        soundtrack_id: daySoundtracks.soundtrackId,
        updated_at: daySoundtracks.updatedAt,
        updated_by: daySoundtracks.updatedBy,
      });

    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/:date/soundtrack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const date = req.params.date as string;
    if (!isValidUUID(albumId)) return res.status(400).json({ error: 'Invalid albumId' });
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date' });

    if (!(await isAlbumMember(albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.delete(daySoundtracks)
      .where(and(eq(daySoundtracks.albumId, albumId), eq(daySoundtracks.date, date)));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export = router;
```

- [ ] **Step 4: Mount the new router**

In `backend/src/app.ts`, after the existing `soundtracksRoutes` import:

```ts
import daySoundtracksRoutes from './routes/day-soundtracks';
```

After the line `app.use('/albums/:id/days', albumDaysRoutes);`:

```ts
app.use('/albums/:id/days', daySoundtracksRoutes);
```

Both `albumDaysRoutes` and `daySoundtracksRoutes` mount on the same prefix — Express tries them in order. `albumDaysRoutes` handles `GET /:date/photos` and `GET /` (the album-days listing), while `daySoundtracksRoutes` handles `GET|PUT|DELETE /:date/soundtrack`. They don't overlap.

- [ ] **Step 5: Run tests, see them pass**

Run: `npm test -- soundtracks`

Expected: all per-day tests pass, plus library tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/day-soundtracks.ts backend/src/routes/soundtracks.test.ts backend/src/app.ts
git commit -m "feat(api): per-day soundtrack GET/PUT/DELETE endpoints"
```

---

## Phase D — Backend: Export Pipeline

### Task 8: Extend `/stories/export` to accept `soundtrack_id`

**Files:**
- Modify: `backend/src/routes/stories.test.ts`
- Modify: `backend/src/routes/stories.ts`

- [ ] **Step 1: Write failing tests**

Append to `backend/src/routes/stories.test.ts` (inside the existing `describe('GET /stories/export')` block):

```ts
it('passes soundtrack input + audio map to ffmpeg when soundtrack_id provided', async () => {
  const photo = await createTestPhoto(album.id, user.id, 'photo');
  const [track] = await db.insert(soundtracks).values({
    key: 'lullaby_01', title: 'Mây trắng', durationMs: 30000, filePath: 'lullaby_01.mp3', isActive: true,
  }).returning();
  // Ensure the placeholder file exists (Task 4 should have committed it)
  const fs2 = require('fs');
  const path2 = require('path');
  const fixturePath = path2.join(__dirname, '../../assets/soundtracks/lullaby_01.mp3');
  if (!fs2.existsSync(fixturePath)) {
    throw new Error('lullaby_01.mp3 fixture missing — Task 4 must run first');
  }

  mockExecFile.mockImplementation(((_bin: string, _args: string[], cb: any) => {
    fs.writeFileSync(_args[_args.length - 1], 'fake mp4 data');
    cb(null, { stdout: '', stderr: '' });
  }) as any);

  const res = await request(app)
    .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=${track.id}`)
    .set(headers);
  expect(res.status).toBe(200);

  const ffmpegArgs = mockExecFile.mock.calls[0][1] as string[];
  expect(ffmpegArgs).toContain('-stream_loop');
  expect(ffmpegArgs.some((a) => a.endsWith('lullaby_01.mp3'))).toBe(true);
  expect(ffmpegArgs).toContain('-shortest');
  expect(ffmpegArgs).toContain('-c:a');
  expect(ffmpegArgs).toContain('aac');
  expect(ffmpegArgs).not.toContain('-an');
});

it('silent fallback when soundtrack_id is non-existent UUID', async () => {
  const photo = await createTestPhoto(album.id, user.id, 'photo');
  mockExecFile.mockImplementation(((_bin: string, _args: string[], cb: any) => {
    fs.writeFileSync(_args[_args.length - 1], 'fake mp4');
    cb(null, { stdout: '', stderr: '' });
  }) as any);

  const res = await request(app)
    .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=00000000-0000-0000-0000-000000000000`)
    .set(headers);
  expect(res.status).toBe(200);
  const ffmpegArgs = mockExecFile.mock.calls[0][1] as string[];
  expect(ffmpegArgs).toContain('-an');
});

it('silent fallback when soundtrack is inactive', async () => {
  const photo = await createTestPhoto(album.id, user.id, 'photo');
  const [track] = await db.insert(soundtracks).values({
    key: 'old', title: 'Old', durationMs: 10000, filePath: 'lullaby_01.mp3', isActive: false,
  }).returning();
  mockExecFile.mockImplementation(((_bin: string, _args: string[], cb: any) => {
    fs.writeFileSync(_args[_args.length - 1], 'fake mp4');
    cb(null, { stdout: '', stderr: '' });
  }) as any);

  const res = await request(app)
    .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=${track.id}`)
    .set(headers);
  expect(res.status).toBe(200);
  const ffmpegArgs = mockExecFile.mock.calls[0][1] as string[];
  expect(ffmpegArgs).toContain('-an');
});

it('rejects invalid soundtrack_id format with 400', async () => {
  const photo = await createTestPhoto(album.id, user.id, 'photo');
  const res = await request(app)
    .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=not-a-uuid`)
    .set(headers);
  expect(res.status).toBe(400);
});
```

Also add at the top of the file (after existing imports):

```ts
import { soundtracks } from '../db/schema';
```

- [ ] **Step 2: Run tests, see them fail**

Run: `npm test -- stories`

Expected: 4 new tests fail; existing tests still pass.

- [ ] **Step 3: Modify stories.ts to handle soundtrack**

In `backend/src/routes/stories.ts`:

a) Add imports near top:

```ts
import { soundtracks } from '../db/schema';
```

b) After the `ids` validation block (around line 36 — after the UUID validation), add:

```ts
const soundtrackId = req.query.soundtrack_id as string | undefined;
if (soundtrackId !== undefined && !isValidUUID(soundtrackId)) {
  return res.status(400).json({ error: 'soundtrack_id must be a valid UUID' });
}
```

c) Inside the `try` block, after `const ordered = ids.map(...)` but before the temp dir creation, resolve the soundtrack:

```ts
let soundtrackFilePath: string | null = null;
if (soundtrackId) {
  const [track] = await db.select().from(soundtracks)
    .where(and(eq(soundtracks.id, soundtrackId), eq(soundtracks.isActive, true)))
    .limit(1);
  if (track) {
    const candidatePath = path.join(__dirname, '../../assets/soundtracks', track.filePath);
    if (fs.existsSync(candidatePath)) soundtrackFilePath = candidatePath;
  }
}
```

(Add `import { and, eq, inArray } from 'drizzle-orm';` already exists. Just add `eq` if not present.)

d) Replace the ffmpeg args block (currently around lines 92-121) with:

```ts
const ffArgs: string[] = [];
for (const { filePath, mediaType } of localPaths) {
  if (mediaType === 'video') {
    ffArgs.push('-i', filePath);
  } else {
    ffArgs.push('-loop', '1', '-t', '3', '-i', filePath);
  }
}
if (soundtrackFilePath) {
  ffArgs.push('-stream_loop', '-1', '-i', soundtrackFilePath);
}

const videoCount = localPaths.length;
const filterParts = localPaths.map((_, i) =>
  `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
  `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
);
const concatInputs = localPaths.map((_, i) => `[v${i}]`).join('');
const filterArr: string[] = [
  ...filterParts,
  `${concatInputs}concat=n=${videoCount}:v=1:a=0[out]`,
];
if (soundtrackFilePath) {
  filterArr.push(`[${videoCount}:a]volume=0.7[a]`);
}
const filterComplex = filterArr.join('; ');

const audioArgs = soundtrackFilePath
  ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k', '-shortest']
  : ['-an'];

await execFileAsync(ffmpegPath!, [
  ...ffArgs,
  '-filter_complex', filterComplex,
  '-map', '[out]',
  ...audioArgs,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '23',
  '-r', '30',
  '-y', outputPath,
]);
```

- [ ] **Step 4: Run tests, see them pass**

Run: `npm test -- stories`

Expected: all stories tests pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/stories.ts backend/src/routes/stories.test.ts
git commit -m "feat(api): mix soundtrack into /stories/export ffmpeg pipeline"
```

---

## Phase E — Mobile: Dependency + Hooks

### Task 9: Install `expo-audio`

**Files:**
- Modify: `mobile/package.json`, `mobile/package-lock.json`

- [ ] **Step 1: Install via expo install**

Run from `mobile/`:

```bash
npx expo install expo-audio
```

Expected: adds `"expo-audio": "~X.Y.Z"` to `dependencies` matching SDK 56.

- [ ] **Step 2: Verify it imports**

Add a temporary file `mobile/scratch.ts`:

```ts
import { useAudioPlayer } from 'expo-audio';
console.log(useAudioPlayer);
```

Run from `mobile/`: `npx tsc --noEmit scratch.ts`

Expected: no TypeScript errors. Then `rm scratch.ts`.

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): add expo-audio"
```

---

### Task 10: `useSoundtracks` hook

**Files:**
- Create: `mobile/src/hooks/useSoundtracks.ts`
- Create: `mobile/src/hooks/useSoundtracks.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/src/hooks/useSoundtracks.test.tsx`:

```tsx
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSoundtracks } from '@/hooks/useSoundtracks';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => mockApi.get.mockReset());

describe('useSoundtracks', () => {
  test('fetches /soundtracks and returns the list', async () => {
    const data = [
      { id: 't1', key: 'lullaby_01', title: 'Mây trắng', artist: null, duration_ms: 30000 },
    ];
    mockApi.get.mockResolvedValueOnce({ data });
    const { result } = renderHook(() => useSoundtracks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/soundtracks');
    expect(result.current.data).toEqual(data);
  });
});
```

- [ ] **Step 2: Run, see it fail**

Run from `mobile/`: `npm test -- useSoundtracks`

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `mobile/src/hooks/useSoundtracks.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Soundtrack {
  id: string;
  key: string;
  title: string;
  artist: string | null;
  duration_ms: number;
  is_active?: boolean;
}

export function useSoundtracks() {
  return useQuery<Soundtrack[]>({
    queryKey: ['soundtracks'],
    queryFn: async () => {
      const { data } = await api.get<Soundtrack[]>('/soundtracks');
      return data;
    },
    staleTime: Infinity,
  });
}
```

- [ ] **Step 4: Run, see it pass**

Run: `npm test -- useSoundtracks`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useSoundtracks.ts mobile/src/hooks/useSoundtracks.test.tsx
git commit -m "feat(mobile): useSoundtracks hook"
```

---

### Task 11: `useDaySoundtrack` hook

**Files:**
- Create: `mobile/src/hooks/useDaySoundtrack.ts`
- Create: `mobile/src/hooks/useDaySoundtrack.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/src/hooks/useDaySoundtrack.test.tsx`:

```tsx
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDaySoundtrack } from '@/hooks/useDaySoundtrack';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => mockApi.get.mockReset());

describe('useDaySoundtrack', () => {
  test('fetches per-day soundtrack', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { id: 't1', key: 'lullaby_01', title: 'Mây trắng', duration_ms: 30000, is_active: true },
    });
    const { result } = renderHook(() => useDaySoundtrack('a1', '2026-06-15'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/albums/a1/days/2026-06-15/soundtrack');
    expect(result.current.data?.key).toBe('lullaby_01');
  });

  test('returns null body as null data', async () => {
    mockApi.get.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useDaySoundtrack('a1', '2026-06-15'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  test('does not fetch when albumId or date is null', async () => {
    const { result } = renderHook(() => useDaySoundtrack(null, '2026-06-15'), { wrapper: makeWrapper() });
    await act(async () => { await Promise.resolve(); });
    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
```

- [ ] **Step 2: Run, see it fail**

Run: `npm test -- useDaySoundtrack`

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `mobile/src/hooks/useDaySoundtrack.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Soundtrack } from './useSoundtracks';

export function useDaySoundtrack(albumId: string | null, date: string | null) {
  return useQuery<Soundtrack | null>({
    queryKey: ['day-soundtrack', albumId, date],
    queryFn: async () => {
      const { data } = await api.get<Soundtrack | null>(`/albums/${albumId}/days/${date}/soundtrack`);
      return data;
    },
    enabled: !!albumId && !!date,
  });
}
```

- [ ] **Step 4: Run, see it pass**

Run: `npm test -- useDaySoundtrack`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useDaySoundtrack.ts mobile/src/hooks/useDaySoundtrack.test.tsx
git commit -m "feat(mobile): useDaySoundtrack hook"
```

---

### Task 12: `useSetDaySoundtrack` mutation hook

**Files:**
- Create: `mobile/src/hooks/useSetDaySoundtrack.ts`
- Create: `mobile/src/hooks/useSetDaySoundtrack.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/src/hooks/useSetDaySoundtrack.test.tsx`:

```tsx
jest.mock('@/lib/api', () => ({ api: { put: jest.fn(), delete: jest.fn() } }));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetDaySoundtrack } from '@/hooks/useSetDaySoundtrack';
import { api } from '@/lib/api';

const mockApi = api as unknown as { put: jest.Mock; delete: jest.Mock };

function makeWrapper(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { qc, Wrapper: ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children) };
}

beforeEach(() => { mockApi.put.mockReset(); mockApi.delete.mockReset(); });

describe('useSetDaySoundtrack', () => {
  test('calls PUT when given a soundtrack id', async () => {
    mockApi.put.mockResolvedValueOnce({ data: {} });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetDaySoundtrack('a1', '2026-06-15'), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync('track-1'); });
    expect(mockApi.put).toHaveBeenCalledWith('/albums/a1/days/2026-06-15/soundtrack', { soundtrack_id: 'track-1' });
  });

  test('calls DELETE when given null', async () => {
    mockApi.delete.mockResolvedValueOnce({ data: {} });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetDaySoundtrack('a1', '2026-06-15'), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync(null); });
    expect(mockApi.delete).toHaveBeenCalledWith('/albums/a1/days/2026-06-15/soundtrack');
  });

  test('invalidates day-soundtrack cache on success', async () => {
    mockApi.put.mockResolvedValueOnce({ data: {} });
    const { qc, Wrapper } = makeWrapper();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSetDaySoundtrack('a1', '2026-06-15'), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync('t1'); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['day-soundtrack', 'a1', '2026-06-15'] });
  });
});
```

- [ ] **Step 2: Run, see it fail**

Run: `npm test -- useSetDaySoundtrack`

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `mobile/src/hooks/useSetDaySoundtrack.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSetDaySoundtrack(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (soundtrackId: string | null) => {
      if (soundtrackId === null) {
        await api.delete(`/albums/${albumId}/days/${date}/soundtrack`);
      } else {
        await api.put(`/albums/${albumId}/days/${date}/soundtrack`, { soundtrack_id: soundtrackId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day-soundtrack', albumId, date] }),
  });
}
```

- [ ] **Step 4: Run, see it pass**

Run: `npm test -- useSetDaySoundtrack`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useSetDaySoundtrack.ts mobile/src/hooks/useSetDaySoundtrack.test.tsx
git commit -m "feat(mobile): useSetDaySoundtrack mutation hook"
```

---

### Task 13: `useSoundtrackCache` hook

**Files:**
- Create: `mobile/src/hooks/useSoundtrackCache.ts`
- Create: `mobile/src/hooks/useSoundtrackCache.test.ts`

- [ ] **Step 1: Write failing test**

Create `mobile/src/hooks/useSoundtrackCache.test.ts`:

```ts
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(),
}));
jest.mock('@/constants/api', () => ({ API_URL: 'https://api.example' }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ token: 'tok' }) },
}));

import * as FileSystem from 'expo-file-system/legacy';
import { ensureSoundtrackCached } from '@/hooks/useSoundtrackCache';

const fs = FileSystem as unknown as {
  getInfoAsync: jest.Mock;
  makeDirectoryAsync: jest.Mock;
  downloadAsync: jest.Mock;
};

beforeEach(() => {
  fs.getInfoAsync.mockReset();
  fs.makeDirectoryAsync.mockReset().mockResolvedValue(undefined);
  fs.downloadAsync.mockReset();
});

describe('ensureSoundtrackCached', () => {
  test('returns local URI without downloading when file exists', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true });
    const uri = await ensureSoundtrackCached('lullaby_01');
    expect(uri).toBe('file:///cache/soundtracks/lullaby_01.mp3');
    expect(fs.downloadAsync).not.toHaveBeenCalled();
  });

  test('downloads when missing and returns local URI', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false });
    fs.downloadAsync.mockResolvedValueOnce({ status: 200 });
    const uri = await ensureSoundtrackCached('lullaby_01');
    expect(uri).toBe('file:///cache/soundtracks/lullaby_01.mp3');
    expect(fs.downloadAsync).toHaveBeenCalledWith(
      'https://api.example/soundtracks/lullaby_01/file',
      'file:///cache/soundtracks/lullaby_01.mp3',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  test('throws when download returns non-200', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false });
    fs.downloadAsync.mockResolvedValueOnce({ status: 500 });
    await expect(ensureSoundtrackCached('x')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, see it fail**

Run: `npm test -- useSoundtrackCache`

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `mobile/src/hooks/useSoundtrackCache.ts`:

```ts
import * as FileSystem from 'expo-file-system/legacy';
import { API_URL } from '@/constants/api';
import { useAuthStore } from '@/stores/authStore';

const CACHE_DIR = `${FileSystem.cacheDirectory}soundtracks/`;

export async function ensureSoundtrackCached(key: string): Promise<string> {
  const localUri = `${CACHE_DIR}${key}.mp3`;
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) return localUri;

  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  const token = useAuthStore.getState().token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const result = await FileSystem.downloadAsync(
    `${API_URL}/soundtracks/${encodeURIComponent(key)}/file`,
    localUri,
    { headers },
  );
  if (result.status !== 200) throw new Error(`fetch soundtrack ${key} failed (${result.status})`);
  return localUri;
}

export function useSoundtrackCache() {
  return { ensure: ensureSoundtrackCached };
}
```

(Uses `expo-file-system/legacy` because `useStoryExport.ts` already does — keeps the codebase consistent until a broader migration.)

- [ ] **Step 4: Run, see it pass**

Run: `npm test -- useSoundtrackCache`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useSoundtrackCache.ts mobile/src/hooks/useSoundtrackCache.test.ts
git commit -m "feat(mobile): useSoundtrackCache hook"
```

---

### Task 14: Update `useStoryExport` to accept soundtrack id

**Files:**
- Modify: `mobile/src/hooks/useStoryExport.ts`

- [ ] **Step 1: Update signature + URL**

Replace `useStoryExport`'s signature in `mobile/src/hooks/useStoryExport.ts`:

```ts
import { useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
import { API_URL } from '@/constants/api';
import { useAuthStore } from '@/stores/authStore';

export function useStoryExport(
  photos: DayPhoto[],
  date: string,
  soundtrackId?: string | null,
) {
  const [exporting, setExporting] = useState(false);

  async function exportStory() {
    setExporting(true);
    if (photos.length === 0) {
      setExporting(false);
      return;
    }

    const outputPath = `${FileSystem.cacheDirectory}story_${date}.mp4`;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Cần quyền truy cập',
          'Cần quyền truy cập Ảnh. Vui lòng bật trong Cài đặt.',
        );
        return;
      }

      const token = useAuthStore.getState().token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const photoIds = photos.map((p) => p.id).join(',');
      let url = `${API_URL}/stories/export?photo_ids=${encodeURIComponent(photoIds)}`;
      if (soundtrackId) url += `&soundtrack_id=${encodeURIComponent(soundtrackId)}`;

      const result = await FileSystem.downloadAsync(url, outputPath, { headers });
      if (result.status !== 200) throw new Error(`Export failed: ${result.status}`);

      await MediaLibrary.saveToLibraryAsync(outputPath);
      success();
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất video. Thử lại nhé.');
    } finally {
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
      setExporting(false);
    }
  }

  return { exporting, exportStory };
}
```

> Note: the existing file references `success()` and `DayPhoto`. Those imports already exist in the current file — keep them as-is. The diff is: add `soundtrackId?: string | null` to the signature, then append `&soundtrack_id=...` to `url` if present.

- [ ] **Step 2: Type-check**

Run from `mobile/`: `npx tsc --noEmit`

Expected: no new errors. (One pre-existing baseUrl deprecation warning is allowed.)

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/useStoryExport.ts
git commit -m "feat(mobile): useStoryExport accepts optional soundtrack id"
```

---

## Phase F — Mobile: Picker UI + Story Integration

### Task 15: `SoundtrackPickerSheet` component

**Files:**
- Create: `mobile/src/components/story/SoundtrackPickerSheet.tsx`
- Create: `mobile/src/components/story/SoundtrackPickerSheet.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/src/components/story/SoundtrackPickerSheet.test.tsx`:

```tsx
jest.mock('@/hooks/useSoundtracks', () => ({
  useSoundtracks: () => ({
    data: [
      { id: 't1', key: 'lullaby_01', title: 'Mây trắng', artist: null, duration_ms: 30000 },
      { id: 't2', key: 'lullaby_02', title: 'Bình minh', artist: null, duration_ms: 40000 },
    ],
    isLoading: false,
  }),
}));

const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/useSetDaySoundtrack', () => ({
  useSetDaySoundtrack: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SoundtrackPickerSheet } from '@/components/story/SoundtrackPickerSheet';

beforeEach(() => mockMutateAsync.mockClear());

describe('SoundtrackPickerSheet', () => {
  test('renders track list with current selection marked', () => {
    const { getByTestId } = render(
      <SoundtrackPickerSheet
        albumId="a1"
        date="2026-06-15"
        currentSoundtrackId="t2"
        onClose={() => {}}
      />
    );
    expect(getByTestId('soundtrack-row-t1')).toBeTruthy();
    expect(getByTestId('soundtrack-row-t2-selected')).toBeTruthy();
  });

  test('tap row calls mutateAsync with track id', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SoundtrackPickerSheet
        albumId="a1"
        date="2026-06-15"
        currentSoundtrackId={null}
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('soundtrack-row-t1'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith('t1'));
    expect(onClose).toHaveBeenCalled();
  });

  test('tap "Tắt nhạc" calls mutateAsync with null', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SoundtrackPickerSheet
        albumId="a1"
        date="2026-06-15"
        currentSoundtrackId="t1"
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('soundtrack-row-none'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(null));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, see it fail**

Run: `npm test -- SoundtrackPickerSheet`

Expected: FAIL (component not found).

- [ ] **Step 3: Implement**

Create `mobile/src/components/story/SoundtrackPickerSheet.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckIcon, SpeakerSimpleSlashIcon } from 'phosphor-react-native';
import { useSoundtracks } from '@/hooks/useSoundtracks';
import { useSetDaySoundtrack } from '@/hooks/useSetDaySoundtrack';
import { theme, spacing, typography } from '@/constants/theme';
import { StickerCard } from '@/components/ui/StickerCard';

interface Props {
  albumId: string;
  date: string;
  currentSoundtrackId: string | null;
  onClose: () => void;
}

export function SoundtrackPickerSheet({ albumId, date, currentSoundtrackId, onClose }: Props) {
  const { data: tracks, isLoading } = useSoundtracks();
  const mutation = useSetDaySoundtrack(albumId, date);

  async function pick(id: string | null) {
    await mutation.mutateAsync(id);
    onClose();
  }

  return (
    <TouchableOpacity
      style={styles.backdrop}
      activeOpacity={1}
      onPress={onClose}
      testID="soundtrack-picker-backdrop"
    >
      <StickerCard shadow="heavy" style={styles.sheet}>
        <Text style={styles.title}>Nhạc nền cho ngày</Text>
        <ScrollView style={styles.list}>
          <TouchableOpacity
            testID="soundtrack-row-none"
            style={[styles.row, currentSoundtrackId === null && styles.rowSelected]}
            onPress={() => pick(null)}
            disabled={mutation.isPending}
          >
            <SpeakerSimpleSlashIcon size={18} color={theme.colors.textPrimary} />
            <Text style={styles.rowText}>Tắt nhạc</Text>
            {currentSoundtrackId === null && (
              <CheckIcon size={16} color={theme.colors.accent1} weight="bold" />
            )}
          </TouchableOpacity>

          {isLoading && <ActivityIndicator style={{ marginVertical: spacing.md }} />}

          {tracks?.map((t) => {
            const selected = t.id === currentSoundtrackId;
            return (
              <TouchableOpacity
                key={t.id}
                testID={selected ? `soundtrack-row-${t.id}-selected` : `soundtrack-row-${t.id}`}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => pick(t.id)}
                disabled={mutation.isPending}
              >
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowText}>{t.title}</Text>
                  {t.artist && <Text style={styles.rowMeta}>{t.artist}</Text>}
                </View>
                {selected && (
                  <CheckIcon size={16} color={theme.colors.accent1} weight="bold" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: spacing.lg, padding: 0, overflow: 'hidden', maxHeight: '70%',
  },
  title: {
    ...typography.title, color: theme.colors.textPrimary,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.borderSoft,
  },
  list: { paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  rowSelected: { backgroundColor: theme.overlays.surfaceOnDark },
  rowTextWrap: { flex: 1 },
  rowText: { ...typography.body, color: theme.colors.textPrimary },
  rowMeta: { ...typography.caption, color: theme.colors.textMuted, marginTop: 2 },
});
```

> If `theme.colors.accent1`, `theme.overlays.surfaceOnDark`, or `StickerCard.shadow="heavy"` don't exist on your tree, fall back to the closest existing tokens used by `[date].tsx` (it references `theme.overlays.surfaceOnDark` and `accent1` — should be present).

- [ ] **Step 4: Run, see it pass**

Run: `npm test -- SoundtrackPickerSheet`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/story/SoundtrackPickerSheet.tsx mobile/src/components/story/SoundtrackPickerSheet.test.tsx
git commit -m "feat(mobile): SoundtrackPickerSheet component"
```

---

### Task 16: Wire audio playback + picker into Story viewer

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`

- [ ] **Step 1: Add imports + new state at top of component**

In `mobile/app/story/[albumId]/[date].tsx`, add to imports:

```tsx
import { MusicNotesIcon } from 'phosphor-react-native';   // alongside existing phosphor imports
import { useAudioPlayer } from 'expo-audio';
import { useDaySoundtrack } from '@/hooks/useDaySoundtrack';
import { ensureSoundtrackCached } from '@/hooks/useSoundtrackCache';
import { SoundtrackPickerSheet } from '@/components/story/SoundtrackPickerSheet';
```

Inside `StoryScreen()`, after the existing state declarations (around line 34, after `videoReady`):

```tsx
const [pickerOpen, setPickerOpen] = useState(false);
const { data: daySoundtrack } = useDaySoundtrack(albumId, date);
const audioPlayer = useAudioPlayer(null);
```

- [ ] **Step 2: Pass soundtrack id into useStoryExport**

Update the existing line:

```tsx
const { exporting, exportStory } = useStoryExport(photos ?? [], date);
```

to:

```tsx
const { exporting, exportStory } = useStoryExport(photos ?? [], date, daySoundtrack?.id ?? null);
```

- [ ] **Step 3: Add audio load + play effects**

Add after the existing video-related effects (after the "Video progress reporting" effect, before the `if (isLoading...)` early return):

```tsx
// Load + play soundtrack when day's track changes
useEffect(() => {
  if (!daySoundtrack || daySoundtrack.is_active === false) {
    audioPlayer.pause();
    audioPlayer.replace(null);
    return;
  }
  let cancelled = false;
  ensureSoundtrackCached(daySoundtrack.key).then((localUri) => {
    if (cancelled) return;
    audioPlayer.replace(localUri);
    audioPlayer.loop = true;
    audioPlayer.volume = 0.7;
    if (!isPaused) audioPlayer.play();
  }).catch(() => { });
  return () => { cancelled = true; };
}, [daySoundtrack?.key, daySoundtrack?.is_active]);

// Sync audio pause/play with story pause/play
useEffect(() => {
  if (!daySoundtrack || daySoundtrack.is_active === false) return;
  if (isPaused) audioPlayer.pause();
  else audioPlayer.play();
}, [isPaused, daySoundtrack?.id]);

// Cleanup when leaving the story
useEffect(() => () => {
  audioPlayer.pause();
  audioPlayer.replace(null);
}, []);
```

- [ ] **Step 4: Add picker menu item to the existing dropdown**

In the existing dropdown JSX (inside `menuOpen && (...)`), add a new `TouchableOpacity` between "Sửa ghi chú" and "Lưu về máy":

```tsx
<TouchableOpacity
  style={styles.menuItem}
  testID="story-menu-soundtrack"
  onPress={() => {
    setMenuOpen(false);
    setPickerOpen(true);
  }}
>
  <MusicNotesIcon size={16} color={theme.colors.textPrimary} />
  <Text style={styles.menuItemText}>Nhạc nền</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Render the picker sheet**

Just before the closing `</View>` of the outer container (before `</GestureDetector>`), add:

```tsx
{pickerOpen && (
  <SoundtrackPickerSheet
    albumId={albumId}
    date={date}
    currentSoundtrackId={daySoundtrack?.id ?? null}
    onClose={() => setPickerOpen(false)}
  />
)}
```

- [ ] **Step 6: Type-check**

Run from `mobile/`: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/story/[albumId]/[date].tsx
git commit -m "feat(story): play day soundtrack in-app + picker menu entry"
```

---

## Phase G — Verification

### Task 17: Full test sweep + manual smoke

**Files:** (none modified; verification only)

- [ ] **Step 1: Run backend tests**

Run from `backend/`: `npm test`

Expected: all suites pass, including `soundtracks`, `day-labels`, `stories` (extended), and pre-existing.

- [ ] **Step 2: Run mobile tests**

Run from `mobile/`: `npm test`

Expected: all suites pass, including the 5 new hook/component tests + pre-existing.

- [ ] **Step 3: Manual smoke (in-app playback)**

Start backend locally (`npm run dev` from `backend/`). Start mobile (`npx expo start` from `mobile/`).

In the app:
1. Open a day's Story viewer.
2. Tap "..." → "Nhạc nền".
3. Verify the picker shows the placeholder `Mây trắng (placeholder)` row.
4. Tap it. Expect picker closes, story keeps playing.
5. Verify sound is heard (the placeholder is silent, so substitute one real mp3 in `assets/soundtracks/` for this step or use an audible test track). Story pause = audio pauses.
6. Tap "..." → "Nhạc nền" → "Tắt nhạc". Verify audio stops.

If audible playback can't be verified yet (because the seeded track is silent), log it as known and tracked in spec's Open Item #1.

- [ ] **Step 4: Manual smoke (export)**

In Story viewer of a day with a soundtrack assigned, tap "..." → "Lưu về máy". Verify the resulting MP4 in Photos app contains the music track baked in (assuming an audible track was seeded).

- [ ] **Step 5: No code changes needed if all green**

No commit required for verification-only task. If any test fails, file an issue or fix the root cause — do not skip tests.

---

## Self-review notes

Coverage of spec sections:
- §3 Architecture diagram → Tasks 1–8 (backend) + 9–16 (mobile)
- §4 Data model → Tasks 1–3
- §5 Backend implementation → Tasks 5–8
- §6 Mobile implementation → Tasks 9–16
- §7 Edge cases → covered by tests in Tasks 5–8 (inactive track, file missing, silent fallback) and Task 16 effects (cleanup, pause sync)
- §8 Open items → seeded with placeholder in Task 2; real tracks remain a deliverable outside this plan

No "TODO"/"TBD" placeholders.

Type/signature consistency check:
- `Soundtrack` interface defined once in `useSoundtracks.ts`, imported by `useDaySoundtrack.ts` and `SoundtrackPickerSheet.tsx`.
- `ensureSoundtrackCached(key: string): Promise<string>` — signature consistent across `useSoundtrackCache.ts` and Task 16 usage.
- Backend column names match Drizzle field names: `soundtrackId` ↔ `soundtrack_id`, `albumId` ↔ `album_id`, etc. — consistent with existing tables.
