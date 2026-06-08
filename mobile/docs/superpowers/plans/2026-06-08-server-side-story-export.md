# Server-Side Story Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead `ffmpeg-kit-react-native` library with a backend `GET /stories/export` endpoint that compiles photos/videos into an MP4 using server-side FFmpeg, and update the mobile app to delegate to it.

**Architecture:** The backend installs `ffmpeg-static` (a self-contained pre-built ffmpeg binary) and adds a new `stories` route that fetches photos from R2, runs the same `filter_complex` pipeline (scale + pad + concat + libx264), and streams the resulting MP4 back. The mobile hook swaps its local FFmpeg calls for a single `FileSystem.downloadAsync` call to the new endpoint.

**Tech Stack:** Express + TypeScript, `ffmpeg-static`, `child_process.execFile`, `os.tmpdir` (backend); `expo-file-system`, `expo-media-library` (mobile)

---

### Task 1: Install `ffmpeg-static` on the backend

**Files:**
- Modify: `../backend/package.json`

- [ ] **Step 1: Install the package**

Run from the repo root (not the mobile directory):

```bash
cd ../backend && npm install ffmpeg-static && npm install --save-dev @types/ffmpeg-static
```

Expected: `ffmpeg-static` appears in `dependencies` in `../backend/package.json`. The package includes a pre-built binary for the host platform — no system FFmpeg required.

- [ ] **Step 2: Verify the binary path resolves**

```bash
node -e "const p = require('ffmpeg-static'); console.log(p);"
```

Expected: prints a path like `/path/to/node_modules/ffmpeg-static/ffmpeg` (not null).

- [ ] **Step 3: Commit**

```bash
cd ../backend && git add package.json package-lock.json
git commit -m "chore(backend): add ffmpeg-static for server-side video export"
```

---

### Task 2: Add `GET /stories/export` route

**Files:**
- Create: `../backend/src/routes/stories.ts`
- Create: `../backend/src/routes/stories.test.ts`
- Modify: `../backend/src/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `../backend/src/routes/stories.test.ts`:

```ts
jest.mock('../services/r2', () => ({
  getObjectBuffer: jest.fn(),
}));

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import request from 'supertest';
import fs from 'fs';
import { execFile } from 'child_process';
import { getObjectBuffer } from '../services/r2';
import { pool } from '../db';
import { db } from '../db';
import { photos, albumPhotos } from '../db/schema';
import { createTestUser, createTestAlbum, createTestAlbumMember, authHeader } from '../../tests/setup';

const app = require('../app');

const mockExecFile = execFile as jest.Mock;
const mockGetObjectBuffer = getObjectBuffer as jest.Mock;

// Minimal 1x1 WebP bytes so getObjectBuffer returns a valid image
const TINY_WEBP = Buffer.from(
  '52494646240000005745425056503820180000003001009d012a010001000034003457cc0000fef863' +
  '00fef8000000',
  'hex'
);

async function createTestPhoto(
  albumId: string,
  uploadedBy: string,
  mediaType: 'photo' | 'video' = 'photo'
) {
  const [photo] = await db
    .insert(photos)
    .values({
      albumId,
      uploadedBy,
      r2Key: `photos/test-${mediaType}.webp`,
      takenAt: new Date('2026-01-01T10:00:00Z'),
      mediaType,
      source: 'upload',
    })
    .returning();
  await db.insert(albumPhotos).values({ photoId: photo.id, albumId });
  return photo;
}

describe('GET /stories/export', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);

    mockGetObjectBuffer.mockResolvedValue(TINY_WEBP);

    // Mock execFile to write a fake MP4 at the output path (last arg)
    mockExecFile.mockImplementation((_bin: string, args: string[], cb: Function) => {
      const outputPath = args[args.length - 1];
      fs.writeFileSync(outputPath, Buffer.from('fake-mp4-bytes'));
      cb(null);
    });
  });

  it('returns 401 with no auth', async () => {
    const res = await request(app).get('/stories/export?photo_ids=irrelevant');
    expect(res.status).toBe(401);
  });

  it('returns 400 when photo_ids is missing', async () => {
    const res = await request(app).get('/stories/export').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo_ids/);
  });

  it('returns 400 when photo_ids is empty', async () => {
    const res = await request(app).get('/stories/export?photo_ids=').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo_ids/);
  });

  it('returns 400 when more than 30 photo_ids supplied', async () => {
    const ids = Array.from({ length: 31 }, () =>
      '00000000-0000-0000-0000-000000000000'
    ).join(',');
    const res = await request(app)
      .get(`/stories/export?photo_ids=${ids}`)
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/30/);
  });

  it('returns 400 when a photo_id is not a valid UUID', async () => {
    const res = await request(app)
      .get('/stories/export?photo_ids=not-a-uuid')
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/UUID/);
  });

  it('returns 403 when the user cannot access a photo', async () => {
    const other = await createTestUser({ apple_sub: 'other-sub' });
    const otherAlbum = await createTestAlbum(other.id);
    const photo = await createTestPhoto(otherAlbum.id, other.id);

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 200 video/mp4 for a single photo the user owns', async () => {
    const photo = await createTestPhoto(album.id, user.id);

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/video\/mp4/);
    expect(res.body).toBeTruthy();
  });

  it('returns 200 video/mp4 for a mix of photo and video types', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');
    const video = await createTestPhoto(album.id, user.id, 'video');

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id},${video.id}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/video\/mp4/);
  });

  it('returns 403 when user has access to some but not all photos', async () => {
    const photo = await createTestPhoto(album.id, user.id);
    const other = await createTestUser({ apple_sub: 'other2' });
    const otherAlbum = await createTestAlbum(other.id);
    const otherPhoto = await createTestPhoto(otherAlbum.id, other.id);

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id},${otherPhoto.id}`)
      .set(headers);

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ../backend && npx jest stories.test --no-coverage 2>&1 | tail -20
```

Expected: tests fail because the route doesn't exist yet (404s or module-not-found errors).

- [ ] **Step 3: Create `stories.ts`**

Create `../backend/src/routes/stories.ts`:

```ts
import express, { Request, Response, NextFunction } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import ffmpegPath from 'ffmpeg-static';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { photos, albumPhotos, albumMembers } from '../db/schema';
import { getObjectBuffer } from '../services/r2';
import { isValidUUID } from '../lib/validation';

const router = express.Router();
const execFileAsync = promisify(execFile);

router.use(requireAuth);

router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  const raw = req.query.photo_ids as string | undefined;

  if (!raw) {
    return res.status(400).json({ error: 'photo_ids query param is required' });
  }

  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({ error: 'photo_ids must not be empty' });
  }
  if (ids.length > 30) {
    return res.status(400).json({ error: 'photo_ids must contain at most 30 entries' });
  }
  if (!ids.every(isValidUUID)) {
    return res.status(400).json({ error: 'Every photo_id must be a valid UUID' });
  }

  // Fetch photos with their media type and r2 key
  const rows = await db
    .select({
      id: photos.id,
      r2Key: photos.r2Key,
      mediaType: photos.mediaType,
    })
    .from(photos)
    .where(inArray(photos.id, ids));

  if (rows.length !== ids.length) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Verify user has album membership for each photo
  const accessChecks = await db
    .select({ photoId: albumPhotos.photoId })
    .from(albumPhotos)
    .innerJoin(
      albumMembers,
      and(
        eq(albumMembers.albumId, albumPhotos.albumId),
        eq(albumMembers.userId, req.user!.id),
      ),
    )
    .where(inArray(albumPhotos.photoId, ids));

  const accessibleIds = new Set(accessChecks.map((r) => r.photoId));
  if (!ids.every((id) => accessibleIds.has(id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Build a map keyed by id to preserve the caller-specified order
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => rowById.get(id)!);

  const tempDir = path.join(os.tmpdir(), `story-export-${randomUUID()}`);
  fs.mkdirSync(tempDir);
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    // Download each asset from R2 into temp files
    const localPaths: { filePath: string; mediaType: string }[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const { r2Key, mediaType } = ordered[i];
      const ext = r2Key.split('.').pop() ?? 'webp';
      const filePath = path.join(tempDir, `${i.toString().padStart(3, '0')}.${ext}`);
      const buf = await getObjectBuffer(r2Key);
      fs.writeFileSync(filePath, buf);
      localPaths.push({ filePath, mediaType });
    }

    // Build FFmpeg arguments
    const ffArgs: string[] = [];
    for (const { filePath, mediaType } of localPaths) {
      if (mediaType === 'video') {
        ffArgs.push('-i', filePath);
      } else {
        ffArgs.push('-loop', '1', '-t', '3', '-i', filePath);
      }
    }

    const filterParts = localPaths.map((_, i) =>
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
      `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
    );
    const concatInputs = localPaths.map((_, i) => `[v${i}]`).join('');
    const filterComplex = [
      ...filterParts,
      `${concatInputs}concat=n=${localPaths.length}:v=1:a=0[out]`,
    ].join('; ');

    await execFileAsync(ffmpegPath!, [
      ...ffArgs,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-r', '30',
      '-an',
      '-y', outputPath,
    ]);

    const mp4 = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', mp4.length);
    res.send(mp4);
  } catch (err) {
    next(err);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

export = router;
```

- [ ] **Step 4: Register the route in `app.ts`**

Open `../backend/src/app.ts`. Add the import and `app.use` call alongside the other routes:

```ts
// After the existing imports (e.g. after albumDaysRoutes import):
import storiesRoutes from './routes/stories';
```

```ts
// After the existing app.use calls (e.g. after the album-days line):
app.use('/stories', storiesRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ../backend && npx jest stories.test --no-coverage 2>&1 | tail -20
```

Expected: all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
cd ../backend && git add src/routes/stories.ts src/routes/stories.test.ts src/app.ts
git commit -m "feat(backend): add GET /stories/export for server-side video compilation"
```

---

### Task 3: Rewrite `useStoryExport.ts` to call the backend

**Files:**
- Modify: `mobile/src/hooks/useStoryExport.ts`

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `mobile/src/hooks/useStoryExport.ts` with:

```ts
import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { success } from '@/lib/haptics';
import { DayPhoto } from './useDayPhotos';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function useStoryExport(photos: DayPhoto[], date: string) {
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
      const url = `${API_URL}/stories/export?photo_ids=${encodeURIComponent(photoIds)}`;

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: no errors referencing `useStoryExport.ts` or `ffmpeg-kit-react-native`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStoryExport.ts
git commit -m "feat(mobile): delegate story export to backend, drop local ffmpeg"
```

---

### Task 4: Remove `ffmpeg-kit-react-native` from the mobile project

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Uninstall the package**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npm uninstall ffmpeg-kit-react-native
```

Expected: `ffmpeg-kit-react-native` is removed from `package.json` and `node_modules`.

- [ ] **Step 2: Re-run pod install**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile/ios && pod install --repo-update 2>&1 | tail -20
```

Expected: pod install completes without attempting to download any `ffmpeg-kit` XCFramework. No 404 curl errors.

- [ ] **Step 3: Build the app**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx expo run:ios 2>&1 | tail -30
```

Expected: build succeeds and app launches on simulator.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock
git commit -m "chore(mobile): remove ffmpeg-kit-react-native (dead library, export moved to backend)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Backend FFmpeg endpoint: Task 2
- ✅ Mobile hook rewrite: Task 3
- ✅ Remove dead library: Task 4
- ✅ `ffmpeg-static` install: Task 1

**Placeholder scan:** None found — all steps include exact commands and complete code.

**Type consistency:**
- `DayPhoto` imported from `./useDayPhotos` — same as original hook, unchanged
- `getObjectBuffer`, `photos`, `albumPhotos`, `albumMembers` all use their established types from existing files
- `execFileAsync` is `promisify(execFile)` — standard Node pattern, correct signature
- `ffmpegPath` from `ffmpeg-static` typed as `string | null`; the `!` non-null assertion is acceptable since step 1 verifies it resolves to a non-null path on this platform
