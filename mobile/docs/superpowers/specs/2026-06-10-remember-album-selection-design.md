# Remember Album Selection — Design Spec

**Date:** 2026-06-10
**Status:** Approved

## Problem

On the photo review screen (`app/photo-review.tsx`), users must manually re-select albums every time they capture a photo. For most users the selection rarely changes, so repeating it is friction.

## Goal

Persist the last-used album selection to device storage and auto-select those albums the next time the review screen opens.

---

## Architecture

### New file: `src/hooks/useLastAlbumSelection.ts`

A focused hook that owns all AsyncStorage I/O for this feature.

**AsyncStorage key:** `photo_review_last_album_ids`

**Interface:**
```ts
function useLastAlbumSelection(): {
  savedIds: string[] | null;  // null = still loading
  persist: (ids: string[]) => Promise<void>;
}
```

**Behaviour:**
- On mount, reads the key from AsyncStorage and parses the JSON array into `savedIds`.
- Read errors (missing key, parse failure, storage unavailable) fall back to `[]` silently — never throws.
- `persist(ids)` writes the array as JSON. Caller does not need to await it; fire-and-forget is acceptable since a write failure just means the next session falls back to empty.

### Changes to `app/photo-review.tsx`

**Auto-select on open:**
```
useEffect fires when: savedIds !== null AND albums.length > 0
  → intersect savedIds with current album IDs (filter deleted albums)
  → if any valid IDs remain, call setSelectedIds(new Set(validIds))
  → ref guard ensures this runs at most once per screen visit
```

The ref guard is necessary because `savedIds` and `albums` may arrive asynchronously in either order (AsyncStorage vs React Query cache), and we must not reset the user's in-progress selection after they've started tapping.

**Persist on save:**
In `handleSave`, after `finishCapture` resolves successfully and before `setCelebrate(true)`, call `persist(albumIds)`.

---

## Data Flow

```
Mount
  ├── useLastAlbumSelection → AsyncStorage.getItem → savedIds
  └── useAlbums → React Query (cache or network) → albums

Effect (runs once, when both are ready)
  └── intersection(savedIds, albums) → setSelectedIds

User taps albums → selectedIds updated

handleSave (success path)
  └── persist(albumIds) → AsyncStorage.setItem
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Saved album was deleted | Filtered out by intersection; if nothing remains, save button stays disabled |
| AsyncStorage read fails | Treated as `[]`; user starts with no pre-selection |
| Albums still loading when AsyncStorage responds | Effect idles until both are ready |
| Albums arrive from RQ cache synchronously, AsyncStorage still loading | Same — effect waits for `savedIds !== null` |
| User dismisses without saving | Selection not persisted (close/retake paths skip `persist`) |
| User saves with a different selection | New selection overwrites stored value |

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useLastAlbumSelection.ts` | New — hook |
| `app/photo-review.tsx` | Use hook, add init effect, call persist on save |
| `app/__tests__/photo-review.test.tsx` | Update — mock hook, add auto-select tests |

A test file for the hook itself (`src/hooks/__tests__/useLastAlbumSelection.test.ts`) should be added to cover: load success, load failure fallback, persist call.

---

## Out of Scope

- Remembering caption text
- Per-album-context defaults (same default regardless of which album the user navigates from)
- Syncing selection across devices
