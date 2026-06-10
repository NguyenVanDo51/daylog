# Album Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow album admins to rename, archive (read-only mode), and delete albums; allow any member to leave an album.

**Architecture:** Backend adds three new endpoints to `albums.ts` plus archive write-protection across write routes; frontend extends `albumStore` with role/archive state and makes `AlbumMenuSheet` role-and-archive-aware; the album detail screen gains a rename modal, confirmation dialogs, and a read-only banner.

**Tech Stack:** Express/Drizzle/PostgreSQL (backend), React Native/Expo Router/Zustand/React Query (mobile)

---

### Task 1: Add `archived_at` to Drizzle schema and generate migration

**Files:**
- Modify: `backend/src/db/schema.ts`
- Generate: `backend/src/db/migrations/0013_add_archived_at.sql` (auto-generated)

- [ ] **Step 1: Add `archivedAt` field to the `albums` table definition in `schema.ts`**

Open `backend/src/db/schema.ts`. In the `albums` pgTable block, add after `isPrivate`:

```ts
archivedAt: timestamp('archived_at', { withTimezone: true }),
```

The full `albums` block becomes:
```ts
export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  name: varchar('name').notNull(),
  childBirthdate: date('child_birthdate'),
  coverPhotoId: uuid('cover_photo_id'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  isPrivate: boolean('is_private').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd backend
npm run migrate:generate
npm run migrate:push
```

Expected: `migrate:generate` creates `src/db/migrations/0013_add_archived_at.sql` containing:
```sql
ALTER TABLE "albums" ADD COLUMN "archived_at" timestamp with time zone;
```
`migrate:push` applies it to the database with no errors.

- [ ] **Step 3: Update `TestAlbum` in `tests/setup.ts` and `createTestAlbum` helper**

Open `backend/tests/setup.ts`. Add `archived_at` to the `TestAlbum` interface:

```ts
export interface TestAlbum {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
  created_by: string;
  created_at: Date | null;
  is_private: boolean;
  archived_at: Date | null;
}
```

Update `toSnakeAlbum`:
```ts
function toSnakeAlbum(a: typeof albums.$inferSelect): TestAlbum {
  return {
    id: a.id,
    name: a.name,
    child_birthdate: a.childBirthdate,
    cover_photo_id: a.coverPhotoId,
    created_by: a.createdBy,
    created_at: a.createdAt,
    is_private: a.isPrivate,
    archived_at: a.archivedAt ?? null,
  };
}
```

Add an optional `archived` parameter to `createTestAlbum` so tests can seed archived albums:

```ts
export async function createTestAlbum(
  userId: string,
  overrides: Partial<{
    name: string;
    child_birthdate: string | null;
    archived: boolean;
  }> = {}
): Promise<TestAlbum> {
  const [album] = await db
    .insert(albums)
    .values({
      name: overrides.name ?? 'Test Album',
      createdBy: userId,
      childBirthdate:
        overrides.child_birthdate !== undefined ? overrides.child_birthdate : '2024-01-15',
      archivedAt: overrides.archived ? new Date() : null,
    })
    .returning();
  await db.insert(albumMembers).values({
    albumId: album.id,
    userId,
    role: 'admin',
  });
  return toSnakeAlbum(album);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/ backend/tests/setup.ts
git commit -m "feat: add archived_at column to albums table"
```

---

### Task 2: Extend GET /albums and GET /albums/:id with `my_role` and `archived_at`

**Files:**
- Modify: `backend/src/routes/albums.ts`
- Modify: `backend/src/routes/albums.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/albums.test.ts`:

```ts
describe('Albums my_role and archived_at fields', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('GET /albums returns my_role for each album', async () => {
    await createTestAlbum(user.id, { name: 'Mine' });
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].my_role).toBe('admin');
  });

  it('GET /albums returns archived_at as null for active albums', async () => {
    await createTestAlbum(user.id);
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].archived_at).toBeNull();
  });

  it('GET /albums returns archived_at as ISO string for archived albums', async () => {
    await createTestAlbum(user.id, { archived: true });
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].archived_at).toBeTruthy();
  });

  it('GET /albums/:id returns my_role', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.my_role).toBe('admin');
  });

  it('GET /albums/:id returns archived_at', async () => {
    const album = await createTestAlbum(user.id, { archived: true });
    const res = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeTruthy();
  });

  it('GET /albums returns my_role as member when user is not the creator', async () => {
    const creator = await createTestUser({ apple_sub: 'creator-sub' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].my_role).toBe('member');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest albums.test --no-coverage
```

Expected: the new describe block fails with `my_role` and `archived_at` being undefined.

- [ ] **Step 3: Update `albumSelect` and GET /albums in `albums.ts`**

In `backend/src/routes/albums.ts`, update `albumSelect` to include `archived_at`:

```ts
const albumSelect = {
  id: albums.id,
  name: albums.name,
  child_birthdate: albums.childBirthdate,
  cover_photo_id: albums.coverPhotoId,
  created_by: albums.createdBy,
  created_at: albums.createdAt,
  is_private: albums.isPrivate,
  archived_at: albums.archivedAt,
};
```

Update `GET /` to include `my_role` from the already-joined `albumMembers`:

```ts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select({
        ...albumSelect,
        my_role: albumMembers.role,
      })
      .from(albums)
      .innerJoin(albumMembers, eq(albumMembers.albumId, albums.id))
      .where(eq(albumMembers.userId, req.user!.id))
      .orderBy(desc(albums.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});
```

Update `GET /:id` to include `my_role` by reading it from the already-fetched `membership` row:

```ts
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }
    const membership = await db
      .select({ role: albumMembers.role })
      .from(albumMembers)
      .where(
        and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id))
      )
      .limit(1);

    if (!membership[0]) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const rows = await db
      .select({
        ...albumSelect,
        member_count: sql<number>`count(${albumMembers.id})::int`,
      })
      .from(albums)
      .innerJoin(albumMembers, eq(albumMembers.albumId, albums.id))
      .where(eq(albums.id, albumId))
      .groupBy(albums.id);

    if (!rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ...rows[0], my_role: membership[0].role });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npx jest albums.test --no-coverage
```

Expected: all tests pass including the new describe block.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/albums.ts backend/src/routes/albums.test.ts
git commit -m "feat: add my_role and archived_at to GET /albums responses"
```

---

### Task 3: POST /albums/:id/archive endpoint + tests

**Files:**
- Modify: `backend/src/routes/albums.ts`
- Modify: `backend/src/routes/albums.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/albums.test.ts`:

```ts
describe('POST /albums/:id/archive', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 200 and sets archived_at', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeTruthy();
  });

  it('returns 403 for non-admin member', async () => {
    const creator = await createTestUser({ apple_sub: 'creator-2' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'other-3' });
    const album = await createTestAlbum(other.id);
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 409 if already archived', async () => {
    const album = await createTestAlbum(user.id, { archived: true });
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest albums.test --no-coverage -t "POST /albums/:id/archive"
```

Expected: 404 (route not found) for all new tests.

- [ ] **Step 3: Add the archive endpoint to `albums.ts`**

Add before `export = router;`:

```ts
router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }

    const membership = await db
      .select({ role: albumMembers.role })
      .from(albumMembers)
      .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
      .limit(1);

    if (!membership[0] || membership[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const current = await db
      .select({ archivedAt: albums.archivedAt })
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    if (!current[0]) { res.status(404).json({ error: 'Not found' }); return; }
    if (current[0].archivedAt !== null) {
      res.status(409).json({ error: 'Album is already archived' });
      return;
    }

    const [updated] = await db
      .update(albums)
      .set({ archivedAt: new Date() })
      .where(eq(albums.id, albumId))
      .returning({ archived_at: albums.archivedAt });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npx jest albums.test --no-coverage -t "POST /albums/:id/archive"
```

Expected: all 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/albums.ts backend/src/routes/albums.test.ts
git commit -m "feat: add POST /albums/:id/archive endpoint"
```

---

### Task 4: DELETE /albums/:id endpoint + tests

**Files:**
- Modify: `backend/src/routes/albums.ts`
- Modify: `backend/src/routes/albums.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/albums.test.ts`:

```ts
describe('DELETE /albums/:id', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 204 and removes the album', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .delete(`/albums/${album.id}`)
      .set(headers);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(check.status).toBe(403);
  });

  it('returns 403 for non-admin member', async () => {
    const creator = await createTestUser({ apple_sub: 'creator-del-2' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app)
      .delete(`/albums/${album.id}`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'other-del-3' });
    const album = await createTestAlbum(other.id);
    const res = await request(app)
      .delete(`/albums/${album.id}`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent album', async () => {
    const res = await request(app)
      .delete('/albums/00000000-0000-0000-0000-000000000000')
      .set(headers);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest albums.test --no-coverage -t "DELETE /albums/:id"
```

Expected: 404 (route not found) for all new tests.

- [ ] **Step 3: Add `deleteObject` import to `albums.ts`**

At the top of `backend/src/routes/albums.ts`, add the r2 import:

```ts
import { deleteObject } from '../services/r2';
```

Also add `photos` to the drizzle imports at the top (it's already imported — verify `photos` is in the `from '../db/schema'` import).

The full imports block should be:
```ts
import express, { Request, Response, NextFunction } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albums, albumMembers, photos } from '../db/schema';
import { isValidUUID } from '../lib/validation';
import { deleteObject } from '../services/r2';
```

- [ ] **Step 4: Add the delete endpoint to `albums.ts`**

Add before `export = router;`:

```ts
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }

    const membership = await db
      .select({ role: albumMembers.role })
      .from(albumMembers)
      .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
      .limit(1);

    if (!membership[0]) { res.status(404).json({ error: 'Not found' }); return; }
    if (membership[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Fetch all R2 keys before deleting
    const photoRows = await db
      .select({ r2Key: photos.r2Key, thumbnailKey: photos.thumbnailKey })
      .from(photos)
      .where(eq(photos.albumId, albumId));

    // Delete the album row — cascades album_members, photos, album_photos, day_labels, invites, reactions
    const deleted = await db
      .delete(albums)
      .where(eq(albums.id, albumId))
      .returning({ id: albums.id });

    if (!deleted[0]) { res.status(404).json({ error: 'Not found' }); return; }

    // Delete R2 objects after DB delete succeeds
    await Promise.all(
      photoRows.flatMap((p) => {
        const ops = [deleteObject(p.r2Key)];
        if (p.thumbnailKey) ops.push(deleteObject(p.thumbnailKey));
        return ops;
      })
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npx jest albums.test --no-coverage -t "DELETE /albums/:id"
```

Expected: all 4 new tests pass. Note: R2 calls will silently fail in the test environment (no real R2 credentials) — this is acceptable since the DB deletion is what the tests verify.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/albums.ts backend/src/routes/albums.test.ts
git commit -m "feat: add DELETE /albums/:id endpoint with R2 cleanup"
```

---

### Task 5: DELETE /albums/:id/members/me endpoint + tests

**Files:**
- Modify: `backend/src/routes/albums.ts`
- Modify: `backend/src/routes/albums.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `backend/src/routes/albums.test.ts`:

```ts
describe('DELETE /albums/:id/members/me', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 204 and removes the caller from album_members', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(204);

    // User can no longer access the album
    const check = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(check.status).toBe(403);
  });

  it('allows the last admin to leave (album becomes admin-less)', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'leave-other' });
    const album = await createTestAlbum(other.id);
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(404);
  });

  it('a regular member can leave', async () => {
    const creator = await createTestUser({ apple_sub: 'leave-creator' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest albums.test --no-coverage -t "DELETE /albums/:id/members/me"
```

Expected: 404 (route not found) for all new tests.

- [ ] **Step 3: Add the leave endpoint to `albums.ts`**

Add before `export = router;`:

```ts
router.delete('/:id/members/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    if (!isValidUUID(albumId)) { res.status(400).json({ error: 'Invalid albumId' }); return; }

    const deleted = await db
      .delete(albumMembers)
      .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id)))
      .returning({ id: albumMembers.id });

    if (!deleted[0]) { res.status(404).json({ error: 'Not a member' }); return; }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npx jest albums.test --no-coverage -t "DELETE /albums/:id/members/me"
```

Expected: all 4 new tests pass.

- [ ] **Step 5: Run full album test suite**

```bash
cd backend && npx jest albums.test --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/albums.ts backend/src/routes/albums.test.ts
git commit -m "feat: add DELETE /albums/:id/members/me (leave album) endpoint"
```

---

### Task 6: Archive write-protection — shared helper + apply to write endpoints

**Files:**
- Create: `backend/src/lib/albumGuards.ts`
- Modify: `backend/src/routes/albums.ts` (PATCH rename)
- Modify: `backend/src/routes/photos.ts` (POST upload, PATCH caption)
- Modify: `backend/src/routes/reactions.ts` (POST reaction)
- Modify: `backend/src/routes/day-labels.ts` (PUT label)
- Modify: `backend/src/routes/invites.ts` (POST invite)

- [ ] **Step 1: Create `albumGuards.ts`**

Create `backend/src/lib/albumGuards.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { albums } from '../db/schema';

export async function isAlbumArchived(albumId: string): Promise<boolean> {
  const rows = await db
    .select({ archivedAt: albums.archivedAt })
    .from(albums)
    .where(eq(albums.id, albumId))
    .limit(1);
  return rows.length > 0 && rows[0].archivedAt !== null;
}
```

- [ ] **Step 2: Write failing tests for archive write-protection**

Add to `backend/src/routes/albums.test.ts`:

```ts
describe('PATCH /albums/:id blocked when archived', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 409 when renaming an archived album', async () => {
    const album = await createTestAlbum(user.id, { archived: true });
    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(headers)
      .send({ name: 'New Name' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Album is archived');
  });
});
```

Run to confirm it fails:
```bash
cd backend && npx jest albums.test --no-coverage -t "blocked when archived"
```

- [ ] **Step 3: Add archive check to `PATCH /albums/:id` in `albums.ts`**

In `albums.ts`, update the `PATCH /:id` handler. After the admin membership check and before the `cover_photo_id` validation, add:

```ts
// Check for archived status
const albumRow = await db
  .select({ archivedAt: albums.archivedAt })
  .from(albums)
  .where(eq(albums.id, albumId))
  .limit(1);
if (!albumRow[0]) { res.status(404).json({ error: 'Not found' }); return; }
if (albumRow[0].archivedAt !== null) {
  res.status(409).json({ error: 'Album is archived' });
  return;
}
```

The placement is after these lines:
```ts
if (!membership[0] || membership[0].role !== 'admin') {
  res.status(403).json({ error: 'Forbidden' });
  return;
}
// ← INSERT ARCHIVE CHECK HERE
const { name, child_birthdate, cover_photo_id } = req.body ?? {};
```

Run the test to confirm it passes:
```bash
cd backend && npx jest albums.test --no-coverage -t "blocked when archived"
```

- [ ] **Step 4: Add archive check to `POST /photos` in `photos.ts`**

Import the helper at the top of `backend/src/routes/photos.ts`:
```ts
import { isAlbumArchived } from '../lib/albumGuards';
```

In the `POST /` handler, after the membership checks (after the line `if (memberChecks.some((isMember) => !isMember)) { ... }`), add:

```ts
// Block uploads to archived albums
const archiveChecks = await Promise.all(
  (album_ids as string[]).map((albumId) => isAlbumArchived(albumId))
);
if (archiveChecks.some((archived) => archived)) {
  return res.status(409).json({ error: 'Album is archived' });
}
```

- [ ] **Step 5: Add archive check to `PATCH /photos/:id` in `photos.ts`**

In the `PATCH /:id` handler, after the ownership check (`if (photo.uploadedBy !== req.user!.id)`), add:

```ts
if (await isAlbumArchived(photo.albumId)) {
  return res.status(409).json({ error: 'Album is archived' });
}
```

- [ ] **Step 6: Add archive check to `POST /reactions` in `reactions.ts`**

Import the helpers at the top of `backend/src/routes/reactions.ts`:
```ts
import { isAlbumArchived } from '../lib/albumGuards';
```

Update `requirePhotoMember` to also return the `albumId` so we can use it for the archive check without an extra query. Replace the existing function with:

```ts
async function getPhotoMembership(photoId: string, userId: string): Promise<{ albumId: string } | null> {
  const rows = await db
    .select({ albumId: photos.albumId })
    .from(photos)
    .innerJoin(albumMembers, eq(albumMembers.albumId, photos.albumId))
    .where(and(eq(photos.id, photoId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows[0] ? { albumId: rows[0].albumId } : null;
}
```

Update the `POST /` handler in `reactions.ts` to use `getPhotoMembership` and add the archive check. Replace the membership guard block:

```ts
// was: if (!(await requirePhotoMember(photoId, userId))) { ... }
const membership = await getPhotoMembership(photoId, userId);
if (!membership) {
  return res.status(403).json({ error: 'Forbidden' });
}
if (await isAlbumArchived(membership.albumId)) {
  return res.status(409).json({ error: 'Album is archived' });
}
```

Also update the `GET /` handler — it still uses the old `requirePhotoMember`. Keep `requirePhotoMember` intact and just add the new `getPhotoMembership` function alongside it, so the GET handler continues to work. (The GET handler uses `requirePhotoMember` which is still defined.)

Actually, to avoid confusion: rename `requirePhotoMember` to keep it for GET, and add `getPhotoMembership` for POST. Both can coexist.

- [ ] **Step 7: Add archive check to `PUT /:date` in `day-labels.ts`**

Import at top of `backend/src/routes/day-labels.ts`:
```ts
import { isAlbumArchived } from '../lib/albumGuards';
```

In `PUT /:date` handler, after the membership check:
```ts
if (!(await isAlbumMember(albumId, req.user!.id))) {
  return res.status(403).json({ error: 'Forbidden' });
}
// ← ADD HERE:
if (await isAlbumArchived(albumId)) {
  return res.status(409).json({ error: 'Album is archived' });
}
```

- [ ] **Step 8: Add archive check to `POST /albums/:albumId/invites` in `invites.ts`**

Import at top of `backend/src/routes/invites.ts`:
```ts
import { isAlbumArchived } from '../lib/albumGuards';
```

In the invite creation handler, after the membership check:
```ts
if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });
// ← ADD HERE:
if (await isAlbumArchived(albumId)) {
  return res.status(409).json({ error: 'Album is archived' });
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Run full backend test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add backend/src/lib/albumGuards.ts backend/src/routes/albums.ts backend/src/routes/photos.ts backend/src/routes/reactions.ts backend/src/routes/day-labels.ts backend/src/routes/invites.ts
git commit -m "feat: block writes on archived albums (409 Album is archived)"
```

---

### Task 7: Frontend — update `Album` type and `albumStore`

**Files:**
- Modify: `mobile/src/hooks/useAlbums.ts`
- Modify: `mobile/src/stores/albumStore.ts`

- [ ] **Step 1: Update `Album` interface in `useAlbums.ts`**

Open `mobile/src/hooks/useAlbums.ts` and update the `Album` interface:

```ts
export interface Album {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
  created_by: string;
  created_at: string;
  is_private: boolean;
  my_role: 'admin' | 'member';
  archived_at: string | null;
}
```

- [ ] **Step 2: Update `albumStore.ts`**

Replace the full contents of `mobile/src/stores/albumStore.ts`:

```ts
import { create } from 'zustand';

interface AlbumState {
  albumId: string | null;
  albumName: string | null;
  childBirthdate: string | null;
  isPrivate: boolean | null;
  myRole: 'admin' | 'member' | null;
  archivedAt: string | null;
  setAlbum: (album: {
    id: string;
    name: string;
    child_birthdate: string | null;
    is_private: boolean;
    my_role: 'admin' | 'member';
    archived_at: string | null;
  }) => void;
  setAlbumName: (name: string) => void;
  setArchivedAt: (archivedAt: string) => void;
  clearAlbum: () => void;
}

export const useAlbumStore = create<AlbumState>((set) => ({
  albumId: null,
  albumName: null,
  childBirthdate: null,
  isPrivate: null,
  myRole: null,
  archivedAt: null,
  setAlbum: ({ id, name, child_birthdate, is_private, my_role, archived_at }) =>
    set({
      albumId: id,
      albumName: name,
      childBirthdate: child_birthdate,
      isPrivate: is_private,
      myRole: my_role,
      archivedAt: archived_at,
    }),
  setAlbumName: (name) => set({ albumName: name }),
  setArchivedAt: (archivedAt) => set({ archivedAt }),
  clearAlbum: () =>
    set({
      albumId: null,
      albumName: null,
      childBirthdate: null,
      isPrivate: null,
      myRole: null,
      archivedAt: null,
    }),
}));
```

Note: `setAlbumName` is used when rename succeeds to update the store without a full refetch. `setArchivedAt` is used when archive succeeds to flip read-only mode immediately.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: any pre-existing errors unrelated to this change; no new errors from the store changes.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/hooks/useAlbums.ts mobile/src/stores/albumStore.ts
git commit -m "feat: add myRole and archivedAt to albumStore"
```

---

### Task 8: Frontend — add i18n keys

**Files:**
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Add keys to `vi.ts`**

In `mobile/src/locales/vi.ts`, update the `album_menu` block:

```ts
album_menu: {
  members:         'Thành viên',
  invite:          'Mời thành viên',
  scan_qr:         'Quét mã QR',
  members_title:   'Thành viên',
  rename:          'Đổi tên',
  archive:         'Lưu trữ album',
  delete_album:    'Xóa album',
  leave_album:     'Rời album',
  rename_title:    'Đổi tên album',
  archive_confirm: 'Album sẽ chuyển sang chế độ chỉ đọc. Thao tác này không thể hoàn tác.',
  archived_banner: 'Album đã lưu trữ — chỉ đọc',
  delete_confirm:  'Xóa album này? Tất cả ảnh sẽ bị xóa vĩnh viễn.',
  leave_confirm:   'Rời album này? Bạn sẽ không còn quyền xem album này.',
},
```

- [ ] **Step 2: Add keys to `en.ts`**

In `mobile/src/locales/en.ts`, update the `album_menu` block:

```ts
album_menu: {
  members:         'Members',
  invite:          'Invite members',
  scan_qr:         'Scan QR code',
  members_title:   'Members',
  rename:          'Rename',
  archive:         'Archive album',
  delete_album:    'Delete album',
  leave_album:     'Leave album',
  rename_title:    'Rename album',
  archive_confirm: 'This album will become read-only. This cannot be undone.',
  archived_banner: 'Archived — read only',
  delete_confirm:  'Delete this album? All photos will be permanently removed.',
  leave_confirm:   'Leave this album? You will lose access.',
},
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat: add album management i18n keys"
```

---

### Task 9: Frontend — update `AlbumMenuSheet` + tests

**Files:**
- Modify: `mobile/src/components/family/AlbumMenuSheet.tsx`
- Modify: `mobile/src/components/family/AlbumMenuSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Replace the contents of `mobile/src/components/family/AlbumMenuSheet.test.tsx`:

```tsx
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
import { useAlbumStore } from '@/stores/albumStore';

const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onOpenMembers: jest.fn(),
  onOpenInvite: jest.fn(),
  onRename: jest.fn(),
  onArchive: jest.fn(),
  onDelete: jest.fn(),
  onLeave: jest.fn(),
};

function mockStore(overrides: { isPrivate?: boolean; myRole?: 'admin' | 'member'; archivedAt?: string | null }) {
  mockUseAlbumStore.mockImplementation((selector: (s: any) => unknown) =>
    selector({
      isPrivate: overrides.isPrivate ?? false,
      myRole: overrides.myRole ?? 'admin',
      archivedAt: overrides.archivedAt ?? null,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore({});
});

describe('AlbumMenuSheet — admin, active album', () => {
  it('shows rename, members, invite, archive, delete', () => {
    mockStore({ myRole: 'admin', archivedAt: null });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Đổi tên')).toBeTruthy();
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Mời thành viên')).toBeTruthy();
    expect(getByText('Lưu trữ album')).toBeTruthy();
    expect(getByText('Xóa album')).toBeTruthy();
  });

  it('hides invite for private album', () => {
    mockStore({ myRole: 'admin', isPrivate: true, archivedAt: null });
    const { queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(queryByText('Mời thành viên')).toBeNull();
  });

  it('calls onRename when Đổi tên is pressed', () => {
    mockStore({ myRole: 'admin' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Đổi tên'));
    expect(defaultProps.onRename).toHaveBeenCalledTimes(1);
  });

  it('calls onArchive when Lưu trữ album is pressed', () => {
    mockStore({ myRole: 'admin' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Lưu trữ album'));
    expect(defaultProps.onArchive).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Xóa album is pressed', () => {
    mockStore({ myRole: 'admin' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Xóa album'));
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('AlbumMenuSheet — admin, archived album', () => {
  it('shows only members and delete', () => {
    mockStore({ myRole: 'admin', archivedAt: '2026-06-10T00:00:00Z' });
    const { getByText, queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Xóa album')).toBeTruthy();
    expect(queryByText('Đổi tên')).toBeNull();
    expect(queryByText('Lưu trữ album')).toBeNull();
    expect(queryByText('Mời thành viên')).toBeNull();
  });
});

describe('AlbumMenuSheet — member', () => {
  it('shows members and leave album only', () => {
    mockStore({ myRole: 'member', archivedAt: null });
    const { getByText, queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Rời album')).toBeTruthy();
    expect(queryByText('Đổi tên')).toBeNull();
    expect(queryByText('Lưu trữ album')).toBeNull();
    expect(queryByText('Xóa album')).toBeNull();
  });

  it('calls onLeave when Rời album is pressed', () => {
    mockStore({ myRole: 'member' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Rời album'));
    expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest AlbumMenuSheet.test --no-coverage
```

Expected: failures because the current component doesn't have new props or role-awareness.

- [ ] **Step 3: Rewrite `AlbumMenuSheet.tsx`**

Replace the full contents of `mobile/src/components/family/AlbumMenuSheet.tsx`:

```tsx
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersThree, UserPlus, PencilSimple, Archive, Trash, SignOut } from 'phosphor-react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface AlbumMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onLeave: () => void;
}

export function AlbumMenuSheet({
  visible, onClose, onOpenMembers, onOpenInvite,
  onRename, onArchive, onDelete, onLeave,
}: AlbumMenuSheetProps) {
  const isPrivate   = useAlbumStore((s) => s.isPrivate);
  const myRole      = useAlbumStore((s) => s.myRole);
  const archivedAt  = useAlbumStore((s) => s.archivedAt);
  const isArchived  = archivedAt !== null;
  const isAdmin     = myRole === 'admin';

  return (
    <SheetModal visible={visible} onClose={onClose}>
      {isAdmin && !isArchived && (
        <MenuItem icon={<PencilSimple size={22} color={colors.ink} />} label={t('album_menu.rename')} onPress={onRename} />
      )}
      <MenuItem icon={<UsersThree size={22} color={colors.ink} />} label={t('album_menu.members')} onPress={onOpenMembers} />
      {isAdmin && !isPrivate && !isArchived && (
        <MenuItem icon={<UserPlus size={22} color={colors.ink} />} label={t('album_menu.invite')} onPress={onOpenInvite} />
      )}
      {!isAdmin && (
        <MenuItem icon={<SignOut size={22} color={colors.ink} />} label={t('album_menu.leave_album')} onPress={onLeave} />
      )}
      {isAdmin && !isArchived && (
        <MenuItem icon={<Archive size={22} color={colors.ink} />} label={t('album_menu.archive')} onPress={onArchive} />
      )}
      {isAdmin && (
        <MenuItem icon={<Trash size={22} color={colors.error} />} label={t('album_menu.delete_album')} onPress={onDelete} danger />
      )}
    </SheetModal>
  );
}

function MenuItem({ icon, label, onPress, danger }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  label:       { ...typography.body, color: colors.ink },
  dangerLabel: { color: colors.error },
});
```

Note: Check if `colors.danger` or `colors.red` exists in `mobile/src/constants/theme.ts`. If neither exists, use `'#E53E3E'` as the fallback (already in the code above).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest AlbumMenuSheet.test --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/family/AlbumMenuSheet.tsx mobile/src/components/family/AlbumMenuSheet.test.tsx
git commit -m "feat: make AlbumMenuSheet role-and-archive-aware"
```

---

### Task 10: Frontend — album detail screen (rename, archive, delete, leave, read-only banner)

**Files:**
- Modify: `mobile/app/albums/[id].tsx`

- [ ] **Step 1: Rewrite `app/albums/[id].tsx`**

Replace the full contents of `mobile/app/albums/[id].tsx`:

```tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, DotsThree, Archive } from 'phosphor-react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { DayCell } from '@/components/album/DayCell';
import { useAlbumDays, AlbumDay } from '@/hooks/useAlbumDays';
import { useAlbumStore } from '@/stores/albumStore';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
import { InviteSheet } from '@/components/family/InviteSheet';
import { MembersSheet } from '@/components/family/MembersSheet';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albumId    = useAlbumStore((s) => s.albumId);
  const albumName  = useAlbumStore((s) => s.albumName);
  const archivedAt = useAlbumStore((s) => s.archivedAt);
  const setAlbumName  = useAlbumStore((s) => s.setAlbumName);
  const setArchivedAt = useAlbumStore((s) => s.setArchivedAt);
  const { data: days, isLoading } = useAlbumDays(albumId ?? null);
  const qc = useQueryClient();

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [renameOpen,  setRenameOpen]  = useState(false);
  const [renameText,  setRenameText]  = useState('');
  const [renaming,    setRenaming]    = useState(false);

  const isArchived = archivedAt !== null;

  // Build pairs for 2-column masonry layout
  const pairs: Array<[AlbumDay, AlbumDay | undefined]> = [];
  if (days) {
    for (let i = 0; i < days.length; i += 2) {
      pairs.push([days[i], days[i + 1]]);
    }
  }

  async function handleRenameConfirm() {
    const name = renameText.trim();
    if (!name || !albumId) return;
    setRenaming(true);
    try {
      await api.patch(`/albums/${albumId}`, { name });
      setAlbumName(name);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      setRenameOpen(false);
    } catch {
      Alert.alert(t('common.error'), 'Không thể đổi tên album.');
    } finally {
      setRenaming(false);
    }
  }

  function handleArchivePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.archive'),
      t('album_menu.archive_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.archive'),
          onPress: async () => {
            try {
              const { data } = await api.post(`/albums/${albumId}/archive`);
              setArchivedAt(data.archived_at);
              await qc.invalidateQueries({ queryKey: ['albums'] });
            } catch {
              Alert.alert(t('common.error'), 'Không thể lưu trữ album.');
            }
          },
        },
      ]
    );
  }

  function handleDeletePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.delete_album'),
      t('album_menu.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.delete_album'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/albums/${albumId}`);
              await qc.invalidateQueries({ queryKey: ['albums'] });
              router.back();
            } catch {
              Alert.alert(t('common.error'), 'Không thể xóa album.');
            }
          },
        },
      ]
    );
  }

  function handleLeavePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.leave_album'),
      t('album_menu.leave_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.leave_album'),
          onPress: async () => {
            try {
              await api.delete(`/albums/${albumId}/members/me`);
              await qc.invalidateQueries({ queryKey: ['albums'] });
              router.back();
            } catch {
              Alert.alert(t('common.error'), 'Không thể rời album.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Rename modal */}
      <Modal visible={renameOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('album_menu.rename_title')}</Text>
            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRenameConfirm} disabled={renaming} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{renaming ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <CaretLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.backBtn}>
          <DotsThree size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {isArchived && (
        <View style={styles.archivedBanner}>
          <Archive size={14} color={colors.inkMuted} />
          <Text style={styles.archivedText}>{t('album_menu.archived_banner')}</Text>
        </View>
      )}

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

      <AlbumMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenMembers={() => { setMenuOpen(false); setMembersOpen(true); }}
        onOpenInvite={() =>  { setMenuOpen(false); setInviteOpen(true); }}
        onRename={() => {
          setMenuOpen(false);
          setRenameText(albumName ?? '');
          setRenameOpen(true);
        }}
        onArchive={handleArchivePress}
        onDelete={handleDeletePress}
        onLeave={handleLeavePress}
      />
      <InviteSheet  visible={inviteOpen}  onClose={() => setInviteOpen(false)} />
      <MembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  backBtn:        { width: 32 },
  title:          { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  archivedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.borderSoft },
  archivedText:   { ...typography.caption, color: colors.inkMuted },
  empty:          { ...typography.body, color: colors.inkMuted },
  emptySub:       { ...typography.caption, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
  grid:           { padding: spacing['2xl'], gap: spacing.sm },
  row:            { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard:      { backgroundColor: colors.white, borderRadius: 16, padding: spacing['2xl'], width: '80%', gap: spacing.lg },
  modalTitle:     { ...typography.title, color: colors.ink },
  input:          { ...typography.body, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:   { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:       { padding: spacing.sm },
  modalBtnCancel: { ...typography.body, color: colors.inkMuted },
  modalBtnConfirm:{ ...typography.body, color: colors.pink },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no new errors from these changes.

- [ ] **Step 4: Run full mobile test suite**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/albums/[id].tsx
git commit -m "feat: add rename/archive/delete/leave to album detail screen"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 2: Run full mobile test suite**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Build the backend**

```bash
cd backend && npm run build
```

Expected: no TypeScript errors, `dist/` updated.
