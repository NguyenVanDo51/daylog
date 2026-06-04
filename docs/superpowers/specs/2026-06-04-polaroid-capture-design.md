# Khoảnh Khắc — Polaroid Capture Design Spec

**Date:** 2026-06-04
**Status:** Approved

---

## Overview

Thêm luồng chụp ảnh/video trực tiếp trong app ("Khoảnh khắc") song song với flow upload từ camera roll hiện có. Mục tiêu:

1. **Feedback loop tức thì**: mẹ chụp → bố nhận push ngay → react → mẹ nhận push.
2. **Không tốn dung lượng máy**: ảnh/video không save về camera roll, upload thẳng lên R2.
3. **Visual differentiation**: ảnh capture render dạng Polaroid card trong timeline (Caveat font + date stamp), tách biệt với ảnh upload curated.

Rate limit: **1 capture / 30 phút / user** để giữ tính "khoảnh khắc đáng nhớ".

---

## User Flow

```
MẸ                                              BỐ
─────────────────────────────────────         ──────────────────────────────
Tap 📷 trên Home header
       ↓
Permission prompt (camera, lần đầu)
       ↓
Camera full-screen
  ├─ Tap shutter      → chụp ảnh
  └─ Long-press       → quay video silent (tối đa 2s, progress ring)
       ↓
Review trong Polaroid frame
  + caption optional (≤60 ký tự)
  + Chụp lại / Gửi
       ↓
Tap "Gửi"
  → check rate limit (30 phút)
  → compress + upload → POST /photos (source='capture')
       ↓                                       Push: "Mẹ vừa gửi một khoảnh khắc"
Confetti + close                  ──push──►   Tap → photo/video detail
                                              ↓
                                              React → push lại cho mẹ
```

---

## Capture Modes

| Gesture | Mode | Format |
|---|---|---|
| Tap shutter | Photo | WebP (compress via expo-image-manipulator) |
| Long-press shutter ≥250ms | Video | MP4, 720p, silent, ≤2s |

Không có toggle mode riêng — một shutter button, hai gesture. First-time hint: *"Giữ để quay video 2s"* (toast 3s, lưu flag `capture.hint_seen` local).

---

## UI Components

### `app/capture.tsx` — Camera Screen

- `expo-camera` `CameraView` full-screen
- **Top bar:** X close (trái), flip camera (phải)
- **Shutter button** (bottom center):
  - `LongPressGesture` (RNGH): `onBegin` → bắt đầu hiện progress ring + start record; `onEnd`/`onFinalize` → stop record; auto-stop ở 2s
  - Regular tap → `takePictureAsync({ quality: 0.85, skipProcessing: true })`
  - Record: `recordAsync({ maxDuration: 2, mute: true, quality: '720p' })`
- Permission denied → modal + `Linking.openSettings()`
- Không request microphone permission (silent video)
- Không request media library (không save local)
- `AppState` listener: background mid-record → cancel + reset

### `app/capture-review.tsx` — Review Screen

- Polaroid card centered trên `colors.background`
- Card layout: viền trắng đều → media (aspect ratio tự nhiên) → bottom: caption input + date stamp
  - Caption: Caveat font, 16px, placeholder *"Note một dòng..."*, max 60 ký tự
  - Date stamp: 10px, right-aligned, format `dd/MM HH:mm` (device timezone)
  - Video: autoplay loop muted
- Bottom: ghost "Chụp lại" + primary "Gửi"
- Khi tap "Gửi": disable button + spinner; giữ asset nếu fail (không discard)

### `PolaroidCard` — Timeline Component (mới)

Dùng khi `photo.source === 'capture'`. Bổ sung vào timeline song song `PhotoRow`.

- Full-width, white border, `shadow.card`
- Media: `expo-image` cho photo, `expo-video` cho video (autoplay muted, loop)
- Caption: Caveat 16px, max 2 lines
- Date stamp: bottom-right, 10px
- Reaction overlay: góc dưới phải (giống PhotoRow hiện tại)
- Video autoplay chỉ khi visible (`FlatList.onViewableItemsChanged` → pause off-screen)

### `app/photo/[id].tsx` — Detail (cập nhật)

- Detect `media_type === 'video'` → render `expo-video` full-screen, tap toggle play/pause
- `source === 'capture'` → hiện Polaroid frame + caption + date

### Home Header — Entry Point

Thêm icon 📷 (`Ionicons camera-outline`) cạnh icon ➕ hiện có. 2 icon riêng biệt, 1 tap → camera screen.

Rate limit enforcement 2 lớp:
1. **Client (trước khi vào camera):** Check `canCapture` từ `useCapture`. Khi trong cooldown: tap 📷 → modal *"Bạn có thể chụp tiếp sau X phút."* + nút *"Hoặc upload từ máy"* (mở UploadSheet). Không mở camera.
2. **Server (POST /photos):** Source of truth. Return 429 nếu cooldown chưa hết (bảo vệ khỏi bypass client).

---

## Data Model

```sql
ALTER TABLE photos
  ADD COLUMN media_type        VARCHAR(8)  NOT NULL DEFAULT 'photo',  -- 'photo' | 'video'
  ADD COLUMN source            VARCHAR(8)  NOT NULL DEFAULT 'upload', -- 'capture' | 'upload'
  ADD COLUMN duration_ms       INTEGER     NULL,
  ADD COLUMN thumbnail_r2_key  TEXT        NULL;

ALTER TABLE photos
  ADD CONSTRAINT photos_video_requires_meta
    CHECK (
      media_type = 'photo'
      OR (
        media_type = 'video'
        AND duration_ms IS NOT NULL
        AND thumbnail_r2_key IS NOT NULL
        AND duration_ms <= 2000
      )
    );

CREATE INDEX idx_photos_capture_rate_limit
  ON photos (uploader_id, created_at DESC)
  WHERE source = 'capture';
```

Existing rows: `media_type='photo'`, `source='upload'` (DEFAULT, backward compatible).

---

## API Changes

### `POST /presign` (existing)

- Extend MIME whitelist: thêm `video/mp4`
- Video capture: client gọi 2 lần song song (1 video, 1 thumbnail)
- Tiếp tục issue `presign_tokens` cho cả 2

### `POST /photos` (existing) — new fields

```ts
{
  album_id: UUID,
  r2_key: string,
  caption?: string,            // max 60 chars
  taken_at: ISO timestamp,
  media_type?: 'photo' | 'video',         // default 'photo'
  source?: 'capture' | 'upload',          // default 'upload'
  duration_ms?: number,                   // required if media_type='video', ≤ 2000
  thumbnail_r2_key?: string,              // required if media_type='video'
}
```

**Validation thêm:**
- `media_type='video'`: require `duration_ms ≤ 2000` + `thumbnail_r2_key`, verify cả 2 ownership qua `presign_tokens`
- `source='capture'`: enforce rate limit query (xem dưới)

### Rate Limit (server-side)

```sql
SELECT created_at FROM photos
WHERE uploader_id = $1 AND source = 'capture'
ORDER BY created_at DESC LIMIT 1
```

Nếu `now() - last_capture < 30 minutes` → HTTP 429:

```json
{
  "error": "rate_limited",
  "retry_after_seconds": 1234,
  "message": "Bạn có thể chụp tiếp sau 23 phút."
}
```

### Push Notification — new event

| Trường | Giá trị |
|---|---|
| Trigger | `POST /photos` thành công + `source='capture'` |
| Recipients | Tất cả album members EXCEPT uploader |
| Title | `Khoảnh khắc mới` |
| Body | `{uploader_name} vừa gửi một khoảnh khắc` |
| Deep link | `family-guy://photo/{photo_id}` |
| Infra | Reuse notification pipeline từ reactions |

---

## Client Architecture

### `useCapture` hook — `src/hooks/useCapture.ts`

```ts
type CaptureAsset =
  | { type: 'photo'; uri: string }
  | { type: 'video'; uri: string; durationMs: number };

function useCapture() {
  return {
    capture: (asset: CaptureAsset, caption?: string) => Promise<Photo>,
    canCapture: boolean,           // false khi trong cooldown
    nextAvailableAt: Date | null,
    capturing: boolean,
  };
}
```

**Pipeline photo:** compress → presign → PUT R2 → POST /photos  
**Pipeline video:** extract thumbnail → presign ×2 parallel → PUT video + PUT thumbnail parallel → POST /photos

### `useCaptureStore` — Zustand persisted

```ts
{ lastCaptureAt: number | null }  // ms timestamp
```

Client compute cooldown từ `lastCaptureAt + 30min`. Server là source of truth.

---

## Edge Cases & Error Handling

| Tình huống | Behavior |
|---|---|
| Camera permission denied | Modal + Linking.openSettings() |
| Offline khi tap "Gửi" | Toast error, giữ asset trong review (không discard) |
| Upload fail | Auto-retry 1 lần → toast + giữ review screen |
| 429 rate-limited | Modal countdown + nút "Hoặc upload từ máy" |
| App background mid-record | AppState listener → cancel record + reset UI |
| Long-press nhả < 250ms | Không record, không show review |
| Storage device full | Toast "Bộ nhớ máy đầy" (catch từ camera API) |
| Compress fail | Fallback: upload original |
| Thumbnail extract fail | Implementation sẽ verify expo-video-thumbnails SDK 56; fallback nếu không work |
| No album | Ẩn nút 📷 (giống ẩn nút ➕) |
| Multi-album: capture đi đâu | Album active hiện tại (Zustand `activeAlbumId`) |
| Date timezone | Display timezone máy user; store UTC |
| Caption > 60 ký tự | Truncate ở input; server validate |

---

## Testing

### Backend
- Rate limit: no prior capture, exactly 30min boundary, mid-cooldown
- Validation: video missing `duration_ms`, `duration_ms > 2000`, missing `thumbnail_r2_key`
- Push emit: trigger khi source=capture, không trigger khi source=upload
- MIME whitelist: accept `video/mp4`, reject `video/avi`

### Mobile
- `useCapture` hook: photo pipeline, video pipeline (mock presign + upload), rate limit compute
- `PolaroidCard`: photo, video + poster, caption truncation, date format
- Camera screen permission denial flow
- Cooldown modal với countdown, fallback to UploadSheet

### E2E smoke test (manual trước merge)
1. Capture photo → timeline xuất hiện Polaroid card
2. Capture video → timeline autoplay loop muted
3. Capture lần 2 trong 30min → modal cooldown
4. Bố nhận push → tap → mở đúng photo detail
5. React → push về mẹ

---

## Out of Scope (post-MVP)

- Warm color filter / tones trên Polaroid
- Save về camera roll (opt-in toggle)
- Audio video
- Multi-shot burst capture
- "Khoảnh khắc hôm nay" Stories feed riêng
- Live Photo (1s trước + sau)
- Offline queue (capture offline → upload khi online)
- Capture analytics
- Custom Polaroid frame styles
