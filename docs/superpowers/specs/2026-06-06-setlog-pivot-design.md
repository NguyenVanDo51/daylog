# Setlog Pivot — Design Spec

**Date:** 2026-06-06
**Status:** Approved

---

## Overview

Thay đổi hướng tiếp cận của app thành một nhật ký ảnh/video hàng ngày lấy cảm hứng từ Setlog. Mỗi ngày người dùng chụp ảnh hoặc video 2 giây, gán vào album, xem lại dạng story theo ngày. Không compile video trước — chỉ compile khi user muốn xuất.

---

## Navigation Architecture

Dùng Expo Router `(tabs)` với custom tab bar và `react-native-pager-view` để hỗ trợ vuốt ngang.

```
app/
├── (tabs)/
│   ├── _layout.tsx          ← PagerView 2 trang + custom tab bar
│   ├── camera.tsx           ← Tab 0: Camera
│   └── index.tsx            ← Tab 1: Album List (default)
├── albums/[id].tsx          ← Album detail (masonry grid theo ngày)
├── story/[albumId]/[date].tsx ← Story viewer
├── capture.tsx              ← Camera viewfinder (giữ nguyên)
├── photo-review.tsx         ← Review + chọn album (cập nhật)
└── settings.tsx             ← Giữ screen, truy cập qua menu
```

**`_layout.tsx`:**
- `PagerView` bọc 2 screen, `initialPage={1}` (Albums là default)
- Custom tab bar ở dưới: 2 icon (`camera-outline` | `images-outline`)
- Active tab đổi màu khi pager thay đổi trang
- Tap icon → `pagerRef.current.setPage(index)`
- Camera page lazy mount — chỉ request camera permission khi user vuốt/tap sang tab đó
- Settings ẩn khỏi tab bar; truy cập qua menu `⋯` trên album list

---

## Tab 0: Camera

Camera viewfinder full-screen, lazy mounted (không mount khi app mở, chỉ mount khi navigate đến tab này).

**Layout:**
```
┌─────────────────────────┐
│                    [⟳]  │  ← flip camera (Ionicons)
│                         │
│    LIVE VIEWFINDER      │
│    (expo-camera)        │
│                         │
│  [portrait/landscape]   │  ← toggle xoay màn hình
│       ●  shutter        │
└─────────────────────────┘
```

**Portrait/Landscape toggle:**
- `expo-screen-orientation` — lock/unlock orientation
- Icon `phone-portrait` / `phone-landscape` (Ionicons)
- Tap toggle → `ScreenOrientation.lockAsync(LANDSCAPE)` / `unlockAsync()`
- State persist chỉ trong session camera; reset về portrait khi rời tab

**Shutter logic (giữ nguyên từ spec polaroid):**
- Tap → `takePictureAsync({ quality: 0.85, skipProcessing: true })` → WebP
- Giữ ≥250ms → `recordAsync({ maxDuration: 2, mute: true, quality: '720p' })` → MP4
- Progress ring animation khi đang record
- First-time hint toast: *"Giữ để quay video 2 giây"* (flag `capture.hint_seen` AsyncStorage)
- Sau chụp/quay → navigate đến `photo-review.tsx`

**Permissions:**
- Camera: request khi mount (lần đầu)
- Permission denied → modal + `Linking.openSettings()`
- Không request microphone (video silent)
- Không request media library (không save local)

---

## Tab 1: Album List

Tab mặc định khi mở app.

**Layout:**
```
┌─────────────────────────┐
│  Nhật ký          [⋯]  │  ← header + menu icon
│                         │
│ ┌─────────────────────┐ │
│ │[thumb] Gia đình     │ │  ← row ~80px tall
│ │        12 ngày   ›  │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │[thumb] Bạn bè       │ │
│ │        5 ngày    ›  │ │
│ └─────────────────────┘ │
│                         │
│    +  Tạo album mới     │  ← bottom CTA
└─────────────────────────┘
```

- Thumbnail vuông 56×56px = ảnh mới nhất của album
- "X ngày" = số ngày có ít nhất 1 ảnh/video trong album
- Chevron `›` cuối row
- Tap row → `albums/[id].tsx`
- Menu `⋯` → bottom sheet: Settings, Đăng xuất

---

## Album Detail

Route: `albums/[id].tsx`

Masonry grid 2 cột, mỗi ô = 1 ngày có nội dung trong album.

**Layout:**
```
┌─────────────────────────┐
│  [←]  Gia đình    [⋯]  │
│                         │
│  ┌────┐  ┌──────────┐  │
│  │21/5│  │  20/5    │  │
│  │    │  │          │  │
│  └────┘  └──────────┘  │
│  ┌──────────┐  ┌────┐  │
│  │  19/5    │  │18/5│  │
│  └──────────┘  └────┘  │
└─────────────────────────┘
```

- Thumbnail = ảnh/frame đầu tiên của ngày đó
- Ngày có video → icon `▶` nhỏ góc dưới phải
- Height ô luân phiên tall/short để tạo masonry tự nhiên
- Hiển thị ngày format `dd/MM` ở góc trên ô
- Tap ô → `story/[albumId]/[date]`
- Data: `GET /albums/:id/days` → danh sách `{ date, thumbnail_url, has_video, photo_count }`

---

## Story Viewer

Route: `story/[albumId]/[date].tsx`

Fullscreen, tự động chạy qua từng ảnh/video của ngày đó.

**Layout:**
```
┌─────────────────────────┐
│ ████████░░░░░░  21/5   │  ← progress bar segments
│ [←]                [✕] │
│                         │
│    ảnh hoặc video 2s   │
│                         │
│                         │
└─────────────────────────┘
```

- Progress bar: mỗi segment = 1 item (ảnh/video)
- Ảnh: tự chuyển sau 3 giây
- Video 2s: play hết rồi tự chuyển (`expo-video`, muted)
- Tap nửa trái màn hình → item trước
- Tap nửa phải màn hình → item tiếp theo
- Vuốt ngang → chuyển sang ngày trước/sau trong album
- `✕` → back về album detail
- Back navigation (icon `←`) → item đầu tiên hoặc về album detail
- Data: `GET /albums/:id/days/:date/photos` → `[{ id, r2_url, media_type, duration_ms }]`

---

## Capture → Chọn Album Flow

`photo-review.tsx` — cập nhật:

```
┌─────────────────────────┐
│  [✕]         Chụp lại  │
│                         │
│   [preview ảnh/video]   │
│                         │
│  Thêm vào album:        │
│  ┌─────────────────────┐│
│  │ ☐  Gia đình         ││
│  │ ☑  Bạn bè           ││
│  │ ☑  Chuyến đi HN     ││
│  └─────────────────────┘│
│                         │
│      [  Lưu lại  ]      │  ← disabled nếu 0 album chọn
└─────────────────────────┘
```

**Upload flow:**
1. Compress ảnh (WebP) hoặc giữ nguyên video MP4
2. `POST /presign` → nhận presigned URL
3. `PUT` file lên R2 **1 lần**
4. `POST /photos` với `{ r2_key, album_ids: [id1, id2], media_type, taken_at, ... }`
5. Server tạo 1 `photos` record + N `album_photos` join records
6. Upload xong → confetti + navigate về album list

**`✕`:** discard asset, back về camera tab (không lưu gì).

---

## Data Model Changes

### Thêm: `album_photos` join table

```sql
CREATE TABLE album_photos (
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, album_id)
);

CREATE INDEX idx_album_photos_album_id ON album_photos(album_id, added_at DESC);
```

Nếu đã có `album_id` column trực tiếp trên `photos`, migrate data sang join table rồi drop column.

### Xóa: Rate limit

- Xóa `idx_photos_capture_rate_limit` index
- Xóa rate limit query trong `POST /photos`
- Xóa `source='capture'` check
- Xóa `rateLimit` middleware trên capture route
- Client: xóa `useCaptureStore` (lastCaptureAt), xóa cooldown modal

### `POST /photos` — cập nhật

Nhận `album_ids: UUID[]` (array, ít nhất 1) thay vì `album_id: UUID`.

```ts
{
  r2_key: string,
  album_ids: UUID[],          // thay album_id
  media_type: 'photo' | 'video',
  taken_at: ISO timestamp,
  duration_ms?: number,       // video only
  thumbnail_r2_key?: string,  // video only
}
```

---

## API mới

### `GET /albums/:id/days`

Danh sách các ngày có ảnh trong album, dùng cho masonry grid.

```ts
// Response
[{
  date: string,           // 'YYYY-MM-DD'
  thumbnail_url: string,  // URL ảnh/frame đầu tiên
  has_video: boolean,
  photo_count: number,
}]
```

Order: DESC by date (mới nhất trước).

### `GET /albums/:id/days/:date/photos`

Danh sách ảnh/video trong 1 ngày của album, dùng cho story viewer.

```ts
// Response
[{
  id: UUID,
  r2_url: string,
  media_type: 'photo' | 'video',
  duration_ms: number | null,
  taken_at: string,
}]
```

Order: ASC by taken_at (thứ tự chụp).

---

## Xóa / Ẩn (MVP)

**Mobile — xóa:**
- `CalendarView`, `DayPager`, `DayPage`, `MilestoneLabelInput`
- `useDayLabels`, `useTimeline` (thay bằng hooks cho story/album)
- Upload từ gallery (ẩn hoàn toàn UI)
- Cooldown modal, `useCaptureStore` lastCaptureAt logic

**Backend — xóa:**
- Rate limit middleware/query trên `/photos`
- `GET /albums/:id/calendar` (thay bằng `/days`)

**Mobile — giữ nhưng ẩn:**
- `settings.tsx` screen (truy cập qua menu `⋯`)

---

## Testing

### Backend
- `POST /photos` với `album_ids` array → tạo đúng N `album_photos` records
- `POST /photos` với `album_ids: []` → 400
- `GET /albums/:id/days` → đúng danh sách ngày, thumbnail, has_video
- `GET /albums/:id/days/:date/photos` → đúng thứ tự taken_at
- Rate limit: verify endpoint không còn enforce cooldown

### Mobile
- `_layout.tsx`: default page = Albums (index 1), swipe sync tab bar
- Camera tab: lazy mount (không request permission khi Albums active)
- Portrait/landscape toggle: lock/unlock orientation
- `photo-review.tsx`: disable "Lưu lại" khi 0 album chọn; upload flow với multiple albums
- Story viewer: progress bar segments, auto-advance timing, swipe ngày

### Manual smoke test trước merge
1. Mở app → Albums tab
2. Vuốt sang Camera → viewfinder live
3. Chụp ảnh → review → chọn 2 album → Lưu lại → confetti
4. Ảnh xuất hiện trong cả 2 album (masonry grid)
5. Tap ô ngày → story viewer tự chạy
6. Vuốt ngang trong story → chuyển ngày
7. Toggle portrait/landscape → capture ảnh ngang

---

## Out of Scope (post-MVP)

- Export thành video file (ghép ảnh/video thành mp4)
- Upload từ gallery
- High-quality storage option (lưu ảnh gốc không nén)
- Caption trên ảnh
- Reactions / comments
- Push notification khi có ảnh mới
- Offline queue
