# Sticker World — App-Wide UI Redesign

**Date:** 2026-06-11
**Status:** Approved

## Overview

Redesign every user-facing screen of the Nhật ký mobile app into a single, coherent visual identity called **Sticker World**. The current app already trends in this direction (cream + ink palette, Baloo 2 font, offset "sticker" shadows on thick borders), but the execution is uneven across screens and lacks the personality that would make it feel "uniquely yours" rather than "an app."

Sticker World pushes the existing direction further with three additions:

1. **A persistent mascot** — a cat character (🐱 Mèo) that appears on sign-in, in the home header, as the default avatar, and in onboarding scenes.
2. **A consistent sticker vocabulary** — every interactive surface uses the same 2.5px ink border + 3–4px hard offset shadow (no blur). State chips (counts, dates, owner badges, video markers) are pill-shaped stickers.
3. **Light playfulness through tilt** — list rows and grid cells get a subtle rotation (-1° to +1°) for a hand-placed feel; never enough to feel chaotic.

The redesign also introduces a **first-run onboarding tour** that doesn't exist today, to set the warm tone before the user reaches any photos.

Feature set is unchanged. This is a visual/UX redesign only.

## Non-Goals

- No new features. Capture, albums, stories, sharing, settings stay functionally identical.
- No backend changes. API contracts and data shapes stay the same.
- No new animation system. Existing reanimated usage stays; no Lottie or skia introductions.
- Account restore screen (`app/(auth)/restore.tsx`) is out of scope — rare path, ship later.
- Per-album mascots / per-user mascot customization is out of scope (defer to a follow-up).

---

## Design System Updates

All design tokens live in `mobile/src/constants/theme.ts`. The redesign updates this file as the foundation; individual screens then consume the updated tokens.

### Colors (`theme.ts`)

The existing palette stays — it already matches Sticker World. Two additions:

```ts
export const colors = {
  // ... existing ...
  butter:       '#FFF6E0',  // NEW — warmer cream for Sticker World backgrounds
  butterDeep:   '#FFE9A8',  // NEW — radial-gradient highlight on home/onboarding
} as const;
```

Background screens that currently use `cream` (`#FFFBF0`) switch to `butter` (`#FFF6E0`) with a radial gradient highlight using `butterDeep` at 30% from top-center. This is what gives the screens their "lit-from-above" feel.

### Shadows (`theme.ts`)

The `sticker` shadow already exists (`offset 3,3, no blur`). Add a heavier variant for primary CTAs:

```ts
export const shadows = {
  // ... existing ...
  stickerHeavy: {
    shadowColor:   '#3D2A1F',
    shadowOpacity: 1,
    shadowRadius:  0,
    shadowOffset:  { width: 4, height: 4 },
    elevation:     5,
  },
} as const;
```

### Typography (`theme.ts`)

Baloo 2 stays for body. Add a display style for headlines that need extra personality (onboarding titles, Nhật ký logo):

```ts
export const typography = {
  // ... existing ...
  display:     { fontFamily: fonts.bold, fontSize: 28, color: colors.ink },  // already exists, used more aggressively
  displayCute: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },  // NEW — onboarding titles, with text shadow
} as const;
```

The "Comic-cursive" feel of the mockups is achieved with `Baloo2_700Bold` plus a `text-shadow: 2px 2px 0 #FFD66B` on the logo and home title. No new font is loaded.

### New Reusable Components

Created under `mobile/src/components/ui/`:

#### `StickerCard.tsx`

A reusable surface with the ink border + offset shadow. Replaces ad-hoc inline styles currently scattered across `AlbumsPage`, `albums/[id].tsx`, settings rows, etc.

```ts
type Props = {
  children: ReactNode;
  tilt?: number;          // degrees, default 0
  shadow?: 'normal' | 'heavy';  // default normal
  color?: keyof typeof colors;  // bg, default white
  style?: ViewStyle;
};
```

#### `StickerChip.tsx`

Pill-shaped sticker for state (counts, dates, badges, video markers, selected filters). Variants: `default` (yellow on ink), `pink`, `mint`, `sky`, `white`.

```ts
type Props = {
  label: string;
  variant?: 'yellow' | 'pink' | 'mint' | 'sky' | 'white' | 'ink';
  tilt?: number;
  icon?: ReactNode;
};
```

#### `StickerButton.tsx`

Replaces the existing ad-hoc pill button in `AlbumsPage` (`cameraPill`) and equivalent CTAs across screens. Supports primary (pink), secondary (yellow), and inverted (ink) variants. Uses `stickerHeavy` shadow.

#### `Mascot.tsx`

A small wrapper that renders the cat emoji (🐱) with a configurable size, rotation, and drop-shadow. Centralized so future swap to an SVG illustrated mascot only touches one file.

```ts
type Props = {
  size?: number;        // default 32
  tilt?: number;        // degrees
  withShadow?: boolean; // ink drop-shadow, default true
};
```

---

## Mascot System

The mascot is **🐱 (cat / Mèo)**. It's rendered via the new `<Mascot />` component anywhere a character is needed.

Where the mascot appears:
- Onboarding pages 1–3 (large, animated entrance on first appearance)
- Onboarding page 4 (with two other animals representing other family members)
- Sign-in screen (large hero)
- Home header (small, next to "Nhật ký" title)
- Default user avatar when `user.avatar_url` is null (settings profile card, profile editor, members list)
- Empty states (album list with zero albums, day grid with zero days)

The mascot is rendered as the emoji 🐱 for v1. Migration to a custom SVG illustration is a follow-up, gated only by replacing the body of `Mascot.tsx`.

---

## Onboarding Flow (NEW)

### Route

New route at `mobile/app/onboarding.tsx`. The root layout (`app/_layout.tsx`) gates this:

```
splash
  ↓
if !secureStore.has('onboarding.seen'):
  → /onboarding
  ↓ ("Bắt đầu" or "Bỏ qua")
if !auth.token:
  → /(auth)
  ↓
/(tabs)
```

`SecureStore` key: `onboarding.seen`, value: `'1'`. Set when user taps "Bắt đầu" on page 4 or "Bỏ qua" on any page.

### Pages

Four full-screen pages in a horizontal pager (using existing `react-native-pager-view`):

| # | Title | Body | Hero illustration |
|---|-------|------|-------------------|
| 1 | Chào mừng đến Nhật ký! | Cuốn nhật ký hình ảnh của cả nhà bạn | Large cat mascot with speech bubble ("Xin chào!"). Doodle stars/flowers in corners. |
| 2 | Mỗi ngày một khoảnh khắc | Chạm để chụp, giữ để quay video ngắn | Cat next to a sticker-styled camera. Two callout chips: "📷 Chạm = ảnh" and "🎥 Giữ = video". |
| 3 | Xem lại như story | Mỗi ngày là một story riêng, tự chạy như Instagram | Cat watching a mini-phone showing a story with progress bar. Play arrow accent. |
| 4 | Cùng cả nhà lưu giữ kỉ niệm | Mời người thân vào album để cùng ghi lại từng ngày | Three mascots side by side (🐱 🐶 🐤) with floating hearts. |

### Page Chrome

- Top right: "Bỏ qua" text button (sets `onboarding.seen` and navigates to `/(auth)`)
- Bottom center: dot indicator (active dot is a stretched pink pill; inactive dots are circles with ink borders)
- Bottom (above safe area): `StickerButton` — "Tiếp →" on pages 1–3, "🚀 Bắt đầu nào" full-width on page 4

### Animations

Subtle, performance-cheap reanimated effects only:
- Mascot scale-pop on page enter (`scale 0.85 → 1.0`, spring)
- Speech bubble fade+rotate on page 1
- Dots animate width when active changes

No mandatory walkthrough animations — user can swipe at their own pace.

---

## Screen-by-Screen Redesign

Every screen below uses the components above (`StickerCard`, `StickerChip`, `StickerButton`, `Mascot`) and the updated theme tokens. The descriptions list what changes from the current implementation; functionality is identical to today's behavior unless explicitly noted.

### Sign-in — `app/(auth)/index.tsx`

- Background: gradient `butterDeep → pink-light` (kept similar to current but warmer).
- Hero: large `<Mascot size={80} tilt={-3} />` centered upper third (replaces the 👶 emoji).
- Logo: "Nhật ký" rendered as a yellow `StickerChip` with thick ink border + offset shadow + slight tilt. Replaces plain text headline.
- Tagline: "cuốn nhật ký của gia đình" below logo.
- Apple button: `StickerButton variant="ink"` (black with cream text).
- Google button: `StickerButton variant="white"` (white with ink text).
- Floating dots: keep the existing `FloatingDot` component but reduce count to 4 (down from 6) for less visual noise.
- Privacy link: stays as small text at bottom.

### Onboarding — `app/onboarding.tsx` (NEW)

See "Onboarding Flow" section above.

### Home / Albums — `mobile/src/components/tabs/AlbumsPage.tsx`

- Heading row: `<Mascot size={24} tilt={-8} />` + "Nhật ký" title with yellow text-shadow + `StickerCard`-bordered menu button. Replaces plain `Text` heading + outline `DotsThree`.
- Album rows: wrap each row in `<StickerCard tilt={i % 2 === 0 ? -0.6 : 0.5}>`. Alternating tilt creates the hand-placed feel.
- Album row content: 42px square `StickerCard` thumb (or colored placeholder with sticker icon if no `cover_thumb_url`) + name + `<StickerChip variant="yellow" tilt={3} label={count} />` showing photo count.
- Empty state: large 80px `<Mascot />` + caption "Chưa có album nào" + `StickerButton` "Tạo album đầu tiên".
- Capture pill: replace existing `cameraPill` styles with `<StickerButton variant="pink" shadow="heavy" />`. Same position, same icon, same behavior.
- Create-album modal: card uses `StickerCard` shadow; input gets ink border; confirm button is `StickerButton`.

**New data needed:** album photo count. If not already returned by `/albums`, add `photo_count` to the response (backend out of scope; if unavailable at ship time, hide the chip rather than show a placeholder).

### Camera — `mobile/src/components/tabs/CameraPage.tsx`

- Top bar icons (close + flip): replace existing dark-circle buttons with butter-colored `StickerCard` icons (26px, ink border + offset shadow). Provides visual contrast against the live camera feed.
- Time strip: replace the existing thin `MediaCaption` time display with a tilted `StickerChip variant="yellow"` centered on screen showing the live clock. Larger and more confident.
- Hint pill: when the first-time hint is shown, render as a `StickerChip variant="ink"` (dark with white text) so it reads against the camera feed but stays in the sticker vocabulary.
- Shutter: keep the existing animated progress arc but enlarge the outer ring to 70px and add ink border + offset shadow on the outer ring. Inner circle becomes pink instead of white when not recording.
- Permission modal: replace plain card with `StickerCard` + `StickerButton` primary CTA.

### Photo Review — `mobile/app/photo-review.tsx`

- Background: full-bleed photo or video (unchanged).
- Top bar: close icon becomes a butter `StickerCard` button. "Chụp lại" becomes a yellow `StickerChip variant="yellow"`.
- Time display: `StickerChip variant="yellow"` tilted (-3°) replacing the existing `MediaCaption` strip.
- Caption input: a white `StickerCard` with ink border + offset shadow containing the text input. Replaces the existing inline caption strip.
- Album chips: switch from current grayscale opacity-based selection to `StickerChip` — unselected is `variant="white"`, selected is `variant="pink"` with a checkmark prefix.
- Save button: full-width `StickerButton variant="ink"` with cream text and yellow offset shadow (this is the "loud, primary" CTA — it stands out against the photo background better than any sticker pink would).
- Confetti animation on save: keep existing `<Confetti />` — already on-brand.

### Album / Day Grid — `mobile/app/albums/[id].tsx`

- Header: back + menu buttons become butter `StickerCard` 24px icons. Title is centered.
- Day cells (existing `DayCell` component): rebuild as a `StickerCard` with alternating tilt (-1°/+1°). Photo thumb gets a 1.5px ink border inset. Date label below thumb uses `displayCute` style ("Thứ 5 · 11.06" pattern). Video badge becomes a small dark sticker chip in the top-right corner of the thumb.
- Empty state: 80px `<Mascot />` + "Chưa có khoảnh khắc nào" + "Vuốt sang tab Camera để chụp ảnh đầu tiên" hint.
- Rename modal: same upgrade as the create-album modal (StickerCard + StickerButton).
- Archived banner: thin `StickerChip variant="ink"` instead of the current borderless gray bar.

### Story Viewer — `app/story/[albumId]/[date].tsx`

- Progress bar: thicker (5px), with an ink border (1.5px), segments separated by tiny gaps, active segments filled yellow.
- Top bar: back + menu buttons become butter `StickerCard` icons (24px). Date chip becomes a tilted yellow `StickerChip` reading "DD.MM.YYYY" in display-cute font.
- Time display: small ink-colored time sticker chip in upper-left below the top bar (replaces the current overlay logic).
- Caption: rendered as a white `StickerCard` with tilt(-0.5°) at the bottom of the screen, instead of the current `MediaCaption` strip.
- Reaction button: top-right area gets a 32px round `StickerCard` with the dominant emoji (or "💖" by default). Tap opens existing `ReactionPicker`. Picker itself is re-skinned to use sticker chips.
- Menu dropdown: card uses `StickerCard` styling (warm dark instead of cold gray); items get pink/cream hover.

### Photo Detail — `mobile/app/photo/[id].tsx`

This screen exists today and shows a single photo. Refactor toward Sticker World:

- Top bar: back + menu butter `StickerCard` buttons; centered tilted yellow date chip.
- Reaction row at bottom: row of round `StickerCard` reaction buttons. Active reactions show a small pink count badge. Replaces current `ReactionBadge` row styling.
- Caption: rendered as a white `StickerCard` with tilt(-0.5°) above the reaction row.
- All controls use the unified sticker vocabulary.

### Manage Day — `app/story/[albumId]/[date]/manage.tsx`

- Header: ink-bordered back button + "Quản lý ngày" title.
- Grid of photos for the day: each is a `StickerCard` with tilt, photo inside, X-button overlay sticker chip in top-right for delete.
- Caption editor: full-width `StickerCard` with ink border for the note input.
- Save: `StickerButton variant="pink"` at bottom.

### Settings — `mobile/app/(tabs)/settings/index.tsx`

- Header: back button (butter `StickerCard`) + "Cài đặt" title in display-cute font.
- Profile card: `StickerCard tilt={-0.5} shadow="normal"` containing 36px round mascot/avatar + display name + email.
- Section rows: each row is a `StickerCard` with a 22px colored square icon container (yellow / mint / sky / peach rotating by row) + label + chevron. Replaces current borderless rows from `2026-06-11-settings-rich-design.md`.
- Sign-out button: red `StickerButton`.
- Version string: small text at bottom (unchanged).

### Profile — `mobile/app/(tabs)/settings/profile.tsx`

- Large 78px avatar in a pink `StickerCard` round — pink default if no `avatar_url`, otherwise user image. Camera icon overlay is a small yellow `StickerCard` button.
- Display name field: small uppercase label + `StickerCard`-bordered input.
- Email field: read-only `StickerCard`-bordered input.
- Save button: full-width pink `StickerButton` at bottom.

### Language — `mobile/app/(tabs)/settings/language.tsx`

- Header same as Settings.
- Each language option is a `StickerCard` row with flag emoji + label + checkmark chip when active.
- Three options stay: Theo thiết bị / Tiếng Việt / English.

### Members Sheet — `mobile/src/components/family/MembersSheet.tsx`

- Sheet container: butter background with ink-bordered top edges (2px) and rounded top corners. Drag handle.
- Title: "👥 Thành viên · {album name}" in display-cute font.
- Each member row: `StickerCard` containing 30px round avatar (mascot if no avatar set) + name + status chip ("CHỦ" yellow sticker for owner, X button for removable members).
- "+ Mời thêm người" at bottom is a pink `StickerButton`.

### Invite Sheet — `mobile/src/components/family/InviteSheet.tsx`

- Same sheet container.
- Title: "📨 Mời vào album"
- QR code: kept as actual generated QR; wrapped in a white `StickerCard` with ink border.
- Link row: `StickerCard` with truncated link text + a "Sao chép" yellow sticker chip button.
- "📤 Chia sẻ link" pink `StickerButton` at bottom.

### Album Menu / QR / Settings Sheets

The remaining sheets (`AlbumMenuSheet`, `QRSheet`, `SettingsSheet`) follow the same pattern: butter background, ink-bordered, sticker rows for items. Each list item gets a colored 22px square sticker icon for visual rhythm.

---

## Implementation Order

The redesign should land in dependency order, not screen order. Suggested sequence (each step is independently testable):

1. **Theme tokens & base components.** Update `theme.ts` (colors, shadows, typography). Build `Mascot`, `StickerCard`, `StickerChip`, `StickerButton` components with unit tests. No screen changes yet.
2. **Home / Albums.** Apply new components to `AlbumsPage`. Highest-impact screen, validates the system end-to-end.
3. **Onboarding flow.** Build `app/onboarding.tsx` + root layout gating + SecureStore key. New users will see it; existing users (token already present) will set `onboarding.seen` on next launch to skip.
4. **Sign-in.** Refresh with new components.
5. **Capture flow** (Camera + Photo Review). High-traffic, makes the daily experience feel new.
6. **Day Grid + Story Viewer + Photo Detail.** The viewing experience.
7. **Settings + Profile + Language.** Lower priority surfaces.
8. **Sheets** (Members, Invite, Album Menu, QR, Settings sheet).

Each step gets its own PR and visual review.

## Accessibility & I18n

- All sticker chips/buttons retain text labels; icons are decorative-only.
- Touch targets stay ≥40×40 even though visual sizes are smaller (use `hitSlop`).
- Tilted elements use `transform: rotate(...)` only — no `accessibilityElementsHidden` consequences.
- All copy stays Vietnamese-first per existing `i18n` setup. New strings added: onboarding page titles/bodies, "Bỏ qua", "Bắt đầu nào", "+ Mời thêm người", and any new empty-state copy.

## Open Questions

None blocking. Worth confirming post-implementation:

- Whether to commission a custom illustrated cat for v2 (replaces `🐱` inside `Mascot.tsx`).
- Whether onboarding should include a 5th "pick your mascot" page (defers character selection to the user).
- Whether to add subtle paper-grain texture as a background layer on home/onboarding (vs the current radial gradient alone).
