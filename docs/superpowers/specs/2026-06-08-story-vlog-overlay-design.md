# Story Viewer: VlogOverlay Component

**Date:** 2026-06-08  
**Updated:** 2026-06-09 (reflect actual implementation — Courier New/amber timestamp style not used)  
**Status:** Implemented

## Overview

Bottom overlay in the story viewer showing day label, photo time, caption, and pagination dots. Styled with dark gradient for readability.

## Component

**File:** `mobile/app/story/[albumId]/_components/VlogOverlay.tsx`

**Props:**
```ts
{
  photo: DayPhoto;
  dayLabel: string;        // formatted date label passed from parent
  currentIndex: number;
  total: number;
  bottomInset?: number;
  isPaused?: boolean;
}
```

## Layout (bottom to top)

```
[pagination dots]
[caption — italic, if present]
[▶/⏸ icon + HH:mm time]
[day label hero text]
```

All inside a `LinearGradient`: `['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']`, `position: absolute`, bottom of screen, `pointerEvents="none"`.

## Styles

| Element | Font | Size | Color | Notes |
|---|---|---|---|---|
| Day hero | `fonts.regular` | 26px | `rgba(255,255,255,0.92)` | `letterSpacing: 3` |
| Time icon | Phosphor `PlayIcon`/`PauseIcon` | 16 | `#ffcc44` | Swaps based on `isPaused` |
| Time text | `fonts.bold` | 18px | `#ffcc44` | Amber glow shadow |
| Caption | system italic | 12px | `rgba(255,255,255,0.92)` | Only renders if `caption?.trim()` |
| Dots | — | 5×5 (inactive) / 18×5 (active) | white 30% / white 100% | Centered row, `gap: 4` |

## Data

Time is derived from `photo.taken_at` (UTC ISO string):
```ts
dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
```

`dayLabel` is formatted by the parent screen (not inside this component).

## Files Changed

| File | Change |
|---|---|
| `backend/src/routes/album-days.ts` | Added `p.caption` to SELECT |
| `mobile/src/hooks/useDayPhotos.ts` | Added `caption: string \| null` to `DayPhoto` |
| `mobile/app/story/[albumId]/_components/VlogOverlay.tsx` | Component implementation |
| `mobile/app/story/[albumId]/[date].tsx` | Renders `VlogOverlay` with props |
