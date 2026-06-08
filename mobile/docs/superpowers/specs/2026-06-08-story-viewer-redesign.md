# Story Viewer Redesign

**Date:** 2026-06-08  
**File:** `mobile/app/story/[albumId]/[date].tsx`

## Goal

Remove the Facebook-Stories-style progress bars and top icon row. Replace with a cleaner layout that feels like a personal family diary.

## Design

### Top bar

Single row pinned to safe-area top:

| Element | Detail |
|---|---|
| Back button | Small circle (26 px), semi-transparent dark bg, chevron `‹` icon, navigates `router.back()` |
| Date chip | Flex-fill pill showing `DD.MM.YYYY` in monospace, 10% white bg |
| `•••` menu button | Small circle (26 px), same style as back button, opens action sheet |

**Removed:** horizontal progress bar segments, standalone edit icon, standalone download icon, standalone close `✕` icon.

### Action menu (replaces top icon row)

Tapping `•••` opens a dark dropdown anchored top-right:

1. **Sửa ghi chú** — navigates to `/story/[albumId]/[date]/manage`
2. **Lưu về máy** — triggers `exportStory()` (existing `useStoryExport` hook)
3. **Xoá ảnh** — destructive action, shown in red; implementation deferred (no hook yet — show `Alert` placeholder for now)

Tapping anywhere outside the menu closes it.

### Bottom overlay

Gradient from transparent → `rgba(0,0,0,0.92)` at the very bottom.

Stack (top to bottom inside overlay):
1. **Day hero** — `DD / MM`, ~26 px, weight 200, Georgia serif, letter-spacing 3, white 92% opacity
2. **Amber timestamp** — `▶ HH:MM`, Courier New, 11 px, `#ffcc44` — existing `VlogOverlay` style, kept as-is
3. **Caption** — italic, 11 px, white 72% — existing `VlogOverlay` style, kept as-is
4. **Progress dots** — centered row of dots; active dot is a pill (`18 px × 5 px`), inactive dots are circles (`5 px`), white/28% inactive, white/100% active

**Removed:** thumbnail strip.

### Navigation

Unchanged: tap left/right halves to go prev/next; swipe left/right to change day.

### Progress tracking

Progress dots replace the `StoryProgress` bar component. `StoryProgress` component and its `pg` stylesheet are deleted. The `photoProgress` state (0–1 float) is no longer needed for rendering — it can be kept only if needed for dot animation, otherwise removed.

## Components affected

- `StoryProgress` component — **deleted**
- `VlogOverlay` component — **kept unchanged**
- `StoryScreen` — top bar and bottom overlay restructured
- `pg` stylesheet — **deleted**
- `styles` stylesheet — updated (remove `progressRow`, `dateText`, `topActions`; add new entries)

## Out of scope

- "Xoá ảnh" backend integration — placeholder `Alert` only
- Animation on dots (fade/slide) — static dots only
- Swipe-up to reveal caption — not in this spec
