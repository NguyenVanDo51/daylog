# VlogOverlay Redesign

## Goal

Reposition the time and caption from the bottom overlay to upper-center, remove the date label, enlarge the caption, and animate both with a typewriter (letter-by-letter) reveal on each photo change.

## Changes in scope

File: `mobile/app/story/[albumId]/_components/VlogOverlay.tsx`

### 1. Remove date label

Remove the `dayHero` text element and the `dayLabel` prop entirely. The caller (`[date].tsx`) no longer needs to pass `dayLabel`.

### 2. New upper-center overlay

Add an `absolute` `View` positioned at `top: '38%'`, centered horizontally, `pointerEvents="none"`, `zIndex: 10`. It contains:
- Time row: play/pause icon + animated time string, centered
- Caption: animated caption text below, centered, shown only when `photo.caption` is non-empty

### 3. Bottom layer (dots only)

Keep the existing `LinearGradient` at the bottom but remove all text content from it. It retains the gradient for visual grounding and houses only the dots row.

### 4. Typewriter animation

Two pieces of local state: `displayedTime: string` and `displayedCaption: string`.

Reset trigger: `useEffect` keyed on `photo.id` (or `photo.taken_at` as fallback). On reset:
1. Set both states to `''`
2. Start time interval: reveal one char of `timeStr` every **70ms**
3. After time finishes + **100ms** gap, start caption interval: reveal one char every **35ms**
4. Cleanup: clear all intervals and timeouts on unmount or dep change

No caption case: if `photo.caption` is empty/null, only the time animates. No empty placeholder rendered.

### 5. Styling

| Element | Before | After |
|---|---|---|
| Caption font size | 12px | 18px |
| Caption text align | left | center |
| Time text align | left | center |
| dayHero | present | removed |
| Overlay position | bottom LinearGradient | upper-center absolute View |

## Props interface after change

```ts
{
  photo: DayPhoto;
  // dayLabel removed
  currentIndex: number;
  total: number;
  bottomInset?: number;
  isPaused?: boolean;
}
```

Caller update: remove `dayLabel={dateLabel}` from `VlogOverlay` in `[date].tsx`.

## Out of scope

- No changes to `PhotoItem`, `VideoItem`, or the progress bar
- No changes to swipe navigation or the top bar date chip
