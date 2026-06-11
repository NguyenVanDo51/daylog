# MediaCaption Component — Design Spec

## Overview

Extract a shared `MediaCaption` component that renders the time + optional note overlay identically across all three media screens: Camera, Photo Review, and Story View.

**Problem:** The time and caption currently live in three separate implementations with inconsistent positions and styles. The camera uses a big white 52px clock at dead-center; the photo review uses a centered `TextInput` with no time; the story view uses a pink 18px time + italic caption at `top: 38%`.

**Goal:** One component, one position (`top: 38%`), one style — reused everywhere.

---

## Component

**File:** `mobile/src/components/ui/MediaCaption.tsx`

```tsx
<MediaCaption
  time="14:32"           // required — always displayed in pink
  caption?: string       // optional note text
  editable?: boolean     // default false; true renders a TextInput
  onCaptionChange?: (v: string) => void
  showPlayIcon?: boolean // default false; story view passes isPaused state
  isPaused?: boolean     // only relevant when showPlayIcon=true
/>
```

**Positioning:** The component positions itself absolutely at `top: '38%'`, centered horizontally, `zIndex: 10`, `pointerEvents: 'box-none'` (so the caption TextInput still receives touches while the outer View doesn't block gestures).

**Time row:** Pink (`colors.pink`), `fontSize: 18`, `fontFamily: fonts.bold`, `letterSpacing: 1`, with a glow `textShadow`. When `showPlayIcon` is true, a `PlayIcon` or `PauseIcon` (16px, pink, filled) appears to the left.

**Caption — static mode** (`editable=false`): `fontSize: 18`, `fontFamily: fonts.regular`, white, italic, centered, with dark text shadow. Rendered as `<Text>`.

**Caption — editable mode** (`editable=true`): Same visual style but rendered as `<TextInput>`. Placeholder `"Thêm ghi chú..."` in `rgba(255,255,255,0.5)`. `maxLength={200}`, `multiline`, `textAlign="center"`, `autoFocus`, `selectionColor={colors.pink}`. An underline (`width: 50, height: 2, rgba(255,255,255,0.4)`) appears below the input.

**Typewriter animation:** Stays in `VlogOverlay` — it's story-specific chrome. The shared component only renders the final/current caption string it receives.

---

## Screen Changes

### Camera (`CameraPage.tsx`)
- Remove the `clockOverlay` + `clockTime` + `clockDate` styles and the `<View>` that renders them.
- Replace with `<MediaCaption time={clock.time} />`.
- Drop the `VI_DAYS` date formatting — the date line is removed.

### Photo Review (`photo-review.tsx`)
- Remove the `captionZone`, `captionInput`, `captionUnderline` styles and their JSX.
- Add `takenAt` time formatting: derive `timeStr` from `asset.takenAt` using the same `toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })` call.
- Replace with `<MediaCaption time={timeStr} caption={caption} editable onCaptionChange={setCaption} />`.

### Story View (`VlogOverlay.tsx`)
- Remove the `upperCenter`, `timeRow`, `time`, and `caption` styles and their JSX.
- Replace with `<MediaCaption time={timeStr} caption={displayedCaption} showPlayIcon isPaused={isPaused} />`.
- Keep the typewriter `useEffect` in `VlogOverlay` — it computes `displayedCaption` and passes it to `MediaCaption`.
- Keep the bottom gradient + dots section in `VlogOverlay` unchanged.

---

## File Structure

```
mobile/src/components/ui/MediaCaption.tsx   ← new
mobile/src/components/tabs/CameraPage.tsx   ← updated
mobile/app/photo-review.tsx                 ← updated
mobile/app/story/[albumId]/_components/VlogOverlay.tsx  ← updated
```

---

## Out of Scope

- Typewriter animation — stays in `VlogOverlay`, not part of `MediaCaption`.
- Story dots / bottom gradient — stays in `VlogOverlay`.
- Album tiles, save button, top bars — all untouched.
