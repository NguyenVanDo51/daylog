# Story Viewer — Pause / Resume + Progress Line

**Date:** 2026-06-08
**File:** `mobile/app/story/[albumId]/[date].tsx`

## Goal

Add tap-to-pause/resume to the story viewer, with a thin progress line at the very bottom of the screen showing how far through the current photo or video the user is.

## Tap Zones

The screen is divided into three horizontal zones by replacing the current two-zone `tapAreas` layout:

| Zone | Flex | Action |
|---|---|---|
| Left ⅓ | 3 | Previous photo (`goPrev`) |
| Centre ⅓ | 4 | Toggle pause / resume |
| Right ⅓ | 3 | Next photo (`goNext`) |

All three zones work regardless of pause state. Tapping next/prev while paused moves to the next item and resumes playback.

## Pause State

A new `isPaused` boolean state (default `false`) drives all pause behaviour.

### When paused

- Photo timer: freezes at current elapsed time (resumes from saved elapsed on unpause).
- Video: `player.pause()` called.
- Centre of screen: a frosted-glass ⏸ icon (52 px circle, `rgba(0,0,0,0.35)` background, `blur(4px)`) is shown.
- Timestamp prefix changes from `▶` to `⏸`.
- Progress line: turns amber (`rgba(255,200,68,0.85)`) and stops moving.

### When playing

- Photo timer: runs via `requestAnimationFrame`.
- Video: `player.play()` called.
- Pause icon: hidden.
- Timestamp prefix: `▶`.
- Progress line: white (`rgba(255,255,255,0.75)`), animates left → right.

### Navigation while paused

Tapping prev/next calls `goPrev`/`goNext` as usual, resets `isPaused` to `false`, and resets progress to 0. The story always resumes after a navigation tap.

## Progress Line

A 3 px tall bar pinned to the very bottom edge of the screen (below the `VlogOverlay` gradient), `zIndex: 20`.

- Track: `rgba(255,255,255,0.12)` full width.
- Fill: colour depends on play/pause state (see above). Width is `${progress * 100}%` where `progress` is a 0–1 float.

### Photo progress

`PhotoItem` exposes an `onProgress(fraction: number)` callback, called on every `requestAnimationFrame` tick. The callback is a no-op when paused (the timer loop exits when `isPaused` becomes true). `StoryScreen` holds `photoProgress` state (0–1) and passes it to the progress line.

`PhotoItem` also receives an `isPaused` prop. When `isPaused` becomes `true`, the loop saves `elapsed` and exits. When it becomes `false`, the loop restarts from saved `elapsed`.

### Video progress

`VideoItem` exposes an `onProgress(fraction: number)` callback, polled via a `setInterval` every 200 ms that reads `player.currentTime / player.duration`. Returns 0 if `duration` is 0 or NaN. The interval is cleared on unmount or when the video ends.

## Components changed

| Component | Change |
|---|---|
| `StoryScreen` | Add `isPaused`, `photoProgress` state; replace two-zone `tapAreas` with three zones; add progress line; add pause icon; pass `isPaused`/`onProgress` to `PhotoItem` and `VideoItem` |
| `PhotoItem` | Add `isPaused` prop; save/restore elapsed time across pause/resume; call `onProgress` on each tick |
| `VideoItem` | Add `isPaused` prop + `onProgress` callback; poll `currentTime/duration` via `setInterval`; call `player.pause()`/`player.play()` on prop change |
| `VlogOverlay` | Accept `isPaused` prop; render `⏸` prefix when paused, `▶` when playing |

## Out of scope

- Seek by dragging the progress line.
- Auto-pause when app backgrounds.
- Pause icon animation (fade-in/out transition).
