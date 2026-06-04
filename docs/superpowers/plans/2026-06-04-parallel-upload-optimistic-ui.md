# Parallel Upload + Optimistic Placeholder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sequential upload loop with a 3-slot concurrency pool and show optimistic photo placeholders (shimmer → fade-in) on the timeline immediately when upload begins.

**Architecture:** A new `runWithConcurrency` utility drives parallel upload slots; a `pendingUploadStore` tracks per-photo upload state; `PendingPhotoCell` + `PendingPhotoRow` render placeholder rows at the top of `TimelineFeed`; `useUpload` wires everything together and `UploadSheet` shows an error summary toast when some photos fail.

**Tech Stack:** React Native `Animated`, Zustand, `@tanstack/react-query`, `expo-image-manipulator`, Jest + `@testing-library/react-native`

---

## File Map

| Path | Type | Responsibility |
|------|------|----------------|
| `mobile/src/lib/concurrency.ts` | New | `runWithConcurrency<T>` — pool of N async slots |
| `mobile/src/stores/pendingUploadStore.ts` | New | Zustand — tracks per-photo pending status |
| `mobile/src/components/timeline/PendingPhotoCell.tsx` | New | Single placeholder cell: shimmer / fade-in / error |
| `mobile/src/components/timeline/PendingPhotoRow.tsx` | New | Lays out up to 2 `PendingPhotoCell`s in a row |
| `mobile/src/hooks/useUpload.ts` | Update | Parallel upload using pool + pendingStore integration |
| `mobile/src/components/timeline/TimelineFeed.tsx` | Update | Renders pending rows via `ListHeaderComponent` |
| `mobile/src/components/upload/UploadSheet.tsx` | Update | Reads `failedCount`, shows error toast |
| `mobile/src/locales/vi.ts` | Update | Add `upload.error_title` / `upload.error_body` keys |
| `mobile/src/locales/en.ts` | Update | Same keys in English |

---

## Task 1: `src/lib/concurrency.ts` — runWithConcurrency

**Files:**
- Create: `mobile/src/lib/concurrency.ts`
- Create: `mobile/src/lib/concurrency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/lib/concurrency.test.ts`:

```ts
import { runWithConcurrency } from '@/lib/concurrency';

describe('runWithConcurrency', () => {
  it('runs all tasks and returns fulfilled results in input order', async () => {
    const tasks = [1, 2, 3].map((n) => () => Promise.resolve(n));
    const results = await runWithConcurrency(tasks, 2);
    expect(results).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 3 },
    ]);
  });

  it('continues when one task rejects, returns rejected result at correct index', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(3),
    ];
    const results = await runWithConcurrency(tasks, 2);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason.message).toBe('boom');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  it('never exceeds the concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 9 }, () => () =>
      new Promise<void>((resolve) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        setImmediate(() => { concurrent--; resolve(); });
      }),
    );
    await runWithConcurrency(tasks, 3);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('starts the next task as soon as a slot is free (not batch-by-batch)', async () => {
    const order: number[] = [];
    const tasks = [0, 1, 2, 3].map((n) => () =>
      new Promise<void>((resolve) => {
        setImmediate(() => { order.push(n); resolve(); });
      }),
    );
    await runWithConcurrency(tasks, 2);
    // Task 3 should start as soon as either 0 or 1 finishes — it appears before both finish
    expect(order).toHaveLength(4);
    expect(order).toContain(3);
  });

  it('handles an empty task list', async () => {
    const results = await runWithConcurrency([], 3);
    expect(results).toEqual([]);
  });

  it('handles limit larger than task count', async () => {
    const tasks = [1, 2].map((n) => () => Promise.resolve(n));
    const results = await runWithConcurrency(tasks, 10);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest --testPathPattern="src/lib/concurrency" --no-coverage
```

Expected: `Cannot find module '@/lib/concurrency'`

- [ ] **Step 3: Implement `concurrency.ts`**

Create `mobile/src/lib/concurrency.ts`:

```ts
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function runSlot(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const slots = Array.from({ length: Math.min(limit, tasks.length) }, runSlot);
  await Promise.all(slots);
  return results;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest --testPathPattern="src/lib/concurrency" --no-coverage
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/concurrency.ts mobile/src/lib/concurrency.test.ts
git commit -m "feat(mobile): add runWithConcurrency utility with concurrency limit"
```

---

## Task 2: `src/stores/pendingUploadStore.ts` — Zustand store

**Files:**
- Create: `mobile/src/stores/pendingUploadStore.ts`
- Create: `mobile/src/stores/pendingUploadStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/stores/pendingUploadStore.test.ts`:

```ts
import { usePendingUploadStore } from '@/stores/pendingUploadStore';

beforeEach(() => {
  usePendingUploadStore.setState({ pendingPhotos: [] });
});

describe('pendingUploadStore', () => {
  it('starts empty', () => {
    expect(usePendingUploadStore.getState().pendingPhotos).toEqual([]);
  });

  it('addPending adds photos with uploading status', () => {
    usePendingUploadStore.getState().addPending([
      { id: 'a', localUri: 'file://a.jpg' },
      { id: 'b', localUri: 'file://b.jpg' },
    ]);
    const photos = usePendingUploadStore.getState().pendingPhotos;
    expect(photos).toHaveLength(2);
    expect(photos[0]).toEqual({ id: 'a', localUri: 'file://a.jpg', status: 'uploading' });
    expect(photos[1]).toEqual({ id: 'b', localUri: 'file://b.jpg', status: 'uploading' });
  });

  it('addPending appends to existing photos', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [{ id: 'x', localUri: 'file://x.jpg', status: 'uploading' as const }],
    });
    usePendingUploadStore.getState().addPending([{ id: 'y', localUri: 'file://y.jpg' }]);
    expect(usePendingUploadStore.getState().pendingPhotos).toHaveLength(2);
  });

  it('markDone sets status to done for matching id only', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [
        { id: 'a', localUri: 'file://a.jpg', status: 'uploading' as const },
        { id: 'b', localUri: 'file://b.jpg', status: 'uploading' as const },
      ],
    });
    usePendingUploadStore.getState().markDone('a');
    const photos = usePendingUploadStore.getState().pendingPhotos;
    expect(photos[0].status).toBe('done');
    expect(photos[1].status).toBe('uploading');
  });

  it('markError sets status to error for matching id only', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [
        { id: 'a', localUri: 'file://a.jpg', status: 'uploading' as const },
        { id: 'b', localUri: 'file://b.jpg', status: 'uploading' as const },
      ],
    });
    usePendingUploadStore.getState().markError('a');
    const photos = usePendingUploadStore.getState().pendingPhotos;
    expect(photos[0].status).toBe('error');
    expect(photos[1].status).toBe('uploading');
  });

  it('clearAll empties the list', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [
        { id: 'a', localUri: 'file://a.jpg', status: 'done' as const },
      ],
    });
    usePendingUploadStore.getState().clearAll();
    expect(usePendingUploadStore.getState().pendingPhotos).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest --testPathPattern="stores/pendingUploadStore" --no-coverage
```

Expected: `Cannot find module '@/stores/pendingUploadStore'`

- [ ] **Step 3: Implement `pendingUploadStore.ts`**

Create `mobile/src/stores/pendingUploadStore.ts`:

```ts
import { create } from 'zustand';

export interface PendingPhoto {
  id: string;
  localUri: string;
  status: 'uploading' | 'done' | 'error';
}

interface PendingUploadState {
  pendingPhotos: PendingPhoto[];
  addPending: (photos: Array<{ id: string; localUri: string }>) => void;
  markDone: (id: string) => void;
  markError: (id: string) => void;
  clearAll: () => void;
}

export const usePendingUploadStore = create<PendingUploadState>()((set) => ({
  pendingPhotos: [],
  addPending: (photos) =>
    set((s) => ({
      pendingPhotos: [
        ...s.pendingPhotos,
        ...photos.map((p) => ({ ...p, status: 'uploading' as const })),
      ],
    })),
  markDone: (id) =>
    set((s) => ({
      pendingPhotos: s.pendingPhotos.map((p) =>
        p.id === id ? { ...p, status: 'done' as const } : p,
      ),
    })),
  markError: (id) =>
    set((s) => ({
      pendingPhotos: s.pendingPhotos.map((p) =>
        p.id === id ? { ...p, status: 'error' as const } : p,
      ),
    })),
  clearAll: () => set({ pendingPhotos: [] }),
}));
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest --testPathPattern="stores/pendingUploadStore" --no-coverage
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/stores/pendingUploadStore.ts mobile/src/stores/pendingUploadStore.test.ts
git commit -m "feat(mobile): add pendingUploadStore for tracking per-photo upload status"
```

---

## Task 3: `src/components/timeline/PendingPhotoCell.tsx`

**Files:**
- Create: `mobile/src/components/timeline/PendingPhotoCell.tsx`
- Create: `mobile/src/components/timeline/PendingPhotoCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/timeline/PendingPhotoCell.test.tsx`:

```tsx
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { PendingPhotoCell } from '@/components/timeline/PendingPhotoCell';

describe('PendingPhotoCell', () => {
  it('renders an Animated.Image with the local URI', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={150} />,
    );
    const images = UNSAFE_getAllByType(Animated.Image);
    expect(images[0].props.source).toEqual({ uri: 'file://photo.jpg' });
  });

  it('renders shimmer overlay when status is uploading', () => {
    const { getByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={150} />,
    );
    expect(getByTestId('shimmer-overlay')).toBeTruthy();
  });

  it('does not render shimmer when status is done', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="done" size={150} />,
    );
    expect(queryByTestId('shimmer-overlay')).toBeNull();
  });

  it('does not render shimmer when status is error', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="error" size={150} />,
    );
    expect(queryByTestId('shimmer-overlay')).toBeNull();
  });

  it('renders error badge when status is error', () => {
    const { getByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="error" size={150} />,
    );
    expect(getByTestId('error-badge')).toBeTruthy();
  });

  it('does not render error badge when status is uploading', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={150} />,
    );
    expect(queryByTestId('error-badge')).toBeNull();
  });

  it('does not render error badge when status is done', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="done" size={150} />,
    );
    expect(queryByTestId('error-badge')).toBeNull();
  });

  it('applies the given size to width and height', () => {
    const { getByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={200} />,
    );
    const container = getByTestId('pending-cell-container');
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 200, height: 200 })]),
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest --testPathPattern="PendingPhotoCell" --no-coverage
```

Expected: `Cannot find module '@/components/timeline/PendingPhotoCell'`

- [ ] **Step 3: Implement `PendingPhotoCell.tsx`**

Create `mobile/src/components/timeline/PendingPhotoCell.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows } from '@/constants/theme';

interface PendingPhotoCellProps {
  localUri: string;
  status: 'uploading' | 'done' | 'error';
  size: number;
  index?: number;
}

export function PendingPhotoCell({ localUri, status, size, index = 0 }: PendingPhotoCellProps) {
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;

  const opacity = useRef(new Animated.Value(0.5)).current;
  const shimmerOpacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (status === 'uploading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacityAnim, { toValue: 0.65, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerOpacityAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else if (status === 'done') {
      shimmerOpacityAnim.stopAnimation();
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      shimmerOpacityAnim.stopAnimation();
    }
  }, [status]);

  return (
    <View
      testID="pending-cell-container"
      style={[
        { width: size, height: size, borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
        styles.container,
      ]}
    >
      <Animated.Image
        source={{ uri: localUri }}
        style={[styles.image, { opacity }]}
        resizeMode="cover"
      />
      {status === 'uploading' && (
        <Animated.View
          testID="shimmer-overlay"
          style={[StyleSheet.absoluteFill, styles.shimmer, { opacity: shimmerOpacityAnim }]}
        />
      )}
      {status === 'error' && (
        <View testID="error-badge" style={styles.errorBadge}>
          <Ionicons name="alert-circle" size={16} color={colors.white} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:      { width: '100%', height: '100%' },
  shimmer:    { backgroundColor: colors.white },
  errorBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(220,50,50,0.9)', borderRadius: 10, padding: 2 },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest --testPathPattern="PendingPhotoCell" --no-coverage
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/PendingPhotoCell.tsx mobile/src/components/timeline/PendingPhotoCell.test.tsx
git commit -m "feat(mobile): add PendingPhotoCell with shimmer and fade-in animation"
```

---

## Task 4: `src/components/timeline/PendingPhotoRow.tsx`

**Files:**
- Create: `mobile/src/components/timeline/PendingPhotoRow.tsx`
- Create: `mobile/src/components/timeline/PendingPhotoRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/timeline/PendingPhotoRow.test.tsx`:

```tsx
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 375, height: 812 }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { PendingPhotoRow } from '@/components/timeline/PendingPhotoRow';
import { PendingPhotoCell } from '@/components/timeline/PendingPhotoCell';
import type { PendingPhoto } from '@/stores/pendingUploadStore';

function makePhoto(id: string, status: PendingPhoto['status'] = 'uploading'): PendingPhoto {
  return { id, localUri: `file://${id}.jpg`, status };
}

describe('PendingPhotoRow', () => {
  it('renders one PendingPhotoCell for a single photo', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a')]} rowIndex={0} />,
    );
    expect(UNSAFE_getAllByType(PendingPhotoCell)).toHaveLength(1);
  });

  it('renders two PendingPhotoCells for two photos', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a'), makePhoto('b')]} rowIndex={0} />,
    );
    expect(UNSAFE_getAllByType(PendingPhotoCell)).toHaveLength(2);
  });

  it('passes localUri and status from each photo to PendingPhotoCell', () => {
    const photos: PendingPhoto[] = [
      { id: 'x', localUri: 'file://x.jpg', status: 'done' },
      { id: 'y', localUri: 'file://y.jpg', status: 'error' },
    ];
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={photos} rowIndex={0} />,
    );
    const cells = UNSAFE_getAllByType(PendingPhotoCell);
    expect(cells[0].props.localUri).toBe('file://x.jpg');
    expect(cells[0].props.status).toBe('done');
    expect(cells[1].props.localUri).toBe('file://y.jpg');
    expect(cells[1].props.status).toBe('error');
  });

  it('passes correct index accounting for rowIndex', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a'), makePhoto('b')]} rowIndex={2} />,
    );
    const cells = UNSAFE_getAllByType(PendingPhotoCell);
    expect(cells[0].props.index).toBe(4); // rowIndex * 2 + 0
    expect(cells[1].props.index).toBe(5); // rowIndex * 2 + 1
  });

  it('computes cell size to fill width with gap', () => {
    // width=375, paddingHorizontal=16*2=32, gap=4, 2 cells
    // cellSize = (375 - 32 - 4) / 2 = 169.5
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a'), makePhoto('b')]} rowIndex={0} />,
    );
    const cells = UNSAFE_getAllByType(PendingPhotoCell);
    expect(cells[0].props.size).toBeCloseTo(169.5, 0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest --testPathPattern="PendingPhotoRow" --no-coverage
```

Expected: `Cannot find module '@/components/timeline/PendingPhotoRow'`

- [ ] **Step 3: Implement `PendingPhotoRow.tsx`**

Create `mobile/src/components/timeline/PendingPhotoRow.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { PendingPhotoCell } from './PendingPhotoCell';
import { spacing } from '@/constants/theme';
import type { PendingPhoto } from '@/stores/pendingUploadStore';

interface PendingPhotoRowProps {
  photos: PendingPhoto[];
  rowIndex: number;
}

export function PendingPhotoRow({ photos, rowIndex }: PendingPhotoRowProps) {
  const { width } = useWindowDimensions();
  const count = Math.min(photos.length, 2);
  const gap = spacing.xs;
  const cellSize = (width - spacing['2xl'] * 2 - gap * (count - 1)) / count;

  return (
    <View style={styles.row}>
      {photos.slice(0, 2).map((p, i) => (
        <PendingPhotoCell
          key={p.id}
          localUri={p.localUri}
          status={p.status}
          size={cellSize}
          index={rowIndex * 2 + i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest --testPathPattern="PendingPhotoRow" --no-coverage
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/PendingPhotoRow.tsx mobile/src/components/timeline/PendingPhotoRow.test.tsx
git commit -m "feat(mobile): add PendingPhotoRow to lay out pending photo cells in rows"
```

---

## Task 5: Update `src/hooks/useUpload.ts` — parallel upload

**Files:**
- Modify: `mobile/src/hooks/useUpload.ts`
- Modify: `mobile/src/hooks/useUpload.test.tsx`

- [ ] **Step 1: Update the test file**

Replace the full contents of `mobile/src/hooks/useUpload.test.tsx` with:

```tsx
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));
jest.mock('@/lib/compression', () => ({
  compressToWebP: jest.fn(),
}));
jest.mock('@/lib/exif', () => ({
  extractTakenAt: jest.fn(),
}));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useUpload, type UploadAsset } from '@/hooks/useUpload';
import { usePendingUploadStore } from '@/stores/pendingUploadStore';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { compressToWebP } from '@/lib/compression';
import { extractTakenAt } from '@/lib/exif';

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;
const mockCompress = compressToWebP as jest.MockedFunction<typeof compressToWebP>;
const mockExtractTakenAt = extractTakenAt as jest.MockedFunction<typeof extractTakenAt>;
const mockLaunchImageLibrary =
  ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
    typeof ImagePicker.launchImageLibraryAsync
  >;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const fakeBlob = { size: 1234, type: 'image/webp' } as unknown as Blob;

function installFetchMock(opts: { putOk?: boolean; putReject?: boolean } = {}) {
  const { putOk = true, putReject = false } = opts;
  const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
    if (!init) {
      return Promise.resolve({ blob: () => Promise.resolve(fakeBlob), ok: true, status: 200 });
    }
    if (putReject) return Promise.reject(new Error('network failure'));
    return Promise.resolve({ ok: putOk, status: putOk ? 200 : 500 });
  });
  // @ts-expect-error: assigning to global.fetch for tests.
  global.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  jest.clearAllMocks();
  usePendingUploadStore.setState({ pendingPhotos: [] });
  mockUseAlbumStore.mockImplementation(
    (selector: (s: { albumId: string | null }) => unknown) =>
      selector({ albumId: 'album-42' }),
  );
  mockCompress.mockResolvedValue('file://compressed.webp');
  mockExtractTakenAt.mockReturnValue('2025-01-01T00:00:00.000Z');
});

describe('useUpload', () => {
  test('successful single upload calls presign, PUT, and registers photo', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://signed/x', key: 'photos/abc.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-1' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    const asset: UploadAsset = {
      uri: 'file://input.jpg',
      localAssetId: 'asset-1',
      takenAt: '2025-03-04T05:06:07.000Z',
    };

    await act(async () => { await result.current.uploadImages([asset], 'hello'); });

    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { album_id: 'album-42' });
    expect(mockCompress).toHaveBeenCalledWith('file://input.jpg');
    expect(fetchMock).toHaveBeenCalledWith('file://compressed.webp');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed/x',
      expect.objectContaining({ method: 'PUT', body: fakeBlob, headers: { 'Content-Type': 'image/webp' } }),
    );
    expect(mockApi.post).toHaveBeenCalledWith('/photos', {
      album_id: 'album-42',
      r2_key: 'photos/abc.webp',
      taken_at: '2025-03-04T05:06:07.000Z',
      caption: 'hello',
      local_asset_id: 'asset-1',
    });
    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.progress).toBe(1);
  });

  test('caption defaults to null and takenAt falls back to now when asset.takenAt is null', async () => {
    installFetchMock({ putOk: true });
    const fixedNow = '2030-06-01T12:00:00.000Z';
    const dateSpy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedNow);
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://signed/y', key: 'photos/def.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-2' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://x.jpg', takenAt: null }]);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/photos', {
      album_id: 'album-42',
      r2_key: 'photos/def.webp',
      taken_at: fixedNow,
      caption: null,
      local_asset_id: null,
    });
    dateSpy.mockRestore();
  });

  test('compressed uri is fed to fetch (not the raw asset uri)', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockCompress.mockResolvedValueOnce('file://compressed-special.webp');
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://signed/c', key: 'photos/c.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-3' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://original.heic', takenAt: null }]);
    });

    expect(mockCompress).toHaveBeenCalledWith('file://original.heic');
    expect(fetchMock).toHaveBeenCalledWith('file://compressed-special.webp');
    expect(fetchMock).not.toHaveBeenCalledWith('file://original.heic');
  });

  test('presign failure increments failedCount — upload resolves, does not throw', async () => {
    installFetchMock({ putOk: true });
    mockApi.post.mockRejectedValue(new Error('presign failed'));

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://a.jpg', takenAt: null }]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
    expect(result.current.progress).toBe(1);
  });

  test('PUT failure increments failedCount — upload resolves, does not throw', async () => {
    installFetchMock({ putReject: true });
    mockApi.post.mockResolvedValue({ data: { url: 'https://s/z', key: 'photos/z.webp' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://b.jpg', takenAt: null }]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
  });

  test('register failure increments failedCount — upload resolves, does not throw', async () => {
    installFetchMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://s/q', key: 'photos/q.webp' } })
      .mockRejectedValueOnce(new Error('register failed'));

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://c.jpg', takenAt: null }]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
  });

  test('failed assets do not stop successful assets from uploading', async () => {
    installFetchMock({ putOk: true });
    let presignCount = 0;
    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') {
        presignCount++;
        if (presignCount === 1) throw new Error('first presign fails');
        return { data: { url: 'https://s/ok', key: 'photos/ok.webp' } };
      }
      return { data: { id: 'photo-ok' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://fail.jpg', takenAt: null },
        { uri: 'file://ok.jpg', takenAt: null },
      ]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
    expect(mockApi.post).toHaveBeenCalledWith('/photos', expect.objectContaining({ r2_key: 'photos/ok.webp' }));
  });

  test('all assets are processed and progress reaches 1 regardless of failures', async () => {
    installFetchMock({ putReject: true });
    mockApi.post.mockResolvedValue({ data: { url: 'https://s/x', key: 'photos/x.webp' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://1.jpg', takenAt: null },
        { uri: 'file://2.jpg', takenAt: null },
        { uri: 'file://3.jpg', takenAt: null },
      ]);
    });

    await waitFor(() => expect(result.current.progress).toBe(1));
    expect(result.current.failedCount).toBe(3);
    expect(result.current.uploading).toBe(false);
  });

  test('multiple successful assets: each presigned, uploaded, and registered', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') return { data: { url: 'https://s/upload', key: 'photos/out.webp' } };
      return { data: { id: 'new-photo' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    const assets: UploadAsset[] = [
      { uri: 'file://1.jpg', takenAt: '2025-01-01T00:00:00.000Z' },
      { uri: 'file://2.jpg', takenAt: '2025-01-02T00:00:00.000Z' },
      { uri: 'file://3.jpg', takenAt: '2025-01-03T00:00:00.000Z' },
    ];

    await act(async () => { await result.current.uploadImages(assets); });

    // 3 presign + 3 register = 6 api.post calls
    expect(mockApi.post.mock.calls.filter((c) => c[0] === '/photos/presign')).toHaveLength(3);
    expect(mockApi.post.mock.calls.filter((c) => c[0] === '/photos')).toHaveLength(3);
    // 3 blob fetches + 3 PUT fetches = 6 fetch calls
    const putCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT');
    expect(putCalls).toHaveLength(3);

    await waitFor(() => expect(result.current.progress).toBe(1));
    expect(result.current.uploading).toBe(false);
    expect(result.current.failedCount).toBe(0);
  });

  test('addPending is called with all assets before any upload starts', async () => {
    installFetchMock({ putOk: true });
    let pendingSnapshot: typeof usePendingUploadStore extends () => infer R ? R : never;

    const originalAddPending = usePendingUploadStore.getState().addPending;
    const addPendingSpy = jest.fn((...args: Parameters<typeof originalAddPending>) => {
      pendingSnapshot = usePendingUploadStore.getState().pendingPhotos as any;
      return originalAddPending(...args);
    });
    usePendingUploadStore.setState({ addPending: addPendingSpy } as any);

    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') return { data: { url: 'https://s/x', key: 'k.webp' } };
      return { data: { id: 'p' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://a.jpg', takenAt: null },
        { uri: 'file://b.jpg', takenAt: null },
      ]);
    });

    expect(addPendingSpy).toHaveBeenCalledTimes(1);
    const addPendingArg = addPendingSpy.mock.calls[0][0] as Array<{ localUri: string }>;
    expect(addPendingArg.map((p) => p.localUri)).toEqual(['file://a.jpg', 'file://b.jpg']);
  });

  test('markDone is called for each successful asset, markError for each failed asset', async () => {
    installFetchMock({ putOk: true });
    let presignCount = 0;
    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') {
        presignCount++;
        if (presignCount === 2) throw new Error('fail');
        return { data: { url: 'https://s/x', key: 'k.webp' } };
      }
      return { data: { id: 'p' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://a.jpg', takenAt: null },
        { uri: 'file://b.jpg', takenAt: null },
        { uri: 'file://c.jpg', takenAt: null },
      ]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));

    const photos = usePendingUploadStore.getState().pendingPhotos;
    const doneCount = photos.filter((p) => p.status === 'done').length;
    const errorCount = photos.filter((p) => p.status === 'error').length;
    expect(doneCount).toBe(2);
    expect(errorCount).toBe(1);
  });

  test('pickImages returns mapped assets from ImagePicker result', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file://p1.jpg', assetId: 'aid-1', exif: { DateTimeOriginal: '2024:10:15 14:30:00' } },
        { uri: 'file://p2.jpg', assetId: null, exif: null },
      ],
    } as unknown as ImagePicker.ImagePickerResult);
    mockExtractTakenAt
      .mockReturnValueOnce('2024-10-15T14:30:00.000Z')
      .mockReturnValueOnce(null);

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    let picked: UploadAsset[] = [];
    await act(async () => { picked = await result.current.pickImages(); });

    expect(picked).toEqual([
      { uri: 'file://p1.jpg', localAssetId: 'aid-1', takenAt: '2024-10-15T14:30:00.000Z' },
      { uri: 'file://p2.jpg', localAssetId: undefined, takenAt: null },
    ]);
  });

  test('pickImages returns empty array when picker is canceled', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: true,
    } as unknown as ImagePicker.ImagePickerResult);

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    let picked: UploadAsset[] = [{ uri: 'sentinel', takenAt: null }];
    await act(async () => { picked = await result.current.pickImages(); });
    expect(picked).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest --testPathPattern="hooks/useUpload" --no-coverage
```

Expected: several tests fail due to old error-throwing behavior and missing `failedCount`.

- [ ] **Step 3: Implement updated `useUpload.ts`**

Replace the full contents of `mobile/src/hooks/useUpload.ts`:

```ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { extractTakenAt } from '@/lib/exif';
import { useAlbumStore } from '@/stores/albumStore';
import { useUploadStore } from '@/stores/uploadStore';
import { usePendingUploadStore } from '@/stores/pendingUploadStore';
import { runWithConcurrency } from '@/lib/concurrency';

export interface UploadAsset {
  uri: string;
  localAssetId?: string;
  takenAt: string | null;
}

interface PendingAsset extends UploadAsset {
  pendingId: string;
}

export function useUpload() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  const addSynced = useUploadStore((s) => s.addSynced);
  const addPending = usePendingUploadStore((s) => s.addPending);
  const markDone = usePendingUploadStore((s) => s.markDone);
  const markError = usePendingUploadStore((s) => s.markError);
  const clearAll = usePendingUploadStore((s) => s.clearAll);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  async function pickImages(): Promise<UploadAsset[]> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      exif: true,
      quality: 1,
    });
    if (result.canceled) return [];
    return result.assets.map((a) => ({
      uri: a.uri,
      localAssetId: a.assetId ?? undefined,
      takenAt: extractTakenAt(a),
    }));
  }

  async function uploadImages(assets: UploadAsset[], caption?: string): Promise<void> {
    setUploading(true);
    setProgress(0);
    setFailedCount(0);

    const pendingAssets: PendingAsset[] = assets.map((a, i) => ({
      ...a,
      pendingId: `${Date.now()}-${i}`,
    }));

    addPending(pendingAssets.map((a) => ({ id: a.pendingId, localUri: a.uri })));

    let done = 0;
    let failed = 0;

    async function uploadOne(asset: PendingAsset): Promise<void> {
      try {
        const { data: presign } = await api.post('/photos/presign', { album_id: albumId });
        const compressedUri = await compressToWebP(asset.uri);
        const blob = await fetch(compressedUri).then((r) => r.blob());
        await fetch(presign.url, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/webp' },
        });
        await api.post('/photos', {
          album_id: albumId,
          r2_key: presign.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          caption: caption || null,
          local_asset_id: asset.localAssetId ?? null,
        });
        if (asset.localAssetId) {
          addSynced({ localAssetId: asset.localAssetId, compressedBytes: blob.size });
        }
        markDone(asset.pendingId);
      } catch {
        markError(asset.pendingId);
        failed++;
      } finally {
        done++;
        setProgress(done / assets.length);
      }
    }

    await runWithConcurrency(
      pendingAssets.map((a) => () => uploadOne(a)),
      3,
    );

    qc.invalidateQueries({ queryKey: ['timeline', albumId] });
    setFailedCount(failed);
    setUploading(false);
    setTimeout(() => clearAll(), 400);
  }

  return { pickImages, uploadImages, uploading, progress, failedCount };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest --testPathPattern="hooks/useUpload" --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useUpload.ts mobile/src/hooks/useUpload.test.tsx
git commit -m "feat(mobile): parallel upload with concurrency pool and per-asset error tracking"
```

---

## Task 6: Update `TimelineFeed.tsx` — pending rows at top

**Files:**
- Modify: `mobile/src/components/timeline/TimelineFeed.tsx`
- Modify: `mobile/src/components/timeline/TimelineFeed.test.tsx`

- [ ] **Step 1: Add new test cases and mocks to `TimelineFeed.test.tsx`**

At the top of `mobile/src/components/timeline/TimelineFeed.test.tsx`, add these mocks after the existing `jest.mock` calls:

```ts
jest.mock('@/stores/pendingUploadStore', () => ({
  usePendingUploadStore: jest.fn(),
}));
jest.mock('@/components/timeline/PendingPhotoRow', () => ({
  PendingPhotoRow: 'PendingPhotoRow',
}));
```

Add these imports after the existing imports:

```ts
import { usePendingUploadStore } from '@/stores/pendingUploadStore';

const mockUsePendingUploadStore = usePendingUploadStore as unknown as jest.Mock;
```

In the `beforeEach` block, add:

```ts
mockUsePendingUploadStore.mockImplementation(
  (selector: (s: { pendingPhotos: unknown[] }) => unknown) =>
    selector({ pendingPhotos: [] }),
);
```

Add these new test cases inside the `describe('TimelineFeed', ...)` block:

```ts
it('renders no pending rows when pendingPhotos is empty', () => {
  mockUseTimeline.mockReturnValue(
    makeReturn({ data: { pages: [{ items: [], nextCursor: null }] } }),
  );
  const { queryByTestId } = render(<TimelineFeed childBirthdate={null} />);
  expect(queryByTestId('pending-rows')).toBeNull();
});

it('renders pending rows above timeline content when pendingPhotos is non-empty', () => {
  mockUseTimeline.mockReturnValue(
    makeReturn({ data: { pages: [{ items: [], nextCursor: null }] } }),
  );
  mockUsePendingUploadStore.mockImplementation(
    (selector: (s: { pendingPhotos: unknown[] }) => unknown) =>
      selector({
        pendingPhotos: [
          { id: 'p1', localUri: 'file://1.jpg', status: 'uploading' },
          { id: 'p2', localUri: 'file://2.jpg', status: 'done' },
          { id: 'p3', localUri: 'file://3.jpg', status: 'uploading' },
        ],
      }),
  );
  const { getByTestId } = render(<TimelineFeed childBirthdate={null} />);
  expect(getByTestId('pending-rows')).toBeTruthy();
});

it('groups pending photos into rows of 2', () => {
  mockUseTimeline.mockReturnValue(
    makeReturn({ data: { pages: [{ items: [], nextCursor: null }] } }),
  );
  mockUsePendingUploadStore.mockImplementation(
    (selector: (s: { pendingPhotos: unknown[] }) => unknown) =>
      selector({
        pendingPhotos: [
          { id: 'p1', localUri: 'file://1.jpg', status: 'uploading' },
          { id: 'p2', localUri: 'file://2.jpg', status: 'uploading' },
          { id: 'p3', localUri: 'file://3.jpg', status: 'done' },
        ],
      }),
  );
  // PendingPhotoRow is mocked as a string component 'PendingPhotoRow'
  const { UNSAFE_getAllByProps } = render(<TimelineFeed childBirthdate={null} />);
  // 3 photos → 2 rows: [p1,p2] and [p3]
  const rows = UNSAFE_getAllByProps({ rowIndex: expect.any(Number) });
  expect(rows).toHaveLength(2);
  expect(rows[0].props.photos.map((p: any) => p.id)).toEqual(['p1', 'p2']);
  expect(rows[1].props.photos.map((p: any) => p.id)).toEqual(['p3']);
});
```

- [ ] **Step 2: Run tests — expect FAIL on new tests only**

```bash
cd mobile && npx jest --testPathPattern="components/timeline/TimelineFeed" --no-coverage
```

Expected: existing tests pass, 3 new tests fail.

- [ ] **Step 3: Update `TimelineFeed.tsx`**

Replace the full contents of `mobile/src/components/timeline/TimelineFeed.tsx`:

```tsx
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, View } from 'react-native';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { MonthHeader } from './MonthHeader';
import { PhotoRow } from './PhotoRow';
import { PolaroidCard } from './PolaroidCard';
import { PendingPhotoRow } from './PendingPhotoRow';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { usePendingUploadStore } from '@/stores/pendingUploadStore';
import { colors, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { formatVnMonth, formatVnAge } from '@/lib/format';
import { t } from '@/lib/i18n';

function getMonthLabel(isoDate: string, birthdate: string | null): string {
  const d = new Date(isoDate);
  const month = formatVnMonth(d);
  if (!birthdate) return `${month} · ${d.getFullYear()}`;
  return `${month} · ${formatVnAge(birthdate, d)}`;
}

interface FlatListItem {
  type: 'month' | 'photoRow' | 'polaroid' | 'milestone';
  key: string;
  label?: string;
  photos?: any[];
  photo?: any;
  milestone?: any;
  index?: number;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } = useTimeline();
  const pendingPhotos = usePendingUploadStore((s) => s.pendingPhotos);

  const pendingRows = React.useMemo(() => {
    const rows = [];
    for (let i = 0; i < pendingPhotos.length; i += 2) {
      rows.push(pendingPhotos.slice(i, i + 2));
    }
    return rows;
  }, [pendingPhotos]);

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentMonth = '';
    let photoBuffer: any[] = [];
    let rowIndex = 0;

    const flushPhotos = () => {
      while (photoBuffer.length > 0) {
        const batch = photoBuffer.splice(0, 2);
        result.push({ type: 'photoRow', key: `row-${batch[0].id}`, photos: batch, index: rowIndex });
        rowIndex++;
      }
    };

    let mIdx = 0;
    for (const item of allItems) {
      const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
      const monthKey = dateStr.slice(0, 7);
      if (monthKey !== currentMonth) {
        flushPhotos();
        currentMonth = monthKey;
        result.push({ type: 'month', key: `month-${monthKey}`, label: getMonthLabel(dateStr, childBirthdate) });
      }
      if (item.type === 'photo') {
        if ((item as any).source === 'capture') {
          flushPhotos();
          result.push({ type: 'polaroid', key: `polaroid-${item.id}`, photo: item });
        } else {
          photoBuffer.push(item);
          if (photoBuffer.length >= 2) flushPhotos();
        }
      } else {
        flushPhotos();
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item, index: mIdx++ });
      }
    }
    flushPhotos();
    return result;
  }, [data, childBirthdate]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.skel}>
        <SkeletonRow rowIndex={0} />
        <SkeletonRow rowIndex={1} />
        <SkeletonRow rowIndex={2} />
      </View>
    );
  }
  if (!items.length && !pendingRows.length) return <EmptyState emoji="🌸" message={t('home.empty_message')} />;

  const listHeader = pendingRows.length > 0 ? (
    <View testID="pending-rows">
      {pendingRows.map((row, i) => (
        <PendingPhotoRow key={`pending-${i}`} photos={row} rowIndex={i} />
      ))}
    </View>
  ) : undefined;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.content}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      ListHeaderComponent={listHeader}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pink} />}
      renderItem={({ item }) => {
        if (item.type === 'month') return <MonthHeader label={item.label!} />;
        if (item.type === 'photoRow') return <PhotoRow photos={item.photos!} rowIndex={item.index} />;
        if (item.type === 'polaroid') return <PolaroidCard photo={item.photo!} />;
        return (
          <MilestoneCard
            title={item.milestone.title}
            note={item.milestone.note}
            occurredAt={item.milestone.occurred_at}
            index={item.index}
            onPress={() => router.push(`/milestone/${item.milestone.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'] },
  skel:    { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg },
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd mobile && npx jest --testPathPattern="components/timeline/TimelineFeed" --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/timeline/TimelineFeed.tsx mobile/src/components/timeline/TimelineFeed.test.tsx
git commit -m "feat(mobile): show pending photo placeholder rows at top of timeline"
```

---

## Task 7: Error toast in `UploadSheet` + i18n keys

**Files:**
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`
- Modify: `mobile/src/components/upload/UploadSheet.tsx`

- [ ] **Step 1: Add i18n keys to `vi.ts`**

In `mobile/src/locales/vi.ts`, inside the `upload:` object, add after the `cancel` key:

```ts
    error_title: 'Tải lên không hoàn tất',
    error_body:  '{{success}} ảnh thành công, {{failed}} ảnh thất bại',
```

- [ ] **Step 2: Add i18n keys to `en.ts`**

In `mobile/src/locales/en.ts`, inside the `upload:` object, add after the `cancel` key:

```ts
    error_title: 'Upload incomplete',
    error_body:  '{{success}} photos uploaded, {{failed}} failed',
```

- [ ] **Step 3: Update `UploadSheet.tsx`**

Replace the full contents of `mobile/src/components/upload/UploadSheet.tsx`:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { Confetti } from '@/components/ui/Confetti';
import { PhotoThumbnailGrid } from './PhotoThumbnailGrid';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface UploadSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadSheet({ visible, onClose }: UploadSheetProps) {
  const ref = useRef<TrueSheet>(null);
  const { pickImages, uploadImages, uploading, progress, failedCount } = useUpload();
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
      setAssets([]); setSelected(new Set()); setCaption(''); setCelebrate(false);
    }
  }, [visible]);

  function handlePresent() {
    pickImages().then((a) => {
      if (!a.length) { onClose(); return; }
      setAssets(a);
      setSelected(new Set(a.map((x) => x.uri)));
    });
  }

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uri) ? next.delete(uri) : next.add(uri);
      return next;
    });
  }

  async function handleUpload() {
    const toUpload = assets.filter((a) => selected.has(a.uri));
    await uploadImages(toUpload, caption);
    success();
    if (failedCount > 0) {
      Alert.alert(
        t('upload.error_title'),
        t('upload.error_body', { success: toUpload.length - failedCount, failed: failedCount }),
      );
    }
    setCelebrate(failedCount === 0);
    setTimeout(() => { setCelebrate(false); onClose(); }, 1300);
  }

  const count = selected.size;
  const ctaLabel = count === 1 ? t('upload.cta_one') : t('upload.cta', { n: count });
  const progressLabel = uploading
    ? (progress < 0.05 ? t('upload.compressing') : t('upload.uploading', { done: Math.round(progress * count), total: count }))
    : '';

  return (
    <TrueSheet
      ref={ref}
      sizes={['92%']}
      cornerRadius={24}
      backgroundColor={colors.background}
      onDismiss={onClose}
      onPresent={handlePresent}
    >
      <View style={styles.handle} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t('upload.eyebrow')}</Text>
          <Text style={styles.title}>{t('upload.title')}</Text>
        </View>
        <Button label={t('upload.cancel')} onPress={onClose} variant="ghost" tier="quiet" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={toggleSelect} />
        <TextInput
          placeholder={t('upload.caption_ph')}
          value={caption}
          onChangeText={setCaption}
          style={styles.captionInput}
          caveatPlaceholder
        />
        {uploading && <Text style={styles.progress}>{progressLabel}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={ctaLabel} onPress={handleUpload} fullWidth loading={uploading} disabled={!count} />
      </View>

      <Confetti visible={celebrate} />
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  handle:       { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginTop: spacing.md },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'] },
  eyebrow:      { ...typography.handAccent, color: colors.pink },
  title:        { ...typography.heading, color: colors.ink },
  content:      { padding: spacing['2xl'] },
  captionInput: { marginTop: spacing.lg },
  progress:     { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.md, fontFamily: 'Caveat_500Medium', fontSize: 18 },
  footer:       { padding: spacing['2xl'] },
});
```

- [ ] **Step 4: Run all upload-related tests**

```bash
cd mobile && npx jest --testPathPattern="upload|useUpload|UploadSheet" --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts mobile/src/components/upload/UploadSheet.tsx
git commit -m "feat(mobile): show error toast when some photos fail to upload"
```

---

## Done

All 7 tasks complete. The feature delivers:
- `runWithConcurrency` — 3-slot parallel pipeline, no external deps
- `pendingUploadStore` — per-photo status tracking
- `PendingPhotoCell` + `PendingPhotoRow` — shimmer → fade-in placeholder UI
- `useUpload` — parallel, error-resilient, optimistic
- `TimelineFeed` — shows pending rows at top instantly
- `UploadSheet` — error summary toast when some photos fail
