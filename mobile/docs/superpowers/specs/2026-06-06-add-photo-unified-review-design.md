# Add Photo — Action Sheet + Unified Review Screen

**Date:** 2026-06-06

## Overview

Album detail hiện có FAB chỉ mở gallery upload. Thêm lựa chọn chụp ảnh bằng camera, và thống nhất giao diện preview cho cả hai luồng:

- 1 ảnh → preview polaroid + note field
- Nhiều ảnh → thumbnail grid, không có note

## Flow

```
Album detail FAB
  → AddPhotoSheet (action sheet, Option C)
      ├── "Chụp ảnh mới"  → /capture (existing) → set photoReviewStore → /photo-review
      └── "Tải lên"       → ImagePicker → set photoReviewStore → /photo-review

/photo-review
  ├── 1 asset  → polaroid card + note field + "Gửi"
  └── N assets → thumbnail grid + "Tải lên" (no note)
```

## Components & Files

### New: `src/stores/photoReviewStore.ts`

Holds assets pending review. Replaces `captureStore.pendingAsset`.

```ts
interface ReviewAsset {
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
```

Not persisted (in-memory only — assets are transient).

### New: `src/components/ui/AddPhotoSheet.tsx`

Small TrueSheet (`detents: ['auto']`) with 2 action rows:

- **Chụp ảnh mới** — icon camera → `router.push('/capture')`; dismisses sheet first
- **Tải lên** — icon image → calls `pickImages()` from `useUpload`, then sets `photoReviewStore.assets`, navigates to `/photo-review`; dismisses sheet first

Props: `{ visible: boolean; onClose: () => void }`

If `pickImages()` returns empty (user cancelled), calls `onClose()` — no navigation, no error.

### New: `app/photo-review.tsx`

Unified preview screen. Reads assets from `photoReviewStore`.

**Single asset (1 photo or video):**
- Full polaroid card (same style as current `capture-review`)
- Caption/note TextInput (max 60 chars), placeholder from i18n
- Date stamp bottom-right
- Actions row: "Chụp lại" (camera only, source === 'camera') + "Gửi"
- On send: calls `useCapture.capture(asset, caption)` if source === 'camera', else `useUpload.uploadImages([asset], caption)`
- On success: `photoReviewStore.clear()` + `router.dismissAll()`

**Multiple assets (N > 1, always gallery):**
- `PhotoThumbnailGrid` (reuse from existing `UploadSheet`)
- Toggle select individual photos (all selected by default)
- No note field
- Bottom: "Tải lên N ảnh" button
- On upload: calls `useUpload.uploadImages(selectedAssets)`
- Progress indicator during upload (same as old UploadSheet)
- On success: confetti + `photoReviewStore.clear()` + `router.dismissAll()`

**Edge case:** if `assets` is empty on mount, navigate back immediately.

**Cooldown (camera single):** if `useCapture.canCapture === false`, show cooldown alert (same as current `capture-review` logic).

### Modified: `app/albums/[id].tsx`

- Add `addPhotoVisible` state
- FAB `onPress` → `setAddPhotoVisible(true)`
- Render `<AddPhotoSheet visible={addPhotoVisible} onClose={() => setAddPhotoVisible(false)} />`
- Remove `useUploadSheetStore` import and usage

### Modified: `app/capture.tsx`

After capture (`handleMediaCaptured`):
- Set `photoReviewStore.assets` with the captured asset (source: 'camera')
- Navigate to `/photo-review` (unchanged route, just different store)
- Remove `captureStore.setPendingAsset` call

### Modified: `src/stores/captureStore.ts`

- Remove `pendingAsset`, `setPendingAsset`, `clearPendingAsset` fields
- Keep `lastCaptureAt` + `setLastCaptureAt` (cooldown tracking)

### Deleted

| File | Reason |
|---|---|
| `app/capture-review.tsx` | Replaced by `app/photo-review.tsx` |
| `src/components/upload/UploadSheet.tsx` | Logic moved into AddPhotoSheet + photo-review |
| `src/components/upload/UploadSheet.test.tsx` | Paired with deleted component |
| `src/stores/uploadSheetStore.ts` | No longer needed |

`src/components/upload/PhotoThumbnailGrid.tsx` is **kept** — reused by `photo-review`.

## i18n

Add to `vi.ts` and `en.ts`:

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

Existing `capture.*` keys (send, retake, cooldown) can be removed or kept for backward compat — no longer referenced.

## Error Handling

- Upload partial failure: same Alert as old UploadSheet (`upload.error_title` / `upload.error_body`)
- Camera cooldown: same Alert as old `capture-review` (cooldown_title / cooldown_body)
- Empty pick (user cancels gallery): `onClose()`, no navigation

## Tests

- `AddPhotoSheet`: renders 2 options, camera press → router.push('/capture'), upload press → picks images and navigates to /photo-review
- `photo-review` (single): renders polaroid, note field shown, send calls useCapture
- `photo-review` (multi): renders grid, no note field, upload calls useUpload
- `captureStore`: pendingAsset fields removed
