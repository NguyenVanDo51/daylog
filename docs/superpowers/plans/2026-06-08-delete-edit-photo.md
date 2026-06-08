# Delete Photo & Edit Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to delete their own photos/videos and edit captions (allowing empty) from a new "Quản lý ngày" screen accessible via a pencil icon in the story viewer.

**Architecture:** Two new backend endpoints (`DELETE /photos/:id`, `PATCH /photos/:id`) with ownership checks; `uploaded_by` added to the day-photos API response; a new `manage.tsx` screen in the story route tree with optimistic delete and `onBlur` caption auto-save; a `usePhotoActions` hook for mutations.

**Tech Stack:** Express/Drizzle/PostgreSQL/Cloudflare R2 (backend), Expo Router v4/React Native/React Query v5/Zustand (mobile)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/r2.ts` | Modify | Add `deleteObject` |
| `backend/src/routes/photos.ts` | Modify | Add `DELETE /:id` and `PATCH /:id` handlers |
| `backend/src/routes/photos.test.ts` | Modify | Tests for new endpoints; update r2 mock; add `insertPhoto` helper |
| `backend/src/routes/album-days.ts` | Modify | Add `p.uploaded_by` to day-photos SQL |
| `backend/src/routes/album-days.test.ts` | Modify | Assert `uploaded_by` field in response |
| `mobile/src/hooks/useDayPhotos.ts` | Modify | Add `uploaded_by: string` to `DayPhoto` interface |
| `mobile/src/locales/vi.ts` | Modify | Add `manage` i18n namespace |
| `mobile/src/locales/en.ts` | Modify | Add `manage` i18n namespace (English) |
| `mobile/src/hooks/usePhotoActions.ts` | Create | `useDeletePhoto` + `useUpdateCaption` mutations |
| `mobile/app/story/[albumId]/[date].tsx` | Modify | Add `create-outline` icon → push manage route |
| `mobile/app/story/[albumId]/[date]/manage.tsx` | Create | Manage screen: list, inline note edit, delete |
| `mobile/app/__tests__/manage-day.test.tsx` | Create | Component tests for manage screen |
| `mobile/app/_layout.tsx` | Modify | Register `story/[albumId]/[date]/manage` in Stack |

---

### Task 1: Add `deleteObject` to R2 service

**Files:**
- Modify: `backend/src/services/r2.ts`

- [ ] **Step 1: Add `DeleteObjectCommand` import and `deleteObject` function**

Open `backend/src/services/r2.ts`. Change the AWS SDK import line to include `DeleteObjectCommand`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
```

Append this function at the end of the file (after `putObject`):

```typescript
export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/r2.ts
git commit -m "feat(backend): add deleteObject to R2 service"
```

---

### Task 2: Add `DELETE /photos/:id` endpoint + tests

**Files:**
- Modify: `backend/src/routes/photos.ts`
- Modify: `backend/src/routes/photos.test.ts`

- [ ] **Step 1: Update the r2 mock in `photos.test.ts` to include `deleteObject`**

Open `backend/src/routes/photos.test.ts`. The file starts with `jest.mock('../services/r2', ...)`. Replace that mock with:

```typescript
jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn(),
  getObjectBuffer: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 2: Add required imports to `photos.test.ts`**

After the existing imports at the top of `photos.test.ts`, add:

```typescript
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { photos, albumPhotos, albums } from '../db/schema';
import { deleteObject } from '../services/r2';
import { createTestAlbumMember } from '../../tests/setup';

const mockDeleteObject = deleteObject as jest.Mock;
```

- [ ] **Step 3: Add `insertPhoto` helper to `photos.test.ts`**

Add this helper function after the mock/import block, before the first `describe` block:

```typescript
async function insertPhoto(
  userId: string,
  albumId: string,
  opts: { takenAt?: string; thumbnailKey?: string } = {}
) {
  const [p] = await db
    .insert(photos)
    .values({
      albumId,
      uploadedBy: userId,
      r2Key: `photos/${Math.random()}.webp`,
      thumbnailKey: opts.thumbnailKey ?? `thumbnails/${Math.random()}.webp`,
      takenAt: new Date(opts.takenAt ?? '2026-05-21T10:00:00Z'),
      mediaType: 'photo',
      source: 'upload',
    })
    .returning();
  await db.insert(albumPhotos).values({ photoId: p.id, albumId });
  return p;
}
```

- [ ] **Step 4: Write failing tests for `DELETE /photos/:id`**

Append this `describe` block at the end of `photos.test.ts`:

```typescript
describe('DELETE /photos/:id', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it('returns 204 and deletes R2 objects', async () => {
    const photo = await insertPhoto(user.id, album.id, {
      thumbnailKey: 'thumbnails/thumb.webp',
    });

    const res = await request(app).delete(`/photos/${photo.id}`).set(headers);

    expect(res.status).toBe(204);
    expect(mockDeleteObject).toHaveBeenCalledWith(photo.r2Key);
    expect(mockDeleteObject).toHaveBeenCalledWith('thumbnails/thumb.webp');
  });

  it('returns 403 when user is not the uploader', async () => {
    const other = await createTestUser({ apple_sub: 'other-delete' });
    await createTestAlbumMember(album.id, other.id);
    const photo = await insertPhoto(user.id, album.id);

    const res = await request(app)
      .delete(`/photos/${photo.id}`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('returns 404 when photo does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app).delete(`/photos/${fakeId}`).set(headers);
    expect(res.status).toBe(404);
  });

  it('clears albums.cover_photo_id when deleted photo is the album cover', async () => {
    const photo = await insertPhoto(user.id, album.id);
    await db
      .update(albums)
      .set({ coverPhotoId: photo.id })
      .where(eq(albums.id, album.id));

    const res = await request(app).delete(`/photos/${photo.id}`).set(headers);
    expect(res.status).toBe(204);

    const [updated] = await db
      .select({ coverPhotoId: albums.coverPhotoId })
      .from(albums)
      .where(eq(albums.id, album.id));
    expect(updated.coverPhotoId).toBeNull();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd backend && npx jest src/routes/photos.test.ts --testNamePattern="DELETE /photos"
```

Expected: FAIL — "Cannot DELETE /photos/..." (route not found).

- [ ] **Step 6: Implement `DELETE /photos/:id`**

Open `backend/src/routes/photos.ts`.

Add `albums` to the schema imports line:

```typescript
import { users, albumMembers, photos, presignTokens, albumPhotos, albums } from '../db/schema';
```

Add `deleteObject` to the r2 imports line:

```typescript
import { getPresignedPutUrl, getObjectBuffer, deleteObject } from '../services/r2';
```

Add this route handler before `export = router;`:

```typescript
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id as string;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (photo.uploadedBy !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

    // Clear album cover reference before deleting — avoids FK orphan
    await db
      .update(albums)
      .set({ coverPhotoId: null })
      .where(eq(albums.coverPhotoId, photoId));

    // Delete DB record — cascades album_photos and reactions
    await db.delete(photos).where(eq(photos.id, photoId));

    // Delete R2 objects after DB delete succeeds
    await deleteObject(photo.r2Key);
    if (photo.thumbnailKey) await deleteObject(photo.thumbnailKey);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend && npx jest src/routes/photos.test.ts --testNamePattern="DELETE /photos"
```

Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts
git commit -m "feat(backend): add DELETE /photos/:id endpoint"
```

---

### Task 3: Add `PATCH /photos/:id` endpoint + tests

**Files:**
- Modify: `backend/src/routes/photos.ts`
- Modify: `backend/src/routes/photos.test.ts`

- [ ] **Step 1: Write failing tests**

Append this `describe` block at the end of `photos.test.ts`:

```typescript
describe('PATCH /photos/:id', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('updates caption and returns the photo', async () => {
    const photo = await insertPhoto(user.id, album.id);

    const res = await request(app)
      .patch(`/photos/${photo.id}`)
      .set(headers)
      .send({ caption: 'Bữa sáng gia đình' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(photo.id);
    expect(res.body.caption).toBe('Bữa sáng gia đình');
  });

  it('normalises empty string caption to null', async () => {
    const photo = await insertPhoto(user.id, album.id);

    const res = await request(app)
      .patch(`/photos/${photo.id}`)
      .set(headers)
      .send({ caption: '' });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBeNull();
  });

  it('sets caption to null when caption is null', async () => {
    const photo = await insertPhoto(user.id, album.id);

    const res = await request(app)
      .patch(`/photos/${photo.id}`)
      .set(headers)
      .send({ caption: null });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBeNull();
  });

  it('returns 403 when user is not the uploader', async () => {
    const other = await createTestUser({ apple_sub: 'other-patch' });
    await createTestAlbumMember(album.id, other.id);
    const photo = await insertPhoto(user.id, album.id);

    const res = await request(app)
      .patch(`/photos/${photo.id}`)
      .set(authHeader(other))
      .send({ caption: 'should fail' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when photo does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000002';
    const res = await request(app)
      .patch(`/photos/${fakeId}`)
      .set(headers)
      .send({ caption: 'test' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest src/routes/photos.test.ts --testNamePattern="PATCH /photos"
```

Expected: FAIL — "Cannot PATCH /photos/..." (route not found).

- [ ] **Step 3: Implement `PATCH /photos/:id`**

Add this route handler to `backend/src/routes/photos.ts`, before `export = router;`:

```typescript
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id as string;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (photo.uploadedBy !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

    const { caption } = req.body ?? {};
    // Empty string → null; any non-empty string → keep as-is; null/undefined → null
    const newCaption = (typeof caption === 'string' && caption.length > 0) ? caption : null;

    const [updated] = await db
      .update(photos)
      .set({ caption: newCaption })
      .where(eq(photos.id, photoId))
      .returning();

    return res.json(toSnakePhoto(updated));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest src/routes/photos.test.ts --testNamePattern="PATCH /photos"
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run full backend test suite**

```bash
cd backend && npx jest
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts
git commit -m "feat(backend): add PATCH /photos/:id endpoint"
```

---

### Task 4: Add `uploaded_by` to day photos API response

**Files:**
- Modify: `backend/src/routes/album-days.ts`
- Modify: `backend/src/routes/album-days.test.ts`

- [ ] **Step 1: Write a failing test**

Open `backend/src/routes/album-days.test.ts`. Inside the `describe('GET /albums/:id/days/:date/photos'` block, add this test:

```typescript
it('returns uploaded_by for each photo', async () => {
  await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });

  const res = await request(app)
    .get(`/albums/${album.id}/days/2026-05-21/photos`)
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body[0].uploaded_by).toBe(user.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/routes/album-days.test.ts --testNamePattern="uploaded_by"
```

Expected: FAIL — `uploaded_by` is `undefined`.

- [ ] **Step 3: Update the SQL in `album-days.ts`**

Open `backend/src/routes/album-days.ts`. Find the `GET /:date/photos` handler and replace the SQL query body with:

```typescript
const rows = await db.execute(sql`
  SELECT p.id, p.media_type, p.duration_ms,
         to_char(p.taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS taken_at,
         p.caption,
         p.uploaded_by
  FROM photos p
  JOIN album_photos ap ON ap.photo_id = p.id
  WHERE ap.album_id = ${albumId}::uuid
    AND DATE(p.taken_at AT TIME ZONE 'UTC') = ${date}::date
  ORDER BY p.taken_at ASC
`);
```

- [ ] **Step 4: Run full album-days test suite to verify all pass**

```bash
cd backend && npx jest src/routes/album-days.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/album-days.ts backend/src/routes/album-days.test.ts
git commit -m "feat(backend): expose uploaded_by in day photos endpoint"
```

---

### Task 5: Update `DayPhoto` interface and add i18n strings

**Files:**
- Modify: `mobile/src/hooks/useDayPhotos.ts`
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Update `DayPhoto` interface**

Open `mobile/src/hooks/useDayPhotos.ts`. Update the `DayPhoto` interface to add `uploaded_by`:

```typescript
export interface DayPhoto {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
  caption: string | null;
  uploaded_by: string;
}
```

- [ ] **Step 2: Add Vietnamese strings**

Open `mobile/src/locales/vi.ts`. Before the final `};`, add:

```typescript
  manage: {
    title:                'Quản lý ngày {{date}}',
    note_ph:              'Thêm ghi chú...',
    delete_confirm_title: 'Xoá ảnh?',
    delete_confirm_body:  'Ảnh sẽ bị xoá vĩnh viễn.',
    delete:               'Xoá',
    cancel:               'Huỷ',
    save_error:           'Không thể lưu ghi chú',
    delete_error:         'Không thể xoá ảnh',
  },
```

- [ ] **Step 3: Add English strings**

Open `mobile/src/locales/en.ts`. Before the final `};`, add:

```typescript
  manage: {
    title:                'Manage day {{date}}',
    note_ph:              'Add a note...',
    delete_confirm_title: 'Delete photo?',
    delete_confirm_body:  'This photo will be permanently deleted.',
    delete:               'Delete',
    cancel:               'Cancel',
    save_error:           'Could not save note',
    delete_error:         'Could not delete photo',
  },
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/hooks/useDayPhotos.ts mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat(mobile): add DayPhoto.uploaded_by and manage i18n strings"
```

---

### Task 6: Create `usePhotoActions` hook

**Files:**
- Create: `mobile/src/hooks/usePhotoActions.ts`

- [ ] **Step 1: Create the hook file**

Create `mobile/src/hooks/usePhotoActions.ts` with this content:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeletePhoto(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/photos/${photoId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-photos', albumId, date] });
      qc.invalidateQueries({ queryKey: ['album-days', albumId] });
    },
  });
}

export function useUpdateCaption(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      photoId,
      caption,
    }: {
      photoId: string;
      caption: string | null;
    }) => {
      const { data } = await api.patch(`/photos/${photoId}`, { caption });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-photos', albumId, date] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/usePhotoActions.ts
git commit -m "feat(mobile): add useDeletePhoto and useUpdateCaption hooks"
```

---

### Task 7: Add manage button to story viewer + register route

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Add pencil icon to `topActions` in the story viewer**

Open `mobile/app/story/[albumId]/[date].tsx`. Find the `<View style={styles.topActions}>` block, which currently contains the export button and close button. Replace the entire `topActions` View with:

```tsx
<View style={styles.topActions}>
  <TouchableOpacity
    onPress={() => router.push(`/story/${albumId}/${date}/manage` as any)}
    testID="story-manage"
  >
    <Ionicons name="create-outline" size={26} color={colors.white} />
  </TouchableOpacity>
  {exporting ? (
    <ActivityIndicator color={colors.white} size="small" style={{ width: 32 }} />
  ) : (
    <TouchableOpacity onPress={exportStory} testID="story-export" disabled={exporting}>
      <Ionicons name="arrow-down-circle-outline" size={26} color={colors.white} />
    </TouchableOpacity>
  )}
  <TouchableOpacity onPress={() => router.back()} testID="story-close">
    <Ionicons name="close" size={26} color={colors.white} />
  </TouchableOpacity>
</View>
```

- [ ] **Step 2: Register the manage route in `_layout.tsx`**

Open `mobile/app/_layout.tsx`. Find the story `Stack.Screen` line:

```tsx
<Stack.Screen name="story/[albumId]/[date]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
```

Add the manage route immediately after it:

```tsx
<Stack.Screen
  name="story/[albumId]/[date]/manage"
  options={{ headerShown: false, presentation: 'modal' }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/story/[albumId]/[date].tsx" mobile/app/_layout.tsx
git commit -m "feat(mobile): add manage button to story viewer"
```

---

### Task 8: Create manage screen + tests

**Files:**
- Create: `mobile/app/story/[albumId]/[date]/manage.tsx`
- Create: `mobile/app/__tests__/manage-day.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/app/__tests__/manage-day.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Ionicons: React.forwardRef((props: any, ref: any) =>
      React.createElement(View, { ...props, ref, testID: props.testID ?? props.name }),
    ),
  };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ albumId: 'album-1', date: '2026-06-08' })),
  router: { back: jest.fn(), push: jest.fn() },
}));

const mockDeleteMutate = jest.fn().mockResolvedValue(undefined);
const mockUpdateMutate = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/usePhotoActions', () => ({
  useDeletePhoto: jest.fn(() => ({ mutateAsync: mockDeleteMutate })),
  useUpdateCaption: jest.fn(() => ({ mutateAsync: mockUpdateMutate })),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({
      token: 'tok',
      user: { id: 'user-1', display_name: 'Me', email: 'me@test.com', avatar_url: null },
    })
  ),
}));

jest.mock('@/hooks/useDayPhotos', () => ({
  useDayPhotos: jest.fn(() => ({
    data: [
      {
        id: 'photo-1',
        media_type: 'photo',
        duration_ms: null,
        taken_at: '2026-06-08T08:00:00.000Z',
        caption: 'Sáng sớm',
        uploaded_by: 'user-1',
      },
      {
        id: 'photo-2',
        media_type: 'photo',
        duration_ms: null,
        taken_at: '2026-06-08T12:00:00.000Z',
        caption: null,
        uploaded_by: 'user-2',
      },
    ],
    isLoading: false,
  })),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/lib/i18n', () => ({
  t: (key: string, params?: any) => {
    const map: Record<string, string> = {
      'manage.title':                'Quản lý ngày {{date}}',
      'manage.note_ph':              'Thêm ghi chú...',
      'manage.delete_confirm_title': 'Xoá ảnh?',
      'manage.delete_confirm_body':  'Ảnh sẽ bị xoá vĩnh viễn.',
      'manage.delete':               'Xoá',
      'manage.cancel':               'Huỷ',
      'manage.save_error':           'Không thể lưu ghi chú',
      'manage.delete_error':         'Không thể xoá ảnh',
    };
    let str = map[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{{${k}}}`, String(v));
      });
    }
    return str;
  },
}));

import { router } from 'expo-router';
import { useDayPhotos } from '@/hooks/useDayPhotos';
import ManageScreen from '../story/[albumId]/[date]/manage';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ManageScreen', () => {
  it('renders a list item for each photo', () => {
    const { getAllByTestId } = render(<ManageScreen />);
    expect(getAllByTestId(/^manage-item-/)).toHaveLength(2);
  });

  it('shows delete button only for photos uploaded by current user', () => {
    const { getByTestId, queryByTestId } = render(<ManageScreen />);
    expect(getByTestId('delete-photo-1')).toBeTruthy();
    expect(queryByTestId('delete-photo-2')).toBeNull();
  });

  it('shows editable note input for own photo, read-only text for others', () => {
    const { getByTestId, queryByTestId } = render(<ManageScreen />);
    expect(getByTestId('note-input-photo-1')).toBeTruthy();
    expect(queryByTestId('note-input-photo-2')).toBeNull();
    expect(getByTestId('note-readonly-photo-2')).toBeTruthy();
  });

  it('shows confirmation Alert on delete press', () => {
    const spy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<ManageScreen />);
    fireEvent.press(getByTestId('delete-photo-1'));
    expect(spy).toHaveBeenCalledWith(
      'Xoá ảnh?',
      'Ảnh sẽ bị xoá vĩnh viễn.',
      expect.any(Array)
    );
  });

  it('navigates back when last remaining photo is deleted', async () => {
    (useDayPhotos as jest.Mock).mockReturnValueOnce({
      data: [{
        id: 'photo-1',
        media_type: 'photo',
        duration_ms: null,
        taken_at: '2026-06-08T08:00:00.000Z',
        caption: null,
        uploaded_by: 'user-1',
      }],
      isLoading: false,
    });

    const spy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<ManageScreen />);
    fireEvent.press(getByTestId('delete-photo-1'));

    const buttons = (spy.mock.calls[0] as any[])[2] as Array<{ text: string; onPress?: () => Promise<void> }>;
    const deleteBtn = buttons.find((b) => b.text === 'Xoá');
    await deleteBtn!.onPress!();

    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest app/__tests__/manage-day.test.tsx
```

Expected: FAIL — `Cannot find module '../story/[albumId]/[date]/manage'`.

- [ ] **Step 3: Create the manage screen directory and file**

Create directory `mobile/app/story/[albumId]/[date]/` then create `manage.tsx` inside it:

```tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function ManageScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();
  const { data: serverPhotos } = useDayPhotos(albumId ?? null, date ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const deletePhoto = useDeletePhoto(albumId!, date!);
  const updateCaption = useUpdateCaption(albumId!, date!);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const photos = (serverPhotos ?? []).filter((p) => !deletedIds.has(p.id));

  const parts = (date ?? '').split('-');
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : (date ?? '');

  function getCaptionValue(photo: DayPhoto): string {
    return photo.id in captions ? captions[photo.id] : (photo.caption ?? '');
  }

  async function handleCaptionBlur(photo: DayPhoto) {
    const newVal = getCaptionValue(photo);
    if (newVal === (photo.caption ?? '')) return;
    const captionToSave = newVal.trim() === '' ? null : newVal.trim();
    try {
      await updateCaption.mutateAsync({ photoId: photo.id, caption: captionToSave });
    } catch {
      Alert.alert('', t('manage.save_error'));
    }
  }

  function handleDelete(photo: DayPhoto, remainingCount: number) {
    Alert.alert(
      t('manage.delete_confirm_title'),
      t('manage.delete_confirm_body'),
      [
        { text: t('manage.cancel'), style: 'cancel' },
        {
          text: t('manage.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletedIds((prev) => new Set([...prev, photo.id]));
            try {
              await deletePhoto.mutateAsync(photo.id);
              if (remainingCount === 1) router.back();
            } catch {
              setDeletedIds((prev) => {
                const next = new Set(prev);
                next.delete(photo.id);
                return next;
              });
              Alert.alert('', t('manage.delete_error'));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('manage.title', { date: dateLabel })}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: photo }) => {
          const isOwner = photo.uploaded_by === currentUserId;
          return (
            <View style={styles.item} testID={`manage-item-${photo.id}`}>
              <Image
                source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
                style={styles.thumb}
              />
              <View style={styles.itemContent}>
                {isOwner ? (
                  <TextInput
                    testID={`note-input-${photo.id}`}
                    style={styles.noteInput}
                    value={getCaptionValue(photo)}
                    onChangeText={(v) =>
                      setCaptions((prev) => ({ ...prev, [photo.id]: v }))
                    }
                    onBlur={() => handleCaptionBlur(photo)}
                    placeholder={t('manage.note_ph')}
                    placeholderTextColor={colors.inkMuted}
                    multiline
                    maxLength={200}
                  />
                ) : (
                  <Text testID={`note-readonly-${photo.id}`} style={styles.noteReadOnly}>
                    {photo.caption ?? ''}
                  </Text>
                )}
              </View>
              {isOwner && (
                <TouchableOpacity
                  testID={`delete-${photo.id}`}
                  onPress={() => handleDelete(photo, photos.length)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.inkMuted} />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  backBtn:      { width: 32 },
  title:        { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  list:         { padding: spacing.lg, gap: spacing.md },
  item:         { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.white, borderRadius: 10, padding: spacing.md },
  thumb:        { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.borderSoft },
  itemContent:  { flex: 1 },
  noteInput:    { ...typography.body, color: colors.ink, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 48, textAlignVertical: 'top' },
  noteReadOnly: { ...typography.body, color: colors.inkMuted },
  deleteBtn:    { alignSelf: 'center' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest app/__tests__/manage-day.test.tsx
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run full mobile test suite**

```bash
cd mobile && npx jest
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/story/[albumId]/[date]/manage.tsx" mobile/app/__tests__/manage-day.test.tsx
git commit -m "feat(mobile): add day manage screen with delete and edit note"
```
