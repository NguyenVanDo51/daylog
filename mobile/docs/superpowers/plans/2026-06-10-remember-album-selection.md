# Remember Album Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the last-used album selection to device storage and auto-restore it when the photo review screen opens.

**Architecture:** A new `useLastAlbumSelection` hook owns all AsyncStorage I/O (key `photo_review_last_album_ids`). `photo-review.tsx` uses the hook: an effect (guarded by a ref) seeds `selectedIds` from the intersection of saved IDs and current albums once both are available; `handleSave` fires a non-awaited persist call after `finishCapture` succeeds.

**Tech Stack:** React Native, Zustand, `@react-native-async-storage/async-storage`, `@testing-library/react-native`, Jest (`jest-expo` preset)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/hooks/useLastAlbumSelection.ts` | Create | AsyncStorage read/write, exposes `savedIds` + `persist` |
| `src/hooks/useLastAlbumSelection.test.ts` | Create | Unit tests for the hook |
| `app/photo-review.tsx` | Modify | Use hook, init effect, persist on save |
| `app/__tests__/photo-review.test.tsx` | Modify | Mock hook, add auto-select + persist tests |

---

## Task 1: `useLastAlbumSelection` hook (TDD)

**Files:**
- Create: `src/hooks/useLastAlbumSelection.ts`
- Create: `src/hooks/useLastAlbumSelection.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useLastAlbumSelection.test.ts`:

```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLastAlbumSelection } from './useLastAlbumSelection';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useLastAlbumSelection', () => {
  it('starts as null then resolves to saved ids', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['album-1', 'album-2']));
    const { result } = renderHook(() => useLastAlbumSelection());
    expect(result.current.savedIds).toBeNull();
    await waitFor(() => expect(result.current.savedIds).toEqual(['album-1', 'album-2']));
  });

  it('resolves to empty array when key not set', async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
  });

  it('falls back to empty array on AsyncStorage read error', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
  });

  it('persist writes ids to AsyncStorage as JSON', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
    await act(async () => { await result.current.persist(['album-3', 'album-4']); });
    expect(mockSetItem).toHaveBeenCalledWith(
      'photo_review_last_album_ids',
      '["album-3","album-4"]',
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/hooks/useLastAlbumSelection.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './useLastAlbumSelection'`

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useLastAlbumSelection.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'photo_review_last_album_ids';

export function useLastAlbumSelection() {
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setSavedIds(raw ? JSON.parse(raw) : []))
      .catch(() => setSavedIds([]));
  }, []);

  const persist = useCallback(
    (ids: string[]) => AsyncStorage.setItem(KEY, JSON.stringify(ids)),
    [],
  );

  return { savedIds, persist };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/hooks/useLastAlbumSelection.test.ts --no-coverage
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useLastAlbumSelection.ts mobile/src/hooks/useLastAlbumSelection.test.ts
git commit -m "feat: add useLastAlbumSelection hook for persisting album picks"
```

---

## Task 2: Wire the hook into `photo-review.tsx`

**Files:**
- Modify: `app/photo-review.tsx`

---

- [ ] **Step 1: Add the import**

In `app/photo-review.tsx`, add this import after the existing hook imports:

```typescript
import { useLastAlbumSelection } from '@/hooks/useLastAlbumSelection';
```

- [ ] **Step 2: Add hook call and ref inside `PhotoReviewScreen`**

After the line `const uploadPromiseRef = useRef<Promise<UploadResult>>();`, add:

```typescript
const { savedIds, persist } = useLastAlbumSelection();
const initializedRef = useRef(false);
```

- [ ] **Step 3: Add the auto-select effect**

After the existing `useEffect` block (the one that calls `startBackgroundUpload`), add:

```typescript
useEffect(() => {
  if (initializedRef.current || savedIds === null || albums.length === 0) return;
  initializedRef.current = true;
  const valid = savedIds.filter((id) => albums.some((a) => a.id === id));
  if (valid.length > 0) setSelectedIds(new Set(valid));
}, [savedIds, albums]);
```

- [ ] **Step 4: Persist on save**

Inside `handleSave`, add `void persist(albumIds);` immediately after the `await finishCapture(...)` line:

```typescript
async function handleSave() {
  const albumIds = Array.from(selectedIds);
  setSaving(true);
  try {
    const result = await uploadPromiseRef.current!;
    await finishCapture(result, asset, albumIds, caption.trim() || null);
    void persist(albumIds);
    success();
    setCelebrate(true);
    setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
  } catch {
    Alert.alert('Lỗi', 'Không thể lưu ảnh. Thử lại nhé.');
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/photo-review.tsx
git commit -m "feat(photo-review): auto-select previously saved albums on open"
```

---

## Task 3: Update `photo-review.test.tsx`

**Files:**
- Modify: `app/__tests__/photo-review.test.tsx`

---

- [ ] **Step 1: Add mock and wiring at the top of the test file**

After the existing `jest.mock('@/lib/haptics', ...)` call, add:

```typescript
const mockPersist = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/useLastAlbumSelection', () => ({
  useLastAlbumSelection: jest.fn(),
}));
```

After all existing imports (after `import PhotoReviewScreen from '../photo-review';`), add:

```typescript
import { useLastAlbumSelection } from '@/hooks/useLastAlbumSelection';
const mockUseLastAlbumSelection = useLastAlbumSelection as jest.Mock;
```

- [ ] **Step 2: Set the default mock return value in `beforeEach`**

Inside the existing `beforeEach`, add:

```typescript
mockPersist.mockResolvedValue(undefined);
mockUseLastAlbumSelection.mockReturnValue({ savedIds: [], persist: mockPersist });
```

- [ ] **Step 3: Run the existing tests to confirm nothing broke**

```bash
cd mobile && npx jest app/__tests__/photo-review.test.tsx --no-coverage
```

Expected: PASS — all existing tests pass

- [ ] **Step 4: Add the new auto-select and persist tests**

Inside the `describe('PhotoReview', ...)` block, add after the last existing test:

```typescript
it('auto-selects saved album ids that still exist in the list', () => {
  mockUseLastAlbumSelection.mockReturnValue({ savedIds: ['album-1'], persist: mockPersist });
  const { getByTestId } = render(<PhotoReviewScreen />);
  const saveBtn = getByTestId('review-save');
  const isDisabled = saveBtn.props.disabled ?? saveBtn.props.accessibilityState?.disabled;
  expect(isDisabled).toBeFalsy();
});

it('does not auto-select ids for albums that no longer exist', () => {
  mockUseLastAlbumSelection.mockReturnValue({ savedIds: ['album-deleted'], persist: mockPersist });
  const { getByTestId } = render(<PhotoReviewScreen />);
  const saveBtn = getByTestId('review-save');
  const isDisabled = saveBtn.props.disabled ?? saveBtn.props.accessibilityState?.disabled;
  expect(isDisabled).toBeTruthy();
});

it('does not auto-select when savedIds is null (still loading)', () => {
  mockUseLastAlbumSelection.mockReturnValue({ savedIds: null, persist: mockPersist });
  const { getByTestId } = render(<PhotoReviewScreen />);
  const saveBtn = getByTestId('review-save');
  const isDisabled = saveBtn.props.disabled ?? saveBtn.props.accessibilityState?.disabled;
  expect(isDisabled).toBeTruthy();
});

it('persists selected album ids after successful save', async () => {
  const { getByTestId } = render(<PhotoReviewScreen />);
  fireEvent.press(getByTestId('album-checkbox-album-1'));
  await act(async () => { fireEvent.press(getByTestId('review-save')); });
  expect(mockPersist).toHaveBeenCalledWith(['album-1']);
});

it('does not persist when finishCapture throws', async () => {
  mockFinishCapture.mockRejectedValueOnce(new Error('server error'));
  const { getByTestId } = render(<PhotoReviewScreen />);
  fireEvent.press(getByTestId('album-checkbox-album-1'));
  await act(async () => { fireEvent.press(getByTestId('review-save')); });
  expect(mockPersist).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Run all photo-review tests**

```bash
cd mobile && npx jest app/__tests__/photo-review.test.tsx --no-coverage
```

Expected: PASS — all tests (existing + new) pass

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
cd mobile && npx jest --no-coverage
```

Expected: PASS — all tests pass, coverage thresholds met

- [ ] **Step 7: Commit**

```bash
git add mobile/app/__tests__/photo-review.test.tsx
git commit -m "test(photo-review): add coverage for album auto-select and persist"
```
