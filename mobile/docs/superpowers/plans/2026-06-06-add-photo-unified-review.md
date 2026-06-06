# Add Photo — Action Sheet + Unified Review Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-purpose upload FAB on album detail with an action sheet offering "Chụp ảnh" and "Tải lên", with a unified preview screen that shows a note field for single photos and a grid-only view for multiple.

**Architecture:** A new `photoReviewStore` (Zustand, in-memory) holds assets pending review from either source. `capture.tsx` and a new `AddPhotoSheet` both populate this store then navigate to `/photo-review`, which adapts its UI based on asset count. Old `capture-review`, `UploadSheet`, and `uploadSheetStore` are deleted.

**Tech Stack:** React Native / Expo Router, Zustand, `@lodev09/react-native-true-sheet`, `@tanstack/react-query`, `expo-image-picker`, Testing Library (`@testing-library/react-native`)

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `src/stores/photoReviewStore.ts` | Create | In-memory store for assets pending review |
| `src/locales/vi.ts` | Modify | Add `add_photo` + `photo_review` keys |
| `src/locales/en.ts` | Modify | Add `add_photo` + `photo_review` keys |
| `src/stores/captureStore.ts` | Modify | Remove `pendingAsset` fields |
| `jest.setup.js` | Modify | Add `dismissAll` to router mock |
| `src/components/ui/AddPhotoSheet.tsx` | Create | Action sheet: camera row + gallery row |
| `src/components/ui/__tests__/AddPhotoSheet.test.tsx` | Create | Tests for AddPhotoSheet |
| `app/photo-review.tsx` | Create | Unified review screen (single + multi) |
| `app/__tests__/photo-review.test.tsx` | Create | Tests for photo-review screen |
| `app/capture.tsx` | Modify | Set photoReviewStore after capture, navigate to `/photo-review` |
| `app/albums/[id].tsx` | Modify | FAB → AddPhotoSheet, remove uploadSheetStore |
| `app/capture-review.tsx` | Delete | Replaced by photo-review |
| `src/components/upload/UploadSheet.tsx` | Delete | Replaced by AddPhotoSheet + photo-review |
| `src/components/upload/UploadSheet.test.tsx` | Delete | Paired with deleted component |
| `src/stores/uploadSheetStore.ts` | Delete | No longer needed |

---

## Task 1: i18n keys

**Files:**
- Modify: `src/locales/vi.ts`
- Modify: `src/locales/en.ts`

- [ ] **Step 1: Add keys to vi.ts**

Open `src/locales/vi.ts`. Add these two entries before the closing `};` of the exported object (after the `capture:` block):

```ts
  add_photo: {
    camera:  'Chụp ảnh mới',
    upload:  'Tải lên',
  },
  photo_review: {
    note_ph:    'ghi chú nhỏ cho ảnh...',
    send:       'Gửi',
    retake:     'Chụp lại',
    upload_one: 'Tải lên',
    upload_n:   'Tải lên {{n}} ảnh',
  },
```

- [ ] **Step 2: Add keys to en.ts**

Open `src/locales/en.ts`. Add after the `capture:` block:

```ts
  add_photo: {
    camera:  'New photo',
    upload:  'Upload',
  },
  photo_review: {
    note_ph:    'short note for the photo...',
    send:       'Send',
    retake:     'Retake',
    upload_one: 'Upload',
    upload_n:   'Upload {{n}} photos',
  },
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat(mobile): add i18n keys for add-photo action sheet and unified review"
```

---

## Task 2: photoReviewStore

**Files:**
- Create: `src/stores/photoReviewStore.ts`

- [ ] **Step 1: Write the store**

Create `src/stores/photoReviewStore.ts`:

```ts
import { create } from 'zustand';

export interface ReviewAsset {
  uri: string;
  type: 'photo' | 'video';
  source: 'camera' | 'gallery';
  durationMs?: number;
  takenAt?: string | null;
  localAssetId?: string;
}

interface PhotoReviewState {
  assets: ReviewAsset[];
  setAssets: (assets: ReviewAsset[]) => void;
  clear: () => void;
}

export const usePhotoReviewStore = create<PhotoReviewState>()((set) => ({
  assets: [],
  setAssets: (assets) => set({ assets }),
  clear: () => set({ assets: [] }),
}));
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors involving `photoReviewStore.ts`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/stores/photoReviewStore.ts
git commit -m "feat(mobile): add photoReviewStore for unified review flow"
```

---

## Task 3: Clean up captureStore + fix jest router mock

**Files:**
- Modify: `src/stores/captureStore.ts`
- Modify: `jest.setup.js`

- [ ] **Step 1: Remove pendingAsset from captureStore**

Replace the entire `src/stores/captureStore.ts` with:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CaptureState {
  lastCaptureAt: number | null;
  setLastCaptureAt: (ts: number) => void;
}

export const useCaptureStore = create<CaptureState>()(
  persist(
    (set) => ({
      lastCaptureAt: null,
      setLastCaptureAt: (ts) => set({ lastCaptureAt: ts }),
    }),
    {
      name: 'capture-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const CAPTURE_COOLDOWN_MS = 30 * 60 * 1000;

export function getCooldownRemaining(lastCaptureAt: number | null): number {
  if (!lastCaptureAt) return 0;
  const elapsed = Date.now() - lastCaptureAt;
  return Math.max(0, CAPTURE_COOLDOWN_MS - elapsed);
}
```

Note: `PendingCaptureAsset` type moves to `photoReviewStore.ts` — it's now `ReviewAsset` with `source: 'camera'`. `useCapture.ts` imports `ReviewAsset` from `photoReviewStore`.

- [ ] **Step 2: Add dismissAll to jest router mock**

In `jest.setup.js`, find the `router:` block (around line 14) and add `dismissAll`:

```js
router: {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => false),
},
```

Also add it to the `useRouter` mock:

```js
useRouter: () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => false),
}),
```

- [ ] **Step 3: Update useCapture.ts to use ReviewAsset**

In `src/hooks/useCapture.ts`, replace the import of `PendingCaptureAsset` from `captureStore`:

```ts
// Remove:
import { useCaptureStore, getCooldownRemaining, PendingCaptureAsset } from '@/stores/captureStore';

// Add:
import { useCaptureStore, getCooldownRemaining } from '@/stores/captureStore';
import type { ReviewAsset } from '@/stores/photoReviewStore';
```

Change the `capture` function signature from:

```ts
async function capture(asset: PendingCaptureAsset, caption?: string) {
```

to:

```ts
async function capture(asset: ReviewAsset, caption?: string) {
```

The function body is unchanged — `asset.type`, `asset.uri`, `asset.durationMs` all exist on `ReviewAsset`.

- [ ] **Step 4: Run TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If you see errors about `PendingCaptureAsset` being used elsewhere, track them down and replace with `ReviewAsset`.

- [ ] **Step 5: Run existing tests**

```bash
cd mobile && npx jest src/hooks/useCapture.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/stores/captureStore.ts mobile/src/hooks/useCapture.ts mobile/jest.setup.js
git commit -m "refactor(mobile): remove pendingAsset from captureStore, use ReviewAsset in useCapture"
```

---

## Task 4: Update capture.tsx

**Files:**
- Modify: `app/capture.tsx`

- [ ] **Step 1: Update capture.tsx**

In `app/capture.tsx`:

1. Remove the `useCaptureStore` import (we no longer call `setPendingAsset`).
2. Add the `usePhotoReviewStore` import.
3. Update `handleMediaCaptured`.

Full updated top of the file (imports + store):

```ts
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
```

Replace `handleMediaCaptured`:

```ts
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
```

Remove the line `const { setPendingAsset } = useCaptureStore();` and the call to `setPendingAsset`.

- [ ] **Step 2: TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(mobile): capture navigates to /photo-review via photoReviewStore"
```

---

## Task 5: AddPhotoSheet component

**Files:**
- Create: `src/components/ui/AddPhotoSheet.tsx`
- Create: `src/components/ui/__tests__/AddPhotoSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/__tests__/AddPhotoSheet.test.tsx`:

```tsx
import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, { ...props, ref, testID: props.testID ?? label }),
    );
  return { Ionicons: makeIcon('Ionicons') };
});

jest.mock('@/hooks/useUpload', () => ({
  useUpload: jest.fn(() => ({
    pickImages: jest.fn().mockResolvedValue([]),
    uploadImages: jest.fn(),
    uploading: false,
    progress: 0,
    failedCount: 0,
  })),
}));

jest.mock('@/stores/photoReviewStore', () => ({
  usePhotoReviewStore: jest.fn(() => ({ setAssets: jest.fn(), assets: [], clear: jest.fn() })),
}));

jest.mock('@lodev09/react-native-true-sheet', () => {
  const React = require('react');
  let onPresentRef: (() => void) | undefined;
  const TrueSheet = React.forwardRef((props: any, ref: any) => {
    onPresentRef = props.onDidPresent;
    const resolvedFn = jest.fn(() => Promise.resolve());
    React.useImperativeHandle(ref, () => ({ present: resolvedFn, dismiss: resolvedFn }));
    return React.createElement('TrueSheet', props, props.children);
  });
  (TrueSheet as any).__firePresent = () => { onPresentRef?.(); };
  return { TrueSheet };
});

import { AddPhotoSheet } from '@/components/ui/AddPhotoSheet';
import { useUpload } from '@/hooks/useUpload';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { router } from 'expo-router';

const { TrueSheet } = require('@lodev09/react-native-true-sheet');

describe('AddPhotoSheet', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('renders camera and upload rows', () => {
    const utils = render(<AddPhotoSheet visible={true} onClose={jest.fn()} />);
    expect(utils.getByText('Chụp ảnh mới')).toBeTruthy();
    expect(utils.getByText('Tải lên')).toBeTruthy();
  });

  it('pressing camera row navigates to /capture and calls onClose', async () => {
    const onClose = jest.fn();
    const utils = render(<AddPhotoSheet visible={true} onClose={onClose} />);
    fireEvent.press(utils.getByText('Chụp ảnh mới'));
    expect(router.push).toHaveBeenCalledWith('/capture');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('pressing upload row calls pickImages; on cancel calls onClose without navigating', async () => {
    const pickImages = jest.fn().mockResolvedValue([]);
    (useUpload as jest.Mock).mockReturnValue({ pickImages, uploadImages: jest.fn(), uploading: false, progress: 0, failedCount: 0 });
    const onClose = jest.fn();
    const utils = render(<AddPhotoSheet visible={true} onClose={onClose} />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên')); });
    await waitFor(() => expect(pickImages).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalledWith('/photo-review');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing upload row: on picked assets, sets store and navigates to /photo-review', async () => {
    const assets = [{ uri: 'file://a.jpg', localAssetId: 'id1', takenAt: null }];
    const pickImages = jest.fn().mockResolvedValue(assets);
    const setAssets = jest.fn();
    (useUpload as jest.Mock).mockReturnValue({ pickImages, uploadImages: jest.fn(), uploading: false, progress: 0, failedCount: 0 });
    (usePhotoReviewStore as unknown as jest.Mock).mockReturnValue({ setAssets, assets: [], clear: jest.fn() });
    const onClose = jest.fn();
    const utils = render(<AddPhotoSheet visible={true} onClose={onClose} />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên')); });
    await waitFor(() => {
      expect(setAssets).toHaveBeenCalledWith([
        expect.objectContaining({ uri: 'file://a.jpg', source: 'gallery', type: 'photo' }),
      ]);
      expect(router.push).toHaveBeenCalledWith('/photo-review');
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd mobile && npx jest src/components/ui/__tests__/AddPhotoSheet.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `AddPhotoSheet` not found.

- [ ] **Step 3: Create AddPhotoSheet.tsx**

Create `src/components/ui/AddPhotoSheet.tsx`:

```tsx
import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUpload } from '@/hooks/useUpload';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tap } from '@/lib/haptics';

interface AddPhotoSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AddPhotoSheet({ visible, onClose }: AddPhotoSheetProps) {
  const ref = useRef<TrueSheet>(null);
  const presented = useRef(false);
  const { pickImages } = useUpload();
  const setAssets = usePhotoReviewStore((s) => s.setAssets);

  React.useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present().catch(() => {});
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss().catch(() => {});
    }
  }, [visible]);

  function handleCamera() {
    tap();
    onClose();
    router.push('/capture');
  }

  async function handleUpload() {
    tap();
    onClose();
    const picked = await pickImages();
    if (!picked.length) return;
    setAssets(
      picked.map((a) => ({
        uri: a.uri,
        type: 'photo' as const,
        source: 'gallery' as const,
        takenAt: a.takenAt,
        localAssetId: a.localAssetId,
      })),
    );
    router.push('/photo-review');
  }

  return (
    <TrueSheet
      ref={ref}
      detents={['auto']}
      cornerRadius={24}
      backgroundColor={colors.background}
      onDidDismiss={() => { presented.current = false; onClose(); }}
    >
      <View style={styles.handle} />
      <View style={styles.sheet}>
        <TouchableOpacity style={styles.row} onPress={handleCamera} activeOpacity={0.7}>
          <View style={styles.iconWrap}>
            <Ionicons name="camera-outline" size={22} color={colors.pink} />
          </View>
          <Text style={styles.label}>{t('add_photo.camera')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={handleUpload} activeOpacity={0.7}>
          <View style={styles.iconWrap}>
            <Ionicons name="images-outline" size={22} color={colors.pink} />
          </View>
          <Text style={styles.label}>{t('add_photo.upload')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </TouchableOpacity>
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  handle:   { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginTop: spacing.md },
  sheet:    { padding: spacing['2xl'], paddingTop: spacing.lg, paddingBottom: spacing['4xl'] },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF0F5', alignItems: 'center', justifyContent: 'center' },
  label:    { ...typography.body, color: colors.ink, flex: 1, fontWeight: '600' },
  divider:  { height: 1, backgroundColor: colors.borderSoft },
});
```

- [ ] **Step 4: Run the tests**

```bash
cd mobile && npx jest src/components/ui/__tests__/AddPhotoSheet.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: all passing. If `colors.pinkLight` doesn't exist in the theme, replace with the hex `'#FFF0F5'` inline (it's already inline in the code above as a fallback).

- [ ] **Step 5: Check theme for pinkLight**

```bash
grep -n "pinkLight\|background" mobile/src/constants/theme.ts | head -20
```

If `pinkLight` is not in the theme, and `background` is `colors.cream`, update `iconWrap` backgroundColor to `'#FFF0F5'` directly (already done as fallback). No theme change needed.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/ui/AddPhotoSheet.tsx mobile/src/components/ui/__tests__/AddPhotoSheet.test.tsx
git commit -m "feat(mobile): add AddPhotoSheet action sheet (camera + gallery)"
```

---

## Task 6: photo-review.tsx — single asset

**Files:**
- Create: `app/photo-review.tsx`
- Create: `app/__tests__/photo-review.test.tsx` (partial — single asset tests)

- [ ] **Step 1: Write failing tests for single-asset behaviour**

Create `app/__tests__/photo-review.test.tsx`:

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

jest.mock('@/hooks/useCapture', () => ({
  useCapture: jest.fn(() => ({
    capture: jest.fn().mockResolvedValue({}),
    canCapture: true,
    nextAvailableAt: null,
    capturing: false,
  })),
}));

jest.mock('@/hooks/useUpload', () => ({
  useUpload: jest.fn(() => ({
    pickImages: jest.fn(),
    uploadImages: jest.fn().mockResolvedValue(0),
    uploading: false,
    progress: 0,
    failedCount: 0,
  })),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn(), success: jest.fn() }));

jest.mock('@/components/ui/Confetti', () => {
  const React = require('react');
  return { Confetti: () => React.createElement('View', { testID: 'confetti' }) };
});

// Video player mock
jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({ loop: false, muted: false, play: jest.fn() })),
}));

import { useCapture } from '@/hooks/useCapture';
import { useUpload } from '@/hooks/useUpload';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { router } from 'expo-router';
import PhotoReviewScreen from '@/app/photo-review';

function setStoreAssets(assets: any[]) {
  usePhotoReviewStore.setState({ assets });
}

beforeEach(() => {
  jest.clearAllMocks();
  usePhotoReviewStore.setState({ assets: [] });
});

describe('PhotoReview — single camera asset', () => {
  beforeEach(() => {
    setStoreAssets([{ uri: 'file://shot.jpg', type: 'photo', source: 'camera', takenAt: new Date().toISOString() }]);
  });

  it('renders polaroid card with note input', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...')).toBeTruthy();
  });

  it('shows Chụp lại button for camera source', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByText('Chụp lại')).toBeTruthy();
  });

  it('shows Gửi button', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByText('Gửi')).toBeTruthy();
  });

  it('pressing Gửi calls useCapture.capture with the asset and caption', async () => {
    const captureMock = jest.fn().mockResolvedValue({});
    (useCapture as jest.Mock).mockReturnValue({ capture: captureMock, canCapture: true, nextAvailableAt: null, capturing: false });
    const utils = render(<PhotoReviewScreen />);
    fireEvent.changeText(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...'), 'hello');
    await act(async () => { fireEvent.press(utils.getByText('Gửi')); });
    await waitFor(() => expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file://shot.jpg', source: 'camera' }),
      'hello',
    ));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('pressing Chụp lại calls router.back', () => {
    const utils = render(<PhotoReviewScreen />);
    fireEvent.press(utils.getByText('Chụp lại'));
    expect(router.back).toHaveBeenCalled();
  });

  it('shows cooldown Alert when canCapture is false and user presses Gửi', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (useCapture as jest.Mock).mockReturnValue({
      capture: jest.fn(),
      canCapture: false,
      nextAvailableAt: new Date(Date.now() + 20 * 60 * 1000),
      capturing: false,
    });
    const utils = render(<PhotoReviewScreen />);
    await act(async () => { fireEvent.press(utils.getByText('Gửi')); });
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('khoảnh khắc'),
      expect.any(String),
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });
});

describe('PhotoReview — single gallery asset', () => {
  beforeEach(() => {
    setStoreAssets([{ uri: 'file://gallery.jpg', type: 'photo', source: 'gallery', takenAt: null, localAssetId: 'lid1' }]);
  });

  it('renders note field', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...')).toBeTruthy();
  });

  it('does NOT show Chụp lại for gallery source', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.queryByText('Chụp lại')).toBeNull();
  });

  it('pressing Gửi calls useUpload.uploadImages with caption', async () => {
    const uploadImages = jest.fn().mockResolvedValue(0);
    (useUpload as jest.Mock).mockReturnValue({ pickImages: jest.fn(), uploadImages, uploading: false, progress: 0, failedCount: 0 });
    const utils = render(<PhotoReviewScreen />);
    fireEvent.changeText(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...'), 'sundays');
    await act(async () => { fireEvent.press(utils.getByText('Gửi')); });
    await waitFor(() => expect(uploadImages).toHaveBeenCalledWith(
      [expect.objectContaining({ uri: 'file://gallery.jpg' })],
      'sundays',
    ));
    expect(router.dismissAll).toHaveBeenCalled();
  });
});

describe('PhotoReview — multiple gallery assets', () => {
  beforeEach(() => {
    setStoreAssets([
      { uri: 'file://a.jpg', type: 'photo', source: 'gallery', takenAt: null },
      { uri: 'file://b.jpg', type: 'photo', source: 'gallery', takenAt: null },
      { uri: 'file://c.jpg', type: 'photo', source: 'gallery', takenAt: null },
    ]);
  });

  it('does NOT show note field', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.queryByPlaceholderText('ghi chú nhỏ cho ảnh...')).toBeNull();
  });

  it('shows upload CTA with count', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByText('Tải lên 3 ảnh')).toBeTruthy();
  });

  it('pressing upload CTA calls uploadImages with selected assets', async () => {
    const uploadImages = jest.fn().mockResolvedValue(0);
    (useUpload as jest.Mock).mockReturnValue({ pickImages: jest.fn(), uploadImages, uploading: false, progress: 0, failedCount: 0 });
    const utils = render(<PhotoReviewScreen />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên 3 ảnh')); });
    await waitFor(() => expect(uploadImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ uri: 'file://a.jpg' })]),
      undefined,
    ));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('shows Alert on partial failure', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const uploadImages = jest.fn().mockResolvedValue(1);
    (useUpload as jest.Mock).mockReturnValue({ pickImages: jest.fn(), uploadImages, uploading: false, progress: 0, failedCount: 0 });
    const utils = render(<PhotoReviewScreen />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên 3 ảnh')); });
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Tải lên không hoàn tất', expect.any(String)));
    alertSpy.mockRestore();
  });
});

describe('PhotoReview — empty assets', () => {
  it('navigates back when assets is empty on mount', () => {
    usePhotoReviewStore.setState({ assets: [] });
    render(<PhotoReviewScreen />);
    expect(router.back).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest app/__tests__/photo-review.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `PhotoReviewScreen` not found (module missing).

- [ ] **Step 3: Create app/photo-review.tsx**

Create `app/photo-review.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView,
  StyleSheet, StatusBar, useWindowDimensions, ActivityIndicator, Alert,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePhotoReviewStore, ReviewAsset } from '@/stores/photoReviewStore';
import { useCapture } from '@/hooks/useCapture';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { PhotoThumbnailGrid } from '@/components/upload/PhotoThumbnailGrid';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success, tap } from '@/lib/haptics';

function VideoPreview({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={{ width, height, borderRadius: 2 }} contentFit="cover" nativeControls={false} />;
}

function toUploadAsset(a: ReviewAsset): UploadAsset {
  return { uri: a.uri, localAssetId: a.localAssetId, takenAt: a.takenAt ?? null };
}

export default function PhotoReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const assets = usePhotoReviewStore((s) => s.assets);
  const clear = usePhotoReviewStore((s) => s.clear);
  const { capture, canCapture, nextAvailableAt, capturing } = useCapture();
  const { uploadImages, uploading, progress } = useUpload();

  const [caption, setCaption] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(assets.map((a) => a.uri)));
  const [celebrate, setCelebrate] = useState(false);

  const cardWidth = width - spacing['2xl'] * 2;
  const imageWidth = cardWidth - spacing.lg * 2;
  const dateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  React.useEffect(() => {
    if (assets.length === 0) router.back();
  }, []);

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uri) ? next.delete(uri) : next.add(uri);
      return next;
    });
  }

  async function handleSendSingle() {
    const asset = assets[0];
    if (asset.source === 'camera') {
      if (!canCapture) {
        const mins = nextAvailableAt
          ? Math.ceil((nextAvailableAt.getTime() - Date.now()) / 60000)
          : 30;
        Alert.alert(
          t('capture.cooldown_title'),
          t('capture.cooldown_body', { minutes: mins }),
          [
            { text: t('capture.cancel'), style: 'cancel' },
            { text: t('capture.cooldown_fallback'), onPress: () => { clear(); router.dismissAll(); } },
          ],
        );
        return;
      }
      try {
        await capture(asset, caption.trim() || undefined);
        tap();
        clear();
        router.dismissAll();
      } catch (err: any) {
        if (err?.response?.status === 429) {
          const secs = err.response.data?.retry_after_seconds ?? 1800;
          const mins = Math.ceil(secs / 60);
          Alert.alert(
            t('capture.cooldown_title'),
            t('capture.cooldown_body', { minutes: mins }),
            [
              { text: t('capture.cancel'), style: 'cancel' },
              { text: t('capture.cooldown_fallback'), onPress: () => { clear(); router.dismissAll(); } },
            ],
          );
        } else {
          Alert.alert(t('common.error'));
        }
      }
    } else {
      const failed = await uploadImages([toUploadAsset(asset)], caption.trim() || undefined);
      if (failed > 0) {
        Alert.alert(t('upload.error_title'), t('upload.error_body', { success: 0, failed }));
      } else {
        success();
        clear();
        router.dismissAll();
      }
    }
  }

  async function handleUploadMulti() {
    const toUpload = assets.filter((a) => selected.has(a.uri)).map(toUploadAsset);
    const failed = await uploadImages(toUpload);
    success();
    if (failed > 0) {
      Alert.alert(t('upload.error_title'), t('upload.error_body', { success: toUpload.length - failed, failed }));
    } else {
      setCelebrate(true);
      setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
    }
  }

  if (assets.length === 0) return null;

  const isSingle = assets.length === 1;
  const asset = assets[0];
  const count = selected.size;
  const ctaLabel = count === 1 ? t('photo_review.upload_one') : t('photo_review.upload_n', { n: count });
  const progressLabel = uploading
    ? (progress < 0.05 ? t('upload.compressing') : t('upload.uploading', { done: Math.round(progress * count), total: count }))
    : '';

  if (isSingle) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <StatusBar hidden />
        <View style={[styles.card, { width: cardWidth }]}>
          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} width={imageWidth} height={imageWidth * 0.75} />
          ) : (
            <Image source={{ uri: asset.uri }} style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]} resizeMode="cover" />
          )}
          <View style={styles.cardFooter}>
            <TextInput
              style={styles.captionInput}
              placeholder={t('photo_review.note_ph')}
              placeholderTextColor={colors.inkMuted}
              value={caption}
              onChangeText={(v) => setCaption(v.slice(0, 60))}
              maxLength={60}
              returnKeyType="done"
            />
            <Text style={styles.dateStamp}>{dateStr}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {asset.source === 'camera' && (
            <TouchableOpacity style={styles.retakeBtn} onPress={() => router.back()} disabled={capturing}>
              <Ionicons name="camera-outline" size={20} color={colors.ink} />
              <Text style={styles.retakeBtnText}>{t('photo_review.retake')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.sendBtn, asset.source !== 'camera' && styles.sendBtnFull]}
            onPress={handleSendSingle}
            disabled={capturing || uploading}
          >
            {(capturing || uploading)
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="paper-plane-outline" size={20} color={colors.white} />
                  <Text style={styles.sendBtnText}>{t('photo_review.send')}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.multiContainer, { paddingTop: insets.top }]}>
      <StatusBar hidden />
      <ScrollView contentContainerStyle={styles.multiContent}>
        <PhotoThumbnailGrid
          assets={assets.map(toUploadAsset)}
          selected={selected}
          onToggle={toggleSelect}
        />
        {uploading && <Text style={styles.progress}>{progressLabel}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={ctaLabel} onPress={handleUploadMulti} fullWidth loading={uploading} disabled={!count} />
      </View>
      <Confetti visible={celebrate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream, alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  card:           { backgroundColor: colors.white, padding: spacing.lg, paddingBottom: spacing.md, borderRadius: 4, shadowColor: '#7C5CBF', shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  image:          { borderRadius: 2 },
  cardFooter:     { marginTop: spacing.sm, gap: spacing.xs },
  captionInput:   { fontFamily: 'Caveat_600SemiBold', fontSize: 18, color: colors.ink, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateStamp:      { ...typography.caption, color: colors.inkMuted, textAlign: 'right', marginTop: spacing.xs },
  actions:        { flexDirection: 'row', gap: spacing.md, marginTop: spacing['2xl'] },
  retakeBtn:      { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 14, paddingVertical: spacing.md },
  retakeBtnText:  { ...typography.body, color: colors.ink, fontWeight: '600' },
  sendBtn:        { flex: 2, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pink, borderRadius: 14, paddingVertical: spacing.md },
  sendBtnFull:    { flex: 1 },
  sendBtnText:    { ...typography.body, color: colors.white, fontWeight: '700' },
  multiContainer: { flex: 1, backgroundColor: colors.cream },
  multiContent:   { padding: spacing['2xl'] },
  footer:         { padding: spacing['2xl'] },
  progress:       { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.md, fontFamily: 'Caveat_500Medium', fontSize: 18 },
});
```

- [ ] **Step 4: Run the tests**

```bash
cd mobile && npx jest app/__tests__/photo-review.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: all passing. Common issues:
- `colors.border`, `colors.inkSoft`, `colors.background` all exist in the theme — no substitution needed.
- If `expo-video` mock conflicts, ensure the `jest.mock('expo-video', ...)` call is at the top of the test file before imports.

- [ ] **Step 5: TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/photo-review.tsx app/__tests__/photo-review.test.tsx
git commit -m "feat(mobile): unified photo review screen (single + multi asset)"
```

---

## Task 7: Wire up albums/[id].tsx

**Files:**
- Modify: `app/albums/[id].tsx`

- [ ] **Step 1: Update the album detail screen**

Replace the entire `app/albums/[id].tsx` with:

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { InviteSheet } from '@/components/family/InviteSheet';
import { AddPhotoSheet } from '@/components/ui/AddPhotoSheet';
import { useAlbumStore } from '@/stores/albumStore';
import { tap } from '@/lib/haptics';
import { colors, shadows, spacing, typography } from '@/constants/theme';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const albumName = useAlbumStore((s) => s.albumName);
  const isPrivate = useAlbumStore((s) => s.isPrivate);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [addPhotoVisible, setAddPhotoVisible] = useState(false);

  function handleFab() {
    tap();
    setAddPhotoVisible(true);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        {isPrivate === false ? (
          <TouchableOpacity onPress={() => setInviteVisible(true)} hitSlop={8} style={styles.inviteBtn} testID="invite-btn">
            <Ionicons name="person-add-outline" size={22} color={colors.ink} />
          </TouchableOpacity>
        ) : (
          <View style={styles.inviteBtn} />
        )}
      </View>

      <TimelineFeed onJumpToDay={() => {}} />

      <TouchableOpacity
        testID="timeline-upload-fab"
        onPress={handleFab}
        activeOpacity={0.85}
        style={[styles.fabWrap, { bottom: spacing['2xl'] + insets.bottom }]}
      >
        <LinearGradient
          colors={[colors.peach, colors.pink]}
          style={styles.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={26} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} />
      <AddPhotoSheet visible={addPhotoVisible} onClose={() => setAddPhotoVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn:   { width: 32 },
  title:     { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  inviteBtn: { width: 32, alignItems: 'flex-end' },
  fabWrap: {
    position: 'absolute',
    right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.fab,
  },
  fab: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Run existing album screen tests**

```bash
cd mobile && npx jest app/__tests__/_layout.test.tsx --no-coverage 2>&1 | tail -10
```

Check if there are album-specific tests:

```bash
ls mobile/app/__tests__/
```

Run any that exist. Expected: all passing.

- [ ] **Step 3: TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/albums/[id].tsx
git commit -m "feat(mobile): wire AddPhotoSheet into album detail FAB"
```

---

## Task 8: Delete old files

**Files to delete:**
- `app/capture-review.tsx`
- `src/components/upload/UploadSheet.tsx`
- `src/components/upload/UploadSheet.test.tsx`
- `src/stores/uploadSheetStore.ts`

- [ ] **Step 1: Delete files**

```bash
cd mobile && git rm app/capture-review.tsx src/components/upload/UploadSheet.tsx src/components/upload/UploadSheet.test.tsx src/stores/uploadSheetStore.ts
```

- [ ] **Step 2: TypeScript check — ensure no dangling imports**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -30
```

If there are errors about missing imports from deleted files, fix them:
- Any import of `capture-review` → should not exist after Task 4
- Any import of `UploadSheet` → replace with `AddPhotoSheet` (Task 5 already does this)
- Any import of `uploadSheetStore` → was removed from `albums/[id].tsx` in Task 7

- [ ] **Step 3: Run full test suite**

```bash
cd mobile && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all passing. If `UploadSheet.test.tsx` errors are gone (file deleted) and new tests pass, you're done.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mobile): delete capture-review, UploadSheet, uploadSheetStore — replaced by photo-review + AddPhotoSheet"
```

---

## Task 9: Final check

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd mobile && npx jest --coverage 2>&1 | tail -30
```

Expected: coverage thresholds pass (≥90% statements/branches/functions/lines). If any threshold fails, add the missing test cases.

- [ ] **Step 2: TypeScript clean build**

```bash
cd mobile && npx tsc --noEmit 2>&1
```

Expected: no output (no errors).

- [ ] **Step 3: Commit (if anything was fixed)**

If coverage required fixes, commit them:

```bash
git add -p
git commit -m "test(mobile): add missing coverage for photo-review edge cases"
```
