# Photo Journal Pivot — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Supersedes (in part):** [2026-06-03 Family Album Design](2026-06-03-family-album-design.md) — interaction model, milestones data shape, auto-sync feature

---

## Overview

Pivot the app from a "shared family photo album" to a **"shared family photo journal" (Nhật ký hình ảnh gia đình)**. The data model and architecture stay largely the same; what changes is:

1. **Interaction model:** Calendar mode (one day at a time, swipe left/right) becomes the default landing view, replacing the masonry timeline as the primary surface.
2. **Capture model:** Camera-first (in-app polaroid capture) for today; upload-from-Photos only for past days.
3. **Milestones simplification:** Milestones become per-day labels (a single string per day) instead of a separate entity with title/note/cover photo.
4. **Auto-sync removed:** No more automatic upload from camera roll. All uploads are intentional.

The goal is to reduce friction (so users actually post), build a daily habit (today's empty page invites capture), and differentiate from Locket / BeReal / iOS Photos via the "nhật ký" (diary) cultural framing — strong in Vietnamese-language audience.

---

## Positioning

| Competitor | Their angle | Our angle |
|---|---|---|
| Locket | Ephemeral lockscreen widget, social friends graph | Permanent, intentional, day-by-day archive |
| BeReal | Forced grainy authenticity, twice-a-day prompt | High-quality, user-chosen moments |
| iOS Photos | Dump everything, no structure | One page per day, with intent |

**Audience:** Default copy targets families, but the header shows only the date (not child's age), so the app works for couples, friend groups, travel logs, etc. — the Vietnamese "nhật ký" framing is the cultural moat.

---

## Platform & Stack

Unchanged from the original spec: React Native (iOS first), Express.js + PostgreSQL backend, Cloudflare R2 for photo storage, APNs for push notifications, react-native-compressor + Sharp.js for image processing.

---

## Interaction Model

Two modes accessed via a segmented control / icon toggle at the top of the home screen.

### Calendar mode (default on app launch)

- App launches into the **today** page.
- Header at top center: the current date being viewed (e.g., "Thứ Năm, 4 Tháng 6").
- **Swipe left** → previous day. **Swipe right** → next day, blocked at today (no future days).
- One day fills the viewport at a time. No jump UI inside Calendar mode — users who want to jump far back use Feed mode.

### Feed mode (secondary)

- Full gallery showing all photos grouped by day, infinite scroll back through time.
- Each day's group uses the same masonry block component as Calendar mode (shared component, consistent visual language).
- Tap a day's heading in Feed → switches to Calendar mode landed on that date.

### Toggle behavior

- Two icons or a segmented control in the top bar: "Lịch" (Calendar) / "Tất cả" (Feed).
- Mode persists within a session, not across app launches. Every cold start lands in Calendar mode on today.

---

## Day Page (Calendar mode)

A day page has three regions: header, body, captions inline with photos.

### Header (top center, fixed)

- Default: "Thứ Năm, 4 Tháng 6" with optional small year "2026" below if context needs it.
- With a day label set: the label is the primary text (e.g., "🏷️ 1 tháng tuổi"), date moves to a smaller line below.
- Tap header → opens a small input bottom sheet to add / edit / clear the day label.

### Body — depends on state

| State | Body content |
|---|---|
| Today, empty | Large camera CTA centered: round camera icon + "Ghi lại ngày hôm nay". Tap → in-app polaroid capture. |
| Today, has photos | `MasonryBlock` of today's photos. Small camera FAB at bottom-right to add more. |
| Past day, empty | Centered short message ("Chưa có ảnh ngày này") + small upload button "Thêm ảnh từ thư viện". **No camera** — can't capture the past. |
| Past day, has photos | `MasonryBlock` of that day's photos. Small upload FAB at bottom-right. |

### Captions

- Per-photo, as today. Small text below each photo in the masonry grid.

### Gesture priority

- Horizontal swipe on the page body changes the day.
- Tap a photo opens full-screen viewer; in full-screen, horizontal swipe pages between photos **within the same day**, and dismissing the viewer returns to the day swipe context.

---

## Day Labels (replaces Milestones)

A day label is a single optional string attached to a `(album_id, date)` pair. Examples: "1 tháng tuổi", "Sinh nhật", "Lần đầu đi bộ", "Du lịch Đà Nẵng".

- One label per day per album (UNIQUE constraint).
- Any member can add / edit / clear via tap-header on the day page.
- Last-write-wins on conflict (`updated_at`, `updated_by` for audit).
- Shown in Calendar mode header, and in Feed mode as the group heading replacement (label as heading, date as small subtext).

---

## Capture Flow

### In-app camera (today only)

- Polaroid capture flow per existing spec/plan ([2026-06-04-polaroid-capture-design.md](2026-06-04-polaroid-capture-design.md)).
- After capture → preview → optional caption → save.
- `taken_at` = capture timestamp (not EXIF — photo originates in-app).
- Push notification to other album members on save.

### Upload from Photos library (any day)

- Multi-select picker (iOS native).
- Each photo's `taken_at` comes from EXIF; if missing, fallback to upload timestamp.
- Photos route to their **EXIF day**, not the day the user is currently viewing. If the user uploads a photo with EXIF date 3/6 while viewing 4/6, the photo appears on 3/6.
  - After upload, app shows toast ("Đã thêm N ảnh vào ngày 3/6") and auto-swipes Calendar mode to that day.
- Entry points: empty-state CTA on past-day pages; small upload FAB on past-day pages that already have photos.

### Removed: auto-sync

- `PHPhotoLibrary` change observer is dropped.
- Settings toggle for auto-sync is removed.
- All uploads are user-initiated.

---

## Data Model

### Changes vs original spec

**Drop `milestones` table.** Replace with `day_labels`:

```sql
day_labels
  id UUID PK
  album_id UUID → albums
  date DATE
  label TEXT NOT NULL
  updated_by UUID → users
  updated_at TIMESTAMPTZ
  UNIQUE(album_id, date)
```

**Migration:** for existing rows in `milestones`, insert into `day_labels` with `date = DATE(occurred_at)`, `label = title`. `note` and `cover_photo_id` are discarded (intentional simplification — if users have meaningful notes, surface them in a one-off export before migration). Drop the `milestones` table after migration.

### Unchanged tables

`users`, `albums`, `album_members`, `photos`, `invites`.

### Field notes

- `photos.local_asset_id`: kept as idempotency key for upload-from-library (prevents duplicate uploads of the same iOS asset). No longer driven by auto-sync.
- `albums.child_birthdate`: kept nullable but no longer surfaced in the UI (header shows only date). May be removed in a later migration if confirmed unused.

---

## API Changes

### Removed

- `POST /albums/:id/milestones`
- `PUT /albums/:id/milestones/:milestoneId`
- `DELETE /albums/:id/milestones/:milestoneId`
- Any auto-sync setup endpoints (e.g., toggling preference, if exposed).

### Added

- `GET /albums/:id/day-labels?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns array of `{ date, label, updated_at, updated_by }`.
- `PUT /albums/:id/day-labels/:date` — upsert, body `{ label }`. Empty/null label deletes.
- `DELETE /albums/:id/day-labels/:date` — explicit delete.

### Modified

- `GET /albums/:id/calendar` — include day labels alongside calendar data so the calendar response self-contains everything Calendar mode needs.

### Push notifications

- New photo: still pushes to other members (unchanged).
- Milestone created: removed (no longer an event — labels are silent edits).

---

## Code Changes Map

### Mobile

| Area | Change |
|---|---|
| `app/(tabs)/index.tsx` (HomeScreen) | Default tab → Calendar mode. |
| `components/timeline/CalendarView.tsx` | Rewrite. Month-grid → horizontal swipeable day pager. |
| `components/timeline/DayPage.tsx` (new) | Header + body switching by (today/past × empty/has). |
| `components/timeline/MilestoneLabelInput.tsx` (new) | Bottom sheet for label add/edit/clear. |
| `components/timeline/TimelineFeed.tsx` | Keep for Feed mode. Render day label as group heading when present. |
| `components/timeline/MasonryBlock` | Reuse unchanged in both modes. |
| Polaroid capture | Build per existing spec/plan. Becomes the camera CTA target. |
| Auto-sync code | Remove `PHPhotoLibrary` observer setup, related settings UI, background task hooks. |
| Settings screen | Remove auto-sync toggle. |

### Backend

| Area | Change |
|---|---|
| `routes/milestones.*` | Delete. |
| `routes/day-labels.ts` (new) | CRUD per API spec above. |
| `routes/calendar.ts` | Extend response with day labels. |
| Migrations | Add `day_labels`, migrate from `milestones`, drop `milestones`. |
| Push notifications | Remove milestone-created push trigger. |

---

## Error Handling

Carries forward from the original spec, plus:

- **Upload to EXIF day:** if EXIF parsing fails, fallback to upload timestamp (already covered). Toast still appears, naming the fallback day.
- **Day label conflict:** last-write-wins; no explicit conflict UI in MVP.
- **Future day blocked:** swipe gesture has a right-edge resistance at today. If a deep link or programmatic nav passes a future date, app clamps to today and shows nothing extra.
- **Empty album, first launch:** Calendar mode lands on today with the empty-today CTA.

---

## Testing

### Unit

- `formatVnDayLabel` (already covered).
- Day label reducer / cache invalidation.
- DayPage state selector: returns correct state for all 4 combinations of (today/past × empty/has).

### Component

- `DayPage` snapshot for each of the 4 states, plus with/without label.
- `MilestoneLabelInput` add/edit/clear behaviors.

### Integration

- Swipe left/right changes the rendered date, blocked at today.
- Upload from library on day X with EXIF day Y → photo lands on Y, toast names Y, Calendar swipes to Y.
- Day label PUT then GET returns the new value; DELETE clears.
- Calendar endpoint returns labels alongside photo data.

---

## Post-MVP / Out of Scope

Carry forward from the original spec:

- In-app camera *beyond* polaroid capture
- Reactions and comments
- Video support
- Multiple albums per family
- Photo download / export
- Face recognition / tagging
- Admin controls
- Android, Web

New deferrals from this pivot:

- **Auto-sync** — may return as opt-in if user demand surfaces.
- **Multi-photo carousel in day page** — only masonry grid in MVP.
- **Engagement features** (streak, weekly digest, push reminders) — already on the post-MVP waitlist per project memory.
- **Year/month overview view inside Calendar mode** — defer; Feed mode covers the "browse far back" need.
- **Rich milestone metadata** (note, cover photo) — intentionally dropped; label is the whole milestone now.

---

## Open Items

None at spec time. All major decisions resolved during brainstorming.
