# Background Upload UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the photo/video upload in the background as soon as the preview screen appears, so "Lưu lại" feels instant (loading only shows if the network is still busy).

**Architecture:** Split `capture()` into Phase 1 (`startBackgroundUpload` — presign + compress + PUT, with 3-attempt retry) that runs on preview mount, and Phase 2 (`finishCapture` — POST /photos) that runs only when the user taps Save. The preview screen awaits the background promise on Save; loading state is a local `saving` flag, not from the hook.

**Tech Stack:** Express/TypeScript (backend), React Native / Expo, React Query, Zustand, expo-file-system, expo-video-thumbnails

---

## File Map

| File | Change |
|---|---|
| `backend/src/routes/photos.ts` | Make `album_id` optional in presign handler |
| `backend/src/routes/photos.test.ts` | Update "album_id missing → 400" test; add "no album_id → 200" test |
| `mobile/src/hooks/useCapture.ts` | Replace `capture()` with `startBackgroundUpload()` + `finishCapture()` |
| `mobile/src/hooks/useCapture.test.ts` | Rewrite for the new API |
| `mobile/app/photo-review.tsx` | Trigger background upload on mount; await on Save |
| `mobile/app/__tests__/photo-review.test.tsx` | Update mocks and assertions for new hook API |

---

## Task 1: Backend — make `album_id` optional in presign

**Files:**
- Modify: `backend/src/routes/photos.ts:47-67`
- Modify: `backend/src/routes/photos.test.ts:53-61`

- [ ] **Step 1: Update the failing test (album_id missing → now expect 200)**

In `backend/src/routes/photos.test.ts`, replace the test at line 53:

```ts
// BEFORE
it('returns 400 when album_id is missing', async () => {
  const res = await request(app)
    .post('/photos/presign')
    .set(headers)
    .send({});
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/album_id required/);
});

// AFTER
it('returns presigned URL when album_id is omitted', async () => {
  const res = await request(app)
    .post('/photos/presign')
    .set(headers)
    .send({});
  expect(res.status).toBe(200);
  expect(res.body.url).toBe('https://r2.example.com/presigned');
  expect(res.body.key).toBe('photos/abc.webp');
});
```

- [ ] **Step 2: Run that test to confirm it fails**

```bash
cd backend && NODE_ENV=test jest --runInBand --forceExit -t "returns presigned URL when album_id is omitted"
```

Expected: FAIL (still returns 400)

- [ ] **Step 3: Update the presign handler**

In `backend/src/routes/photos.ts`, replace lines 47–67:

```ts
router.post('/presign', presignLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { album_id, content_type = 'image/webp' } = req.body ?? {};
    if (album_id) {
      if (!isValidUUID(album_id)) {
        return res.status(400).json({ error: 'album_id must be a valid UUID' });
      }
      if (!(await requireMember(album_id, req.user!.id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(content_type)) {
      return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` });
    }
    const { url, key } = await getPresignedPutUrl(content_type as AllowedContentType);
    await db.insert(presignTokens).values({ key, userId: req.user!.id });
    return res.json({ url, key });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run the full presign test suite**

```bash
cd backend && NODE_ENV=test jest --runInBand --forceExit -t "POST /photos/presign"
```

Expected: all PASS (the old "valid UUID" and "403 forbidden" tests still pass because they send an album_id)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.ts backend/src/routes/photos.test.ts
git commit -m "feat(backend): make album_id optional in presign endpoint"
```

---

## Task 2: Rewrite `useCapture` hook

**Files:**
- Modify: `mobile/src/hooks/useCapture.ts`
- Modify: `mobile/src/hooks/useCapture.test.ts`

- [ ] **Step 1: Rewrite the test file**

Replace all content in `mobile/src/hooks/useCapture.test.ts`:

```ts
jest.mock('@/lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('@/lib/compression', () => ({ compressToWebP: jest.fn().mockResolvedValue('file:///compressed.webp') }));
jest.mock('@/lib/uploadFile', () => ({ putLocalFile: jest.fn().mockResolvedValue(1024) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('expo-video-thumbnails', () => ({ getThumbnailAsync: jest.fn().mockResolvedValue({ uri: 'file:///thumb.jpg' }) }), { virtual: true });

import { renderHook, act } from '@testing-library/react-native';
import { useCapture, type UploadResult } from './useCapture';
import { api } from '@/lib/api';
import { putLocalFile } from '@/lib/uploadFile';

const mockApi = api as jest.Mocked<typeof api>;
const mockPut = putLocalFile as jest.MockedFunction<typeof putLocalFile>;

const photoAsset = {
  uri: 'file:///photo.jpg',
  type: 'photo' as const,
  source: 'camera' as const,
  takenAt: '2026-05-21T10:00:00Z',
};

const videoAsset = {
  uri: 'file:///video.mp4',
  type: 'video' as const,
  source: 'camera' as const,
  takenAt: '2026-05-21T10:00:00Z',
  durationMs: 4200,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
});
afterEach(() => jest.restoreAllMocks());

describe('startBackgroundUpload — photo', () => {
  it('presigns without album_id, compresses, uploads, returns r2Key', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { url: 'https://r2/put', key: 'photos/abc.webp' } });
    const { result } = renderHook(() => useCapture());
    let uploadResult: UploadResult | undefined;
    await act(async () => {
      uploadResult = await result.current.startBackgroundUpload(photoAsset);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { content_type: 'image/webp' });
    expect(uploadResult).toEqual({ r2Key: 'photos/abc.webp' });
  });

  it('retries up to 3 times on failure then throws', async () => {
    mockApi.post.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await expect(result.current.startBackgroundUpload(photoAsset)).rejects.toThrow('network');
    });
    expect(mockApi.post).toHaveBeenCalledTimes(3);
  });

  it('resolves on second attempt after one transient failure', async () => {
    mockApi.post
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ data: { url: 'https://r2/put', key: 'photos/retry.webp' } });
    const { result } = renderHook(() => useCapture());
    let uploadResult: UploadResult | undefined;
    await act(async () => {
      uploadResult = await result.current.startBackgroundUpload(photoAsset);
    });
    expect(mockApi.post).toHaveBeenCalledTimes(2);
    expect(uploadResult).toEqual({ r2Key: 'photos/retry.webp' });
  });
});

describe('startBackgroundUpload — video', () => {
  it('presigns video and thumbnail in parallel, uploads both, returns r2Key and thumbnailR2Key', async () => {
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://r2/video', key: 'photos/vid.mp4' } })
      .mockResolvedValueOnce({ data: { url: 'https://r2/thumb', key: 'photos/thumb.jpeg' } });
    const { result } = renderHook(() => useCapture());
    let uploadResult: UploadResult | undefined;
    await act(async () => {
      uploadResult = await result.current.startBackgroundUpload(videoAsset);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { content_type: 'video/mp4' });
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { content_type: 'image/jpeg' });
    expect(mockPut).toHaveBeenCalledWith('https://r2/video', 'file:///video.mp4', 'video/mp4');
    expect(mockPut).toHaveBeenCalledWith('https://r2/thumb', 'file:///thumb.jpg', 'image/jpeg');
    expect(uploadResult).toEqual({ r2Key: 'photos/vid.mp4', thumbnailR2Key: 'photos/thumb.jpeg' });
  });
});

describe('finishCapture', () => {
  it('posts /photos with r2Key, albumIds, and photo metadata', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'photo-1' } });
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.finishCapture({ r2Key: 'photos/abc.webp' }, photoAsset, ['album-1', 'album-2']);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos', expect.objectContaining({
      album_ids: ['album-1', 'album-2'],
      r2_key: 'photos/abc.webp',
      media_type: 'photo',
      source: 'capture',
    }));
  });

  it('includes thumbnail_r2_key and duration_ms for video', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'photo-2' } });
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.finishCapture(
        { r2Key: 'photos/vid.mp4', thumbnailR2Key: 'photos/thumb.jpeg' },
        videoAsset,
        ['album-1'],
      );
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos', expect.objectContaining({
      media_type: 'video',
      thumbnail_r2_key: 'photos/thumb.jpeg',
      duration_ms: 4200,
    }));
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd mobile && jest src/hooks/useCapture.test.ts
```

Expected: FAIL (old `capture` / `canCapture` API, `startBackgroundUpload` not found)

- [ ] **Step 3: Rewrite `useCapture.ts`**

Replace all content in `mobile/src/hooks/useCapture.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { putLocalFile } from '@/lib/uploadFile';
import type { ReviewAsset } from '@/stores/photoReviewStore';

export interface UploadResult {
  r2Key: string;
  thumbnailR2Key?: string;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export function useCapture() {
  const qc = useQueryClient();

  async function extractVideoThumbnail(videoUri: string): Promise<string> {
    try {
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const { uri } = await getThumbnailAsync(videoUri, { time: 0 });
      return uri;
    } catch {
      return videoUri;
    }
  }

  async function startBackgroundUpload(asset: ReviewAsset): Promise<UploadResult> {
    return withRetry(async () => {
      if (asset.type === 'photo') {
        const { data: presign } = await api.post('/photos/presign', { content_type: 'image/webp' });
        const compressedUri = await compressToWebP(asset.uri);
        await putLocalFile(presign.url, compressedUri, 'image/webp');
        return { r2Key: presign.key };
      }
      const thumbUri = await extractVideoThumbnail(asset.uri);
      const [videoPresign, thumbPresign] = await Promise.all([
        api.post('/photos/presign', { content_type: 'video/mp4' }),
        api.post('/photos/presign', { content_type: 'image/jpeg' }),
      ]);
      await Promise.all([
        putLocalFile(videoPresign.data.url, asset.uri, 'video/mp4'),
        putLocalFile(thumbPresign.data.url, thumbUri, 'image/jpeg'),
      ]);
      return { r2Key: videoPresign.data.key, thumbnailR2Key: thumbPresign.data.key };
    });
  }

  async function finishCapture(result: UploadResult, asset: ReviewAsset, albumIds: string[]): Promise<void> {
    await api.post('/photos', {
      album_ids: albumIds,
      r2_key: result.r2Key,
      taken_at: asset.takenAt ?? new Date().toISOString(),
      source: 'capture',
      media_type: asset.type === 'video' ? 'video' : 'photo',
      ...(result.thumbnailR2Key ? { thumbnail_r2_key: result.thumbnailR2Key } : {}),
      ...(asset.durationMs ? { duration_ms: asset.durationMs } : {}),
    });
    albumIds.forEach((id) => qc.invalidateQueries({ queryKey: ['album-days', id] }));
  }

  return { startBackgroundUpload, finishCapture };
}
```

- [ ] **Step 4: Run the hook tests**

```bash
cd mobile && jest src/hooks/useCapture.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useCapture.ts mobile/src/hooks/useCapture.test.ts
git commit -m "feat(mobile): split useCapture into startBackgroundUpload + finishCapture with retry"
```

---

## Task 3: Update `photo-review` screen and tests

**Files:**
- Modify: `mobile/app/photo-review.tsx`
- Modify: `mobile/app/__tests__/photo-review.test.tsx`

- [ ] **Step 1: Rewrite the photo-review test file**

Replace all content in `mobile/app/__tests__/photo-review.test.tsx`:

```tsx
import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, { ...props, ref, testID: props.testID ?? label }),
    );
  return { Ionicons: makeIcon('Ionicons') };
});

const mockStartBackgroundUpload = jest.fn();
const mockFinishCapture = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/useCapture', () => ({
  useCapture: jest.fn(() => ({
    startBackgroundUpload: mockStartBackgroundUpload,
    finishCapture: mockFinishCapture,
  })),
}));

jest.mock('@/hooks/useAlbums', () => ({
  useAlbums: jest.fn(() => ({
    data: [
      { id: 'album-1', name: 'Gia đình', is_private: false, cover_photo_id: null },
      { id: 'album-2', name: 'Bạn bè', is_private: false, cover_photo_id: null },
    ],
  })),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn(), success: jest.fn() }));

jest.mock('@/components/ui/Confetti', () => {
  const React = require('react');
  return { Confetti: () => React.createElement('View', { testID: 'confetti' }) };
});

jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ label, onPress, disabled, testID }: any) =>
      React.createElement(TouchableOpacity, { testID: testID ?? 'button', onPress, disabled },
        React.createElement(Text, null, label)),
  };
});

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({ loop: false, muted: false, play: jest.fn() })),
}));

import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { router } from 'expo-router';
import PhotoReviewScreen from '../photo-review';

const photoAsset = {
  uri: 'file:///photo.jpg',
  type: 'photo' as const,
  source: 'camera' as const,
  takenAt: '2026-05-21T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  usePhotoReviewStore.setState({ assets: [photoAsset] });
  // background upload resolves immediately by default
  mockStartBackgroundUpload.mockResolvedValue({ r2Key: 'photos/abc.webp' });
});

describe('PhotoReview', () => {
  it('starts background upload on mount', () => {
    render(<PhotoReviewScreen />);
    expect(mockStartBackgroundUpload).toHaveBeenCalledWith(photoAsset);
  });

  it('shows album checkboxes', () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    expect(getByTestId('album-checkbox-album-1')).toBeTruthy();
    expect(getByTestId('album-checkbox-album-2')).toBeTruthy();
  });

  it('save button disabled until album selected', () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    const saveBtn = getByTestId('review-save');
    const isDisabled = saveBtn.props.disabled ?? saveBtn.props.accessibilityState?.disabled;
    expect(isDisabled).toBeTruthy();
  });

  it('pressing save calls finishCapture with selected album ids', async () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('album-checkbox-album-1'));
    fireEvent.press(getByTestId('album-checkbox-album-2'));
    await act(async () => { fireEvent.press(getByTestId('review-save')); });
    expect(mockFinishCapture).toHaveBeenCalledWith(
      { r2Key: 'photos/abc.webp' },
      photoAsset,
      expect.arrayContaining(['album-1', 'album-2']),
    );
  });

  it('shows error alert when background upload failed after retries', async () => {
    mockStartBackgroundUpload.mockRejectedValue(new Error('upload failed'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('album-checkbox-album-1'));
    await act(async () => { fireEvent.press(getByTestId('review-save')); });
    expect(alertSpy).toHaveBeenCalledWith('Lỗi', expect.any(String));
    expect(mockFinishCapture).not.toHaveBeenCalled();
  });

  it('shows error alert when finishCapture throws', async () => {
    mockFinishCapture.mockRejectedValueOnce(new Error('server error'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('album-checkbox-album-1'));
    await act(async () => { fireEvent.press(getByTestId('review-save')); });
    expect(alertSpy).toHaveBeenCalledWith('Lỗi', expect.any(String));
  });

  it('close button discards and navigates back', () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('review-close'));
    expect(router.back).toHaveBeenCalled();
  });

  it('navigates back when assets is empty on mount', () => {
    usePhotoReviewStore.setState({ assets: [] });
    render(<PhotoReviewScreen />);
    expect(router.back).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd mobile && jest app/__tests__/photo-review.test.tsx
```

Expected: FAIL (still uses `capture` API, `startBackgroundUpload` not called)

- [ ] **Step 3: Rewrite `photo-review.tsx`**

Replace all content in `mobile/app/photo-review.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { useCapture, type UploadResult } from '@/hooks/useCapture';
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
  const { startBackgroundUpload, finishCapture } = useCapture();
  const { data: albums = [] } = useAlbums();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const uploadPromiseRef = useRef<Promise<UploadResult>>();

  const asset = assets[0];
  const previewSize = width - spacing['2xl'] * 2;

  useEffect(() => {
    if (assets.length === 0) { router.back(); return; }
    uploadPromiseRef.current = startBackgroundUpload(asset);
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
    setSaving(true);
    try {
      const result = await uploadPromiseRef.current!;
      await finishCapture(result, asset, albumIds);
      success();
      setCelebrate(true);
      setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ảnh. Thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar hidden />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-close">
          <Ionicons name="close" size={26} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} testID="review-retake">
          <Text style={styles.retakeText}>Chụp lại</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.preview, { width: previewSize, height: previewSize * 0.75 }]}>
          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} width={previewSize} height={previewSize * 0.75} />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={[styles.previewImg, { width: previewSize, height: previewSize * 0.75 }]}
              resizeMode="cover"
            />
          )}
        </View>

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

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          testID="review-save"
          label={saving ? '' : 'Lưu lại'}
          onPress={handleSave}
          fullWidth
          loading={saving}
          disabled={selectedIds.size === 0 || saving}
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

- [ ] **Step 4: Run the photo-review tests**

```bash
cd mobile && jest app/__tests__/photo-review.test.tsx
```

Expected: all PASS

- [ ] **Step 5: Run the full mobile test suite to catch regressions**

```bash
cd mobile && jest
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add mobile/app/photo-review.tsx mobile/app/__tests__/photo-review.test.tsx
git commit -m "feat(mobile): background upload on preview mount, loading only on Save"
```
