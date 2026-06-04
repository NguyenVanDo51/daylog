# Timeline Feed & Calendar — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Redesign the Home screen timeline from the current polaroid/photo-row layout into two switchable views:

1. **Feed view** — masonry 2-column grid, grouped by day, with reaction overlays
2. **Calendar view** — Locket-style month grid, tap a day to see its photos

Both views share the same header and toggle between each other via two icon buttons.

---

## 1. Header (shared)

The existing `JoyfulHeader` stays unchanged. A toggle control is added at the top-right:

```
[ ⊞ ] [ 📅 ]
```

- `⊞` (grid icon) = Feed view — active state: pink fill (`#FF7AA8`)
- `📅` (calendar icon) = Calendar view — active state: pink fill
- Active button: `background: colors.pink`, `borderColor: colors.pink`
- Inactive button: `background: colors.white`, `borderColor: colors.border`
- Toggle state stored in local `useState` inside `HomeScreen` — no persistence needed

---

## 2. Feed View — Masonry Grid

Replaces the current `TimelineFeed` rendering logic (FlatList stays, items structure changes).

### Grouping

Timeline items are grouped by **calendar day** (`taken_at` / `occurred_at` date, in local timezone). Each day produces:

1. A **day header row** — `"Thứ Tư, 4 tháng 6"` (using existing `formatVnDate`)
2. A **masonry block row** — all photos for that day rendered as a 2-column masonry
3. **Milestone rows** interleaved in chronological order within the day

### Masonry Layout

- 2 columns, `gap: 4px`, `paddingHorizontal: 6px`
- Each photo tile height = `tileWidth * (original_height / original_width)`, clamped to `[72, 220]` px
- Photos distributed across columns greedily (always add to the shorter column)
- Photo aspect ratio read from a new `width` / `height` field on `TimelinePhoto` (requires backend change — see §6)
- Fallback: if no dimensions available, use `aspect-ratio: 1` (square)

### Photo Tile

```
┌────────────────────┐
│                    │  ← borderRadius: 10, overflow: hidden
│    <Image>         │
│                    │
│        ❤️ 3 · 😍 2 │  ← reaction overlay, bottom-right
│  ▶ video           │  ← video badge, top-left (if media_type === 'video')
└────────────────────┘
```

**Reaction overlay:** `background: rgba(255,255,255,0.88)`, `borderRadius: 99`, `padding: 2 6`, `fontSize: 10`. Shows up to 3 unique emoji + total count. Hidden if no reactions.

**Video badge:** `background: rgba(61,42,31,0.6)`, white text, shows `"▶ video"`.

**Interactions:**
- `onPress` → navigate to `/photo/[id]` (existing photo viewer)
- `onLongPress` (350ms) → open `ReactionPicker` (existing component)

### Milestone Row

Milestones appear inline between photo groups, in chronological order:

```
┌─────────────────────────────────────────┐
│  🎯  Bé nói "mama" lần đầu!    🥹 5    │
│      Cột mốc · 4 tháng 6               │
└─────────────────────────────────────────┘
```

- `background: colors.white`, `borderRadius: 12`, `border: 1.5px solid colors.mint`
- `onPress` → navigate to `/milestone/[id]` (existing)
- Reaction count shown on the right (read from reactions endpoint using milestone id — new, see §6)

### Empty / Loading states

Unchanged from current — skeleton rows and `EmptyState` component still used.

---

## 3. Calendar View

Rendered when the 📅 toggle is active. Replaces the feed in the scroll area below the header.

### Month Grid

```
  ‹   Tháng 6 · 2025   ›
  T2  T3  T4  T5  T6  T7  CN
  [ ] [ ] [ ] [ ] [ ] [1] [2]
  [3] [4] [5] [6] [7] [8] [9]
  ...
```

- 7-column grid, `gap: 3`, cells `aspect-ratio: 1`, `borderRadius: 8`
- Navigation: `‹` / `›` arrows change displayed month (local state)
- Default: current month

**Day cell colors:**

| Condition | Fill | Text |
|---|---|---|
| Has upload photo | `#FFD66B` (yellow) | `colors.ink`, bold |
| Has capture photo | `colors.pink` (#FF7AA8) | white, bold |
| Has milestone | `colors.mint` (#7FD7B5) | `colors.ink`, bold |
| Has both upload + capture | `colors.pink` (capture takes priority) | white |
| Today | transparent + `outline: 2px colors.pink` | `colors.pink` |
| Selected | transparent + `outline: 2.5px colors.border` | — |
| Empty | transparent | `colors.inkMuted` |

### Day Detail Panel

Below the calendar grid, a list of items for the selected day:

```
─────────────────────────────
Thứ Tư, 4 tháng 6 · 3 mục
─────────────────────────────
[thumb]  Bé tập đi hôm nay    ❤️ 3 · 😍 2
[thumb]  Chiều công viên       😘 4
[thumb]  🎯 Cột mốc: mama!     🥹 5
```

- Thumbnail: `50×50`, `borderRadius: 9`
- Caption truncated to 1 line
- `onPress` row → navigate to photo viewer / milestone screen
- Default selected day: today (or most recent day with content if today is empty)

### Legend

Shown below the grid, before the detail panel:

`🟡 Ảnh upload  🩷 Capture  🟢 Cột mốc`

### Swipe gesture

`react-native-gesture-handler` `Swipeable` or `PanResponder` — swipe left = next month, right = previous month.

---

## 4. Data

### Existing

- `useTimeline` — infinite query providing `TimelinePhoto` and `TimelineMilestone` items, ordered newest-first
- `useReactions(photoId)` — reactions per photo, already used in `PolaroidCard`
- `ReactionPicker`, `ReactionBadge` — existing components, reused

### New: photo dimensions

`TimelinePhoto` needs `width: number | null` and `height: number | null` for masonry height calculation.

- Backend: add `width`, `height` columns to `photos` table (nullable int). Populate on upload/capture via `sharp` metadata.
- API: include in timeline response
- Fallback in UI: if null, treat as square (1:1)

### New: calendar day index

Calendar view needs to know which days in a month have content, without loading all photos.

Two options:
1. **Derive from cached timeline data** — iterate `data.pages` to build a `Set<string>` of dates. Works well if all months are already loaded; incomplete for months not yet fetched.
2. **New API endpoint** `GET /albums/:id/calendar?year=YYYY&month=MM` → `{ dates: { "2025-06-04": { photo: true, capture: true, milestone: false } } }` — accurate, lightweight.

**Decision:** Use option 2 (dedicated endpoint). Implement a `useCalendar(year, month)` hook backed by this endpoint. Falls back to deriving from timeline cache while the request loads.

### New: milestone reactions

Milestones currently have no reactions. Two options:
1. **Skip** — show no reaction badge on milestones in feed/calendar
2. **Extend** — add reactions to milestones (same schema as photo reactions)

**Decision:** Skip for now. Milestone rows in feed show no reaction badge (keep scope focused).

---

## 5. Component Structure

```
HomeScreen
├── JoyfulHeader (unchanged)
├── StorageBadge (unchanged)
├── [feedMode === 'feed'] TimelineFeed  ← refactored
│     ├── FlatList
│     │   ├── DayHeader
│     │   ├── MasonryBlock       ← new component
│     │   │   ├── MasonryColumn  ← new
│     │   │   └── PhotoTile      ← new (replaces PolaroidCard + PhotoRow in feed)
│     │   └── MilestoneRow       ← new (replaces MilestoneCard in feed)
│     └── (ReactionPicker modal)
└── [feedMode === 'calendar'] CalendarView  ← new component
      ├── CalendarGrid           ← new
      │   └── CalendarDayCell    ← new
      └── DayDetailPanel         ← new
            └── DayDetailItem    ← new
```

`PolaroidCard`, `PhotoRow`, `MilestoneCard` remain for other uses (milestone detail screen, etc.) but are no longer used in the home feed.

---

## 6. Backend Changes

| Change | Where |
|---|---|
| Add `width`, `height` to `photos` table | DB migration |
| Populate on upload (`/photos` POST) | `routes/photos.ts` — use `sharp(buffer).metadata()` |
| Populate on capture | `routes/photos.ts` capture path |
| Include in timeline response | `routes/timeline.ts` |
| New endpoint `GET /albums/:id/calendar` | `routes/timeline.ts` or new `routes/calendar.ts` |

---

## 7. Out of Scope

- Comments on photos (deferred by user)
- Reactions on milestones (deferred)
- Search / filter by date range
- Multi-select / bulk delete from grid
- Pinch-to-zoom on grid
