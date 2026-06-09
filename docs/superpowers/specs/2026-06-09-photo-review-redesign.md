# Photo Review Screen Redesign

**Date:** 2026-06-09
**File:** `mobile/app/photo-review.tsx`

## Summary

Redesign the photo review screen with three changes:
1. Full-bleed photo fills the entire screen
2. Caption input overlaid at vertical center of the photo, auto-focused on open
3. Album selector replaced with content-fit tiles that wrap to multiple rows (max 3 per row)

---

## Layout

The screen is full-bleed with no scroll. Everything sits on a single non-scrollable view.

**Layers (bottom to top):**
1. `Photo / VideoView` — fills `StyleSheet.absoluteFill`, `contentFit="cover"`
2. Top gradient overlay — `position: absolute`, top 0, fades from `rgba(0,0,0,0.55)` to transparent
3. Bottom gradient overlay — `position: absolute`, bottom 0, fades from `rgba(0,0,0,0.82)` to transparent
4. Top bar — X button (left) + "Chụp lại" (right) — over top gradient
5. Caption input — centered vertically on the photo (absolute, `top: 50%`)
6. Bottom zone — album tiles + save button — over bottom gradient
7. `KeyboardAvoidingView` wraps the whole screen so the bottom zone lifts with the keyboard

---

## Top Bar

Same as current: X button dismisses and clears store (`router.back` + `clear()`), "Chụp lại" goes back without clearing. Both sit over the top gradient.

---

## Caption Overlay

- Positioned `absolute` at `top: '50%'`, `left: '50%'`, `transform: [{ translateX: -halfWidth }, { translateY: -halfHeight }]`, `width: '82%'`
- `TextInput` with `autoFocus={true}` — keyboard rises immediately when screen opens
- Placeholder: `"Thêm ghi chú..."` in `rgba(255,255,255,0.5)`
- Typed text: white, `fontFamily: fonts.bold`, `fontSize: 16`, `textShadowColor: rgba(0,0,0,0.8)`, `textShadowRadius: 12`
- `textAlign: 'center'`, `multiline`, `maxLength: 200`
- A short decorative underline (`width: 50, height: 2, backgroundColor: rgba(255,255,255,0.4)`) sits below the input
- `selectionColor: colors.pink`
- Tapping outside the input (on the photo) dismisses the keyboard — implemented with a `TouchableWithoutFeedback` wrapping the whole screen that calls `Keyboard.dismiss()`

---

## Album Tiles

Replaces the current checkbox list. Rendered in a `View` with `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: 6`.

**Each tile:**
- `flex: 0` (no grow/shrink), `width: 'max-content'` is not supported in RN — use `alignSelf: 'flex-start'` so the tile shrinks to its content
- `minWidth: (containerWidth - 60) / 3` — computed at render time from `useWindowDimensions`, enforces max 3 per row. Offset = horizontal padding (24 × 2 = 48) + two inter-tile gaps (6 × 2 = 12) = 60
- `maxWidth: containerWidth - 48` — allows a tile to span the full row (minus horizontal padding only)
- `borderRadius: 10`, `paddingVertical: 7`, `paddingHorizontal: 9`
- Unselected: `backgroundColor: rgba(255,255,255,0.12)`, `borderColor: rgba(255,255,255,0.22)`, `borderWidth: 1.5`
- Selected: `backgroundColor: colors.pink`, `borderColor: colors.pink`

**Inside each tile (row, left to right):**
1. Checkbox box — `width: 14, height: 14, borderRadius: 4, borderWidth: 1.5`
   - Unselected: `borderColor: rgba(255,255,255,0.45)`, no fill, no icon
   - Selected: `borderColor: white`, `backgroundColor: rgba(255,255,255,0.25)`, Phosphor `Check` icon size 9 in white
2. Album name — `fontSize: 10`, `fontFamily: fonts.semiBold`, `color: rgba(255,255,255,0.9)` (white when selected), `numberOfLines: 1`, `ellipsizeMode: 'tail'`, `flexShrink: 1`

**Tile width calculation in React Native:**
```ts
const { width } = useWindowDimensions();
const containerWidth = width - spacing['2xl'] * 2; // subtract horizontal padding
const tileMin = (containerWidth - 6 * 2) / 3;      // subtract two inter-tile gaps, divide by 3
```

---

## Save Button

Same sticker-style as current:
- White fill, `borderColor: colors.ink`, `borderWidth: 1.5`, `boxShadow: 3 3 0 colors.ink`
- `borderRadius: radii.md`
- Label: `"Lưu lại"`, `fontFamily: fonts.semiBold`, `color: colors.ink`
- Disabled (opacity 0.5) until at least one album is selected
- Uses existing `<Button>` component: `variant="ghost"` tier `"quiet"` won't match — use the existing `Button` with custom styles, or render inline since the style deviates from the component's current variants. Prefer inline `TouchableOpacity` to avoid overcomplicating the `Button` component.

---

## Keyboard Behaviour

- `KeyboardAvoidingView` with `behavior="padding"` (iOS) / `"height"` (Android) wraps the screen
- The bottom zone (album tiles + save button) is inside the avoiding view so it rises above the keyboard
- The caption input stays at vertical center of the photo — it does not move when keyboard opens

---

## Upload & Save Logic

No changes to upload or save logic. `startBackgroundUpload` is called on mount with the single asset. `finishCapture` is called on save with the upload result, asset, selected album IDs, and trimmed caption (or `null` if blank). Confetti + dismiss after success.

---

## Test IDs

Preserve all existing test IDs to avoid breaking `photo-review.test.tsx`:
- `review-close`, `review-retake`, `review-note-input`, `review-save`
- `album-checkbox-${album.id}` — keep this on each tile's `TouchableOpacity`

---

## What Does NOT Change

- Store (`photoReviewStore`) — no changes
- `useCapture` hook — no changes
- Upload flow — no changes
- `VideoPreview` sub-component — stays as-is, just rendered full-bleed
- Confetti — stays as-is
