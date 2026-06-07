# Story Viewer: Vlog Tape Overlay

**Date:** 2026-06-08
**Status:** Approved

## Overview

Hiển thị giờ chụp và ghi chú của từng ảnh/video trong story viewer, theo phong cách timestamp máy quay vlog cũ (Vlog Tape).

## UI Design

### Visual style

Bottom overlay với gradient tối từ dưới lên, chứa 3 dòng thông tin:

```
2025.12.25                  ← ngày, Courier New, 8px, amber mờ (rgba(255,180,0,0.7))
▶ 08:42                     ← giờ, Courier New, 10px, #ffcc44
Giáng sinh ở nhà bà nội    ← caption, 9px, white italic (chỉ hiện khi có data)
```

### Contrast & readability

Text phải luôn rõ bất kể màu ảnh/video bên dưới. Cần 2 lớp bảo vệ:

1. **Gradient overlay**: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)` — tạo nền tối đủ cho text
2. **Text shadow**: mỗi dòng text có `textShadow: '0 1px 4px rgba(0,0,0,0.9)'` — đảm bảo đọc được kể cả khi gradient không đủ tối (ảnh sáng, video trắng)

Timestamp amber `#ffcc44` có thêm `text-shadow: 0 0 6px rgba(255,180,0,0.5)` cho hiệu ứng glow nhẹ.

### Data format

- **Giờ**: `HH:mm` (24h), parse từ `taken_at` UTC → local time bằng `toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })`
- **Ngày**: `YYYY.MM.DD`, format từ `taken_at`
- **Caption**: chỉ render khi `caption !== null && caption.trim() !== ''`

## Data Changes

### Backend — `album-days.ts`

Query tại `/albums/:id/days/:date/photos` (dòng 73) cần thêm `p.caption`:

```sql
SELECT p.id, p.media_type, p.duration_ms, p.taken_at, p.caption
FROM photos p
WHERE p.album_id = ${albumId}
  AND DATE(p.taken_at AT TIME ZONE 'UTC') = ${date}::date
ORDER BY p.taken_at ASC
```

### Frontend — `useDayPhotos.ts`

Thêm field vào `DayPhoto` interface:

```ts
export interface DayPhoto {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
  caption: string | null;   // thêm mới
}
```

## Component Changes

### `story/[albumId]/[date].tsx`

Thêm component `VlogOverlay` render phía dưới cùng (z-index: 10, pointerEvents: 'none' để không chặn tap areas):

```tsx
function VlogOverlay({ photo }: { photo: DayPhoto }) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;

  return (
    <View style={vlog.container} pointerEvents="none">
      <Text style={vlog.date}>{dateStr}</Text>
      <Text style={vlog.time}>▶ {timeStr}</Text>
      {photo.caption ? <Text style={vlog.caption}>{photo.caption}</Text> : null}
    </View>
  );
}
```

Styles:
- `container`: `position: absolute`, `bottom: 0`, `left: 0`, `right: 0`, `padding: spacing.lg`, gradient background
- `date`: Courier New, 8px, `rgba(255,180,0,0.7)`, text-shadow đen
- `time`: Courier New, 11px, `#ffcc44`, bold, glow shadow
- `caption`: system font, 9px, white italic, text-shadow đen

## Files Changed

| File | Change |
|---|---|
| `backend/src/routes/album-days.ts` | Thêm `p.caption` vào SELECT query |
| `mobile/src/hooks/useDayPhotos.ts` | Thêm `caption: string \| null` vào `DayPhoto` |
| `mobile/app/story/[albumId]/[date].tsx` | Thêm `VlogOverlay` component + styles |

## Out of Scope

- Chỉnh sửa caption trong story viewer
- Animation fade-in/out
- Hiển thị caption trong màn hình grid/album
