# Share Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a download button to the story viewer that compiles all of a day's photos and videos into a single MP4 and saves it to the device camera roll.

**Architecture:** Backend adds `GET /photos/:id/full` and `GET /photos/:id/thumb` endpoints that stream R2 objects with auth/membership checks. A new `useStoryExport` hook on mobile downloads each item serially, runs `ffmpeg-kit-react-native` to compile a portrait MP4 via the concat demuxer, then saves to camera roll via `expo-media-library`. The story viewer's existing left-side placeholder becomes the download button.

**Tech Stack:** Node/Express/Drizzle (backend), Expo SDK 56 / React Native 0.85.3, `ffmpeg-kit-react-native`, `expo-file-system`, `expo-media-library` (mobile).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/routes/photos.ts` | Modify | Add GET `/photos/:id/full` and `/photos/:id/thumb` route handlers |
| `backend/src/routes/photos.test.ts` | Modify | Add tests for both new GET endpoints |
| `mobile/src/hooks/useStoryExport.ts` | Create | Download + ffmpeg compile + camera roll save hook |
| `mobile/app/story/[albumId]/[date].tsx` | Modify | Replace placeholder with download button wired to hook |
| `mobile/package.json` | Modify | Add `ffmpeg-kit-react-native` dependency |

---

## Task 1: Update r2 mock and write failing tests for GET /photos/:id/full

**Files:**
- Modify: `backend/src/routes/photos.test.ts`

- [ ] **Step 1: Update the jest.mock for r2 at the top of the file to also mock `getObjectBuffer`**

The current mock is on line 1:
```typescript
jest.mock('../services/r2', () => ({ getPresignedPutUrl: jest.fn() }));
```
Change it to:
```typescript
jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn(),
  getObjectBuffer: jest.fn(),
}));
```

- [ ] **Step 2: Add import and alias for `getObjectBuffer` after the existing mock imports (around line 10)**

After the existing:
```typescript
import { getPresignedPutUrl } from '../services/r2';
```
Add:
```typescript
import { getObjectBuffer } from '../services/r2';
const mockGetObjectBuffer = getObjectBuffer as jest.Mock;
```

- [ ] **Step 3: Append the following `describe` block to the end of the file (after the last closing `})`)**

```typescript
describe('GET /photos/:id/full', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser({ apple_sub: 'full-user' });
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/t.webp', width: 800, height: 600 });
    mockSendPush.mockResolvedValue(undefined);
    await createPresignToken(user.id, 'photos/img.webp');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], r2_key: 'photos/img.webp', taken_at: '2024-06-01T10:00:00Z' });
    photoId = res.body.id;
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('fake-image-bytes'));
  });

  it('returns 200 and streams the r2 object for a member', async () => {
    const res = await request(app).get(`/photos/${photoId}/full`).set(headers);
    expect(res.status).toBe(200);
    expect(mockGetObjectBuffer).toHaveBeenCalledWith('photos/img.webp');
  });

  it('returns 403 when user is not a member of any album containing the photo', async () => {
    const other = await createTestUser({ apple_sub: 'full-other' });
    const res = await request(app).get(`/photos/${photoId}/full`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a photo id that does not exist', async () => {
    const res = await request(app)
      .get('/photos/00000000-0000-0000-0000-000000000099/full')
      .set(headers);
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get(`/photos/${photoId}/full`);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run the new tests to confirm they fail**

```bash
cd backend && NODE_ENV=test npx jest --runInBand --forceExit --testPathPattern=photos.test -t "GET /photos/:id/full"
```

Expected: 3–4 failures with "Cannot GET /photos/..." or similar — the routes don't exist yet.

---

## Task 2: Implement GET /photos/:id/full

**Files:**
- Modify: `backend/src/routes/photos.ts`

- [ ] **Step 1: Add `getObjectBuffer` to the r2 import on line 6**

Change:
```typescript
import { getPresignedPutUrl } from '../services/r2';
```
To:
```typescript
import { getPresignedPutUrl, getObjectBuffer } from '../services/r2';
```

- [ ] **Step 2: Append the following route before the final `export = router;` line**

```typescript
router.get('/:id/full', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select({ r2Key: photos.r2Key, mediaType: photos.mediaType })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Not found' });

    const [member] = await db
      .select({ x: sql<number>`1` })
      .from(albumPhotos)
      .innerJoin(
        albumMembers,
        and(
          eq(albumMembers.albumId, albumPhotos.albumId),
          eq(albumMembers.userId, req.user!.id),
        ),
      )
      .where(eq(albumPhotos.photoId, photoId))
      .limit(1);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const ext = photo.r2Key.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'mp4' ? 'video/mp4' : ext === 'jpg' ? 'image/jpeg' : 'image/webp';

    const buffer = await getObjectBuffer(photo.r2Key);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Run the tests to confirm they pass**

```bash
cd backend && NODE_ENV=test npx jest --runInBand --forceExit --testPathPattern=photos.test -t "GET /photos/:id/full"
```

Expected: 4 passing.

- [ ] **Step 4: Run the full photos test suite to confirm no regressions**

```bash
cd backend && NODE_ENV=test npx jest --runInBand --forceExit --testPathPattern=photos.test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts
git commit -m "feat(backend): add GET /photos/:id/full endpoint"
```

---

## Task 3: Write failing tests for GET /photos/:id/thumb

**Files:**
- Modify: `backend/src/routes/photos.test.ts`

- [ ] **Step 1: Append the following `describe` block at the end of the file**

```typescript
describe('GET /photos/:id/thumb', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser({ apple_sub: 'thumb-user' });
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/t.webp', width: 800, height: 600 });
    mockSendPush.mockResolvedValue(undefined);
    await createPresignToken(user.id, 'photos/img.webp');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], r2_key: 'photos/img.webp', taken_at: '2024-06-01T10:00:00Z' });
    photoId = res.body.id;
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('fake-thumb-bytes'));
  });

  it('returns 200 and streams the thumbnail r2 object for a member', async () => {
    const res = await request(app).get(`/photos/${photoId}/thumb`).set(headers);
    expect(res.status).toBe(200);
    expect(mockGetObjectBuffer).toHaveBeenCalledWith('thumbnails/t.webp');
  });

  it('returns 403 when user is not a member', async () => {
    const other = await createTestUser({ apple_sub: 'thumb-other' });
    const res = await request(app).get(`/photos/${photoId}/thumb`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a photo id that does not exist', async () => {
    const res = await request(app)
      .get('/photos/00000000-0000-0000-0000-000000000099/thumb')
      .set(headers);
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get(`/photos/${photoId}/thumb`);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
cd backend && NODE_ENV=test npx jest --runInBand --forceExit --testPathPattern=photos.test -t "GET /photos/:id/thumb"
```

Expected: failures — route doesn't exist.

---

## Task 4: Implement GET /photos/:id/thumb

**Files:**
- Modify: `backend/src/routes/photos.ts`

- [ ] **Step 1: Append the following route before `export = router;`** (after the `/full` route)

```typescript
router.get('/:id/thumb', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.id;
    if (!isValidUUID(photoId)) return res.status(404).json({ error: 'Not found' });

    const [photo] = await db
      .select({ thumbnailKey: photos.thumbnailKey })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo || !photo.thumbnailKey) return res.status(404).json({ error: 'Not found' });

    const [member] = await db
      .select({ x: sql<number>`1` })
      .from(albumPhotos)
      .innerJoin(
        albumMembers,
        and(
          eq(albumMembers.albumId, albumPhotos.albumId),
          eq(albumMembers.userId, req.user!.id),
        ),
      )
      .where(eq(albumPhotos.photoId, photoId))
      .limit(1);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const buffer = await getObjectBuffer(photo.thumbnailKey);
    res.setHeader('Content-Type', 'image/webp');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Run the thumb tests to confirm they pass**

```bash
cd backend && NODE_ENV=test npx jest --runInBand --forceExit --testPathPattern=photos.test -t "GET /photos/:id/thumb"
```

Expected: 4 passing.

- [ ] **Step 3: Run the full backend test suite to confirm no regressions**

```bash
cd backend && NODE_ENV=test npx jest --runInBand --forceExit
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts
git commit -m "feat(backend): add GET /photos/:id/thumb endpoint"
```

---

## Task 5: Install ffmpeg-kit-react-native

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Install the package**

```bash
cd mobile && npm install ffmpeg-kit-react-native
```

Expected: package added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify the package is listed in package.json**

```bash
grep ffmpeg-kit mobile/package.json
```

Expected: `"ffmpeg-kit-react-native": "^X.Y.Z"` appears in dependencies.

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): add ffmpeg-kit-react-native"
```

> **Note:** `ffmpeg-kit-react-native` is a native module — it requires an EAS Build dev client to run (Expo Go will not work). The `eas.json` `development` profile already has `developmentClient: true`. After this task, run `eas build --profile development --platform ios` to rebuild the dev client before testing Task 6 and 7 on a device.

---

## Task 6: Implement useStoryExport hook

**Files:**
- Create: `mobile/src/hooks/useStoryExport.ts`

- [ ] **Step 1: Create the file with the following content**

```typescript
import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { useAuthStore } from '@/stores/authStore';
import { success } from '@/lib/haptics';
import { DayPhoto } from './useDayPhotos';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function useStoryExport(photos: DayPhoto[], date: string) {
  const [exporting, setExporting] = useState(false);

  async function exportStory() {
    setExporting(true);
    const tempDir = `${FileSystem.cacheDirectory}export_${date}/`;
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

      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const token = useAuthStore.getState().token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const localPaths: { path: string; mediaType: 'photo' | 'video' }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const ext = photo.media_type === 'video' ? 'mp4' : 'webp';
        const filename = `${i.toString().padStart(3, '0')}_${photo.id}.${ext}`;
        const localPath = `${tempDir}${filename}`;
        const result = await FileSystem.downloadAsync(
          `${API_URL}/photos/${photo.id}/full`,
          localPath,
          { headers },
        );
        if (result.status !== 200) throw new Error(`Download failed: ${photo.id}`);
        localPaths.push({ path: localPath, mediaType: photo.media_type });
      }

      const concatLines: string[] = [];
      for (const { path, mediaType } of localPaths) {
        concatLines.push(`file '${path}'`);
        if (mediaType === 'photo') concatLines.push('duration 3');
      }
      // Concat demuxer requires the last entry to have a duration to avoid a frozen final frame
      const last = localPaths[localPaths.length - 1];
      if (last.mediaType === 'video') {
        concatLines.push(`file '${last.path}'`);
        concatLines.push('duration 0.001');
      }
      const concatListPath = `${tempDir}concat.txt`;
      await FileSystem.writeAsStringAsync(concatListPath, concatLines.join('\n'));

      const session = await FFmpegKit.executeWithArguments([
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', '30',
        '-an',
        '-y', outputPath,
      ]);
      const returnCode = await session.getReturnCode();
      if (!ReturnCode.isSuccess(returnCode)) throw new Error('FFmpeg failed');

      await MediaLibrary.saveToLibraryAsync(outputPath);
      success();
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất video. Thử lại nhé.');
    } finally {
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
      setExporting(false);
    }
  }

  return { exporting, exportStory };
}
```

- [ ] **Step 2: Confirm TypeScript compiles without errors**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors referencing `useStoryExport.ts`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/useStoryExport.ts
git commit -m "feat(mobile): add useStoryExport hook for on-device story compilation"
```

---

## Task 7: Wire download button into story viewer

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`

- [ ] **Step 1: Add `ActivityIndicator` to the React Native import at the top of the file**

The current import (line 2–6):
```typescript
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  useWindowDimensions, ActivityIndicator,
} from 'react-native';
```
`ActivityIndicator` is already imported — no change needed here.

- [ ] **Step 2: Add the `useStoryExport` import after the existing hook imports (after line 14)**

```typescript
import { useStoryExport } from '@/hooks/useStoryExport';
```

- [ ] **Step 3: Call the hook inside `StoryScreen` — add this line after the existing `useState` calls (after line 121)**

```typescript
const { exporting, exportStory } = useStoryExport(photos ?? [], date);
```

- [ ] **Step 4: Replace the left placeholder in `topActions` with the download button**

Find this block (around line 183–188):
```tsx
<View style={styles.topActions}>
  <View style={{ width: 32 }} />
  <TouchableOpacity onPress={() => router.back()} testID="story-close">
    <Ionicons name="close" size={26} color={colors.white} />
  </TouchableOpacity>
</View>
```

Replace with:
```tsx
<View style={styles.topActions}>
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

- [ ] **Step 5: Confirm TypeScript compiles without errors**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run the existing story viewer tests to confirm they still pass**

```bash
cd mobile && npx jest --testPathPattern="story-vlog-overlay" --passWithNoTests
```

Expected: passing (the test renders the story screen and checks for VlogOverlay — the new button doesn't break this).

- [ ] **Step 7: Commit**

```bash
git add mobile/app/story/[albumId]/[date].tsx mobile/src/hooks/useStoryExport.ts
git commit -m "feat(mobile): add story export download button to story viewer"
```

---

## Manual Test Checklist

After rebuilding the dev client (`eas build --profile development --platform ios`):

- [ ] Open the story viewer for a day with at least one photo
- [ ] Confirm the download icon (arrow-down-circle-outline) appears top-left
- [ ] Tap the button → spinner appears, button disabled
- [ ] Wait for compilation (5–15s for a typical story) → spinner disappears
- [ ] Open iOS Photos app → confirm a new video exists with all photos/videos from the day
- [ ] Test a day with only photos (no videos) → confirm it still exports correctly
- [ ] Test a day with only videos → confirm it exports correctly
- [ ] Deny Photos permission → confirm alert appears in Vietnamese, no crash
- [ ] Kill the network during download → confirm error alert appears in Vietnamese, no crash
