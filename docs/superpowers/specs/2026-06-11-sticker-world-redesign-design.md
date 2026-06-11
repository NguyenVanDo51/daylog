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
- Runtime theme switching from Settings is out of scope. Compile-time only.

---

## Theme System

Every visual decision in the app must be expressed as a value in `mobile/src/constants/theme.ts`. No screen or component may declare a hex color, a shadow offset, a border width, a border-radius, or a rotation amount inline. The goal: **adding a future visual theme (e.g. Paper Journal, Soft Cloud) requires editing only `theme.ts`** — no component or screen code is touched.

### Architecture

`theme.ts` exports a `Theme` interface plus one or more named theme objects. v1 ships with `stickerWorld`. The active theme is fixed at compile time:

```ts
// theme.ts
export interface Theme { /* shape below */ }

export const stickerWorld: Theme = { /* concrete values */ };

// Single source of truth — flip this line to swap themes app-wide:
export const theme: Theme = stickerWorld;

// Convenience re-exports so existing destructured imports keep working:
export const colors     = theme.colors;
export const spacing    = theme.spacing;
export const typography = theme.typography;
export const radii      = theme.radii;
export const shadows    = theme.shadows;
export const fonts      = theme.fonts;
```

Components import `theme` directly (no React context, no Provider). This keeps re-render behavior unchanged and tree-shaking simple. Compile-time switching is sufficient given the chosen scope.

### Theme Shape

The `Theme` interface covers every visual axis the app uses. Names are **semantic**, never Sticker-World-specific:

```ts
export interface Theme {
  name: string;

  colors: {
    // Surfaces
    background: string;            // page background
    backgroundHighlight: string;   // radial-gradient highlight color
    surface: string;               // card / row background
    surfaceMuted: string;          // disabled / placeholder

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textOnPrimary: string;         // text on .primary surface
    textOnInverted: string;        // text on .inverted surface

    // Brand & accents
    primary: string;               // main CTA color (Sticker World: pink)
    primaryDeep: string;
    accent1: string;               // secondary (yellow)
    accent2: string;               // tertiary (mint)
    accent3: string;               // quaternary (sky)
    accent4: string;               // quinary (peach)

    // Functional
    error: string;
    success: string;
    border: string;                // primary stroke color
    borderSoft: string;            // hairline divider

    // Album placeholder colors (cycled by index)
    swatch: readonly string[];
  };

  // Stroke widths
  border: {
    hairline: number;              // 1
    thin: number;                  // 1.5
    medium: number;                // 2
    thick: number;                 // 2.5 — sticker default
  };

  // ViewStyle objects, ready to spread
  shadows: {
    none: ViewStyle;
    soft: ViewStyle;               // diffuse blur, for modals
    sticker: ViewStyle;            // offset 3,3, no blur
    stickerHeavy: ViewStyle;       // offset 4,4
  };

  radii: {
    none: number;
    sm: number;                    // 8
    md: number;                    // 12
    lg: number;                    // 18
    pill: number;                  // 9999
  };

  spacing: {
    xs: number; sm: number; md: number; lg: number;
    xl: number; '2xl': number; '3xl': number; '4xl': number;
  };

  fonts: {
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
    display: string;               // headline font (themes can swap)
  };
  typography: {
    display: TextStyle;
    displayCute: TextStyle;        // headline with text-shadow accent
    heading: TextStyle;
    title: TextStyle;
    body: TextStyle;
    bodySmall: TextStyle;
    pill: TextStyle;
    caption: TextStyle;
  };

  // Rotation amounts — themes with flat UI set all of these to 0
  tilts: {
    none: number;                  // 0
    subtle: number;                // 0.5
    default: number;               // 1
    playful: number;               // 2
  };

  // Character. Themes without a mascot set emoji to null.
  mascot: {
    emoji: string | null;
    speechGreeting: string;        // onboarding speech bubble copy
    speechEmpty: string;           // empty-state caption
  };

  // How the page background renders
  background: {
    kind: 'plain' | 'radial' | 'gradient';
    primary: string;
    highlight: string;
    angleDeg?: number;
  };

  // Derived component presentation — components read these directly,
  // never the underlying color/border/shadow tokens.
  components: {
    stickerCard: {
      backgroundColor: string;
      borderWidth: number;
      borderColor: string;
      borderRadius: number;
      shadow: ViewStyle;
    };
    stickerButton: {
      primary: ButtonVariant;     // main CTA
      secondary: ButtonVariant;   // alternate accent
      inverted: ButtonVariant;    // dark surface
      surface: ButtonVariant;     // light surface with ink border
      danger: ButtonVariant;      // destructive (sign-out, delete)
      ghost: ButtonVariant;       // borderless / minimal
    };
    stickerChip: {
      yellow: ChipVariant;
      pink: ChipVariant;
      mint: ChipVariant;
      sky: ChipVariant;
      white: ChipVariant;
      ink: ChipVariant;
    };
  };
}

interface ButtonVariant {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: ViewStyle;
}

interface ChipVariant {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
}
```

### Rules

1. **No raw hex in screens or components.** Always read from `theme.colors.*`.
2. **No raw shadow offsets / border widths / radii.** Use `theme.shadows.*`, `theme.border.*`, `theme.radii.*`.
3. **No raw rotation values.** Use `theme.tilts.subtle | default | playful | none`. Components that alternate tilts pick from these tokens.
4. **No `if (theme.name === 'stickerWorld')` checks anywhere.** If a behavior must differ between themes, express it as a token (e.g. a flat theme sets all `tilts` to 0; a mascot-less theme sets `mascot.emoji` to null).
5. **Component variants live in `theme.components.*`.** `<StickerButton variant="primary">` reads `theme.components.stickerButton.primary`; the component file contains no hex / no offset / no border-width literal.
6. **The mascot is read from `theme.mascot.emoji`.** `Mascot.tsx` does not contain the literal `🐱`.

### Adding a Future Theme

To add (e.g.) a "Paper Journal" theme later:

```ts
// theme.ts
export const paperJournal: Theme = {
  name: 'paperJournal',
  colors: { /* cream/sage/terracotta palette */ },
  border:  { hairline: 1, thin: 1, medium: 1, thick: 1 },      // thinner
  shadows: { sticker: { /* offset 2,2 instead of 3,3 */ }, ... },
  tilts:   { none: 0, subtle: 0, default: 0, playful: 0 },      // flat
  mascot:  { emoji: null, ... },                                // no character
  typography: { displayCute: { fontFamily: 'Georgia', ... } },  // serif headline
  components: { /* recomputed from above */ },
};

export const theme: Theme = paperJournal;  // flip this line
```

No component or screen file is touched. If a future theme requires a new visual axis the interface doesn't cover (e.g. a paper-grain texture image), evolve the interface: add the axis with a sensible default for the existing theme, then implement the new theme. Components keep reading from the interface, never from a specific theme.

### Component Consumption

```ts
import { theme } from '@/constants/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.components.stickerCard.backgroundColor,
    borderWidth:     theme.components.stickerCard.borderWidth,
    borderColor:     theme.components.stickerCard.borderColor,
    borderRadius:    theme.components.stickerCard.borderRadius,
    ...theme.components.stickerCard.shadow,
  },
});
```

Existing destructured imports (`import { colors, spacing } from '@/constants/theme'`) keep working through the convenience re-exports — no breaking change to current screens during migration.

### Migration

The first step of the Implementation Order ("Theme tokens & base components") expands to:

1. Refactor `theme.ts` to export the `Theme` interface, the concrete `stickerWorld` theme, and the convenience re-exports.
2. Audit the codebase for hardcoded hex / shadow / rotation / border-width values outside `theme.ts`. Replace with theme references. Most violations are inline `rgba(...)` overlays in `story/[albumId]/[date].tsx`, `photo-review.tsx`, and `CameraPage.tsx` — these become `theme.colors.*` references (add new semantic tokens like `theme.colors.scrim` if needed).
3. Add an ESLint rule (or a simple grep-based CI check) that fails the build if `/#[0-9a-fA-F]{3,8}|rgba?\s*\(/` matches outside `theme.ts` or `*.test.*` files. This is the enforcement mechanism for rule #1.
4. Build `StickerCard`, `StickerChip`, `StickerButton`, `Mascot` against `theme.components.*`. None of these component files may reference `theme.colors`, `theme.shadows`, or `theme.border` directly — only `theme.components.*` and `theme.tilts`/`theme.radii`.

After this step, the app looks identical to today, but every visual value is reachable from `theme.ts`. Subsequent steps (Home, Onboarding, etc.) only consume the new components and tokens.

---

## Sticker World Theme — Concrete Values

The values below populate the `stickerWorld: Theme` object in `mobile/src/constants/theme.ts`. Future themes are introduced by defining sibling objects with the same `Theme` shape; no other file changes.

### Colors

Most of the existing palette carries over from the current `theme.ts` but is now mapped to **semantic** token names inside `stickerWorld.colors`:

| Semantic token         | Sticker World value | Used for                                |
|------------------------|---------------------|------------------------------------------|
| `background`           | `#FFF6E0` (butter)  | Page background base                     |
| `backgroundHighlight`  | `#FFE9A8` (warm)    | Radial-gradient highlight from top-center|
| `surface`              | `#FFFFFF`           | Cards, rows, sheets                      |
| `surfaceMuted`         | `#F0E6D6`           | Placeholder thumbs, disabled bg          |
| `textPrimary`          | `#2A1810`           | Ink — primary text and stroke            |
| `textSecondary`        | `#7B5544`           | Less important text                      |
| `textMuted`            | `#B5A89C`           | Captions, hints                          |
| `textOnPrimary`        | `#FFFFFF`           | Text on `.primary` surfaces              |
| `textOnInverted`       | `#FFF6E0`           | Text on `.inverted` (ink) surfaces       |
| `primary`              | `#FF7AA8` (pink)    | Main CTA, selected state                 |
| `primaryDeep`          | `#E55B8C`           | Pressed state, danger                    |
| `accent1`              | `#FFD66B` (yellow)  | Default sticker chip, highlights         |
| `accent2`              | `#7FD7B5` (mint)    | Success state, secondary chip            |
| `accent3`              | `#7FB7FA` (sky)     | Info state, tertiary chip                |
| `accent4`              | `#FF8E66` (peach)   | Quaternary accent                        |
| `error`                | `#E55B8C`           | Destructive actions                      |
| `success`              | `#7FD7B5`           | Confirmation                             |
| `border`               | `#2A1810`           | Ink — primary stroke color               |
| `borderSoft`           | `#F0E6D6`           | Hairline dividers                        |
| `swatch[]`             | pink/mint/sky/peach/yellow | Album placeholder colors, cycled by index |

The radial-gradient page background is expressed as `theme.background = { kind: 'radial', primary: colors.background, highlight: colors.backgroundHighlight }`. A flat theme could set `kind: 'plain'`.

### Borders

```
hairline: 1
thin:     1.5
medium:   2
thick:    2.5   ← sticker default
```

### Shadows

```
none:         (no shadow)
soft:         offset (0,2), blur 10, opacity 0.08  — modals
sticker:      offset (3,3), blur 0,  opacity 1     — cards / chips / buttons
stickerHeavy: offset (4,4), blur 0,  opacity 1     — primary CTAs
```
Shadow color is always `colors.border`.

### Radii

```
none: 0
sm:   8
md:   12
lg:   18
pill: 9999
```

### Spacing

Unchanged from current `theme.ts`: `xs:4, sm:8, md:12, lg:16, xl:20, 2xl:24, 3xl:32, 4xl:48`.

### Typography

Baloo 2 stays for body and headlines. No new font is loaded.

```
fonts:
  regular  = Baloo2_400Regular
  medium   = Baloo2_500Medium
  semiBold = Baloo2_600SemiBold
  bold     = Baloo2_700Bold
  display  = Baloo2_700Bold        ← themes can override

typography:
  display     = bold, 28
  displayCute = bold, 22, textShadow 2px 2px 0 colors.accent1  ← onboarding titles, logo
  heading     = semiBold, 22
  title       = semiBold, 18
  body        = medium, 14
  bodySmall   = medium, 12, textSecondary
  pill        = semiBold, 11, letterSpacing 0.3
  caption     = medium, 10, textMuted
```

The "Comic-cursive" feel of the mockups is achieved by `displayCute`'s yellow text-shadow, not by a different font.

### Tilts

```
none:    0
subtle:  0.5°
default: 1°
playful: 2°
```

A flat-UI theme sets all four to `0`.

### Mascot

```
emoji:          '🐱'
speechGreeting: 'Xin chào!'
speechEmpty:    'Chưa có gì ở đây cả!'
```

A mascot-less theme sets `emoji: null` — `Mascot.tsx` renders nothing.

### Component Variants

Each variant resolves to a concrete `ChipVariant` / `ButtonVariant` inside `stickerWorld.components`. Variant names are semantic; their visual values can differ per theme.

`components.stickerChip.*`

| Variant key | bg            | fg            | borderColor |
|-------------|---------------|---------------|-------------|
| `yellow`    | `accent1`     | `textPrimary` | `border`    |
| `pink`      | `primary`     | `textOnPrimary` | `border`  |
| `mint`      | `accent2`     | `textPrimary` | `border`    |
| `sky`       | `accent3`     | `textPrimary` | `border`    |
| `white`     | `surface`     | `textPrimary` | `border`    |
| `ink`       | `textPrimary` | `accent1`     | `border`    |

`components.stickerButton.*`

| Variant key | bg            | fg              | shadow         |
|-------------|---------------|-----------------|----------------|
| `primary`   | `primary`     | `textOnPrimary` | `stickerHeavy` |
| `secondary` | `accent1`     | `textPrimary`   | `sticker`      |
| `inverted`  | `textPrimary` | `textOnInverted`| `stickerHeavy` |
| `surface`   | `surface`     | `textPrimary`   | `sticker`      |
| `danger`    | `error`       | `textOnPrimary` | `sticker`      |
| `ghost`     | `transparent` | `textPrimary`   | `none`         |

`components.stickerCard`

```
backgroundColor = surface
borderWidth     = border.thick (2.5)
borderColor     = border
borderRadius    = radii.md (12)
shadow          = sticker
```

### New Reusable Components

Created under `mobile/src/components/ui/`. Every component reads exclusively from `theme.components.*` and `theme.tilts` / `theme.radii` — never from `theme.colors` or `theme.shadows` directly. This is what guarantees that a future theme change only touches `theme.ts`.

#### `StickerCard.tsx`

A reusable surface with theme-driven border + offset shadow. Replaces ad-hoc inline styles currently scattered across `AlbumsPage`, `albums/[id].tsx`, settings rows, etc.

```ts
type Props = {
  children: ReactNode;
  tilt?: keyof Theme['tilts'];        // 'none' | 'subtle' | 'default' | 'playful' — default 'none'
  shadow?: 'normal' | 'heavy';        // maps to theme.components.stickerCard.shadow / stickerHeavy
  surface?: 'default' | 'muted';      // default reads theme.components.stickerCard.backgroundColor
  style?: ViewStyle;                  // escape hatch — must not pass color/shadow values
};
```

#### `StickerChip.tsx`

Pill-shaped sticker for state (counts, dates, badges, video markers, selected filters). Variant keys match `theme.components.stickerChip.*`.

```ts
type Props = {
  label: string;
  variant?: keyof Theme['components']['stickerChip'];  // 'yellow' | 'pink' | 'mint' | 'sky' | 'white' | 'ink'
  tilt?: keyof Theme['tilts'];
  icon?: ReactNode;
};
```

#### `StickerButton.tsx`

Replaces the existing ad-hoc pill button in `AlbumsPage` (`cameraPill`) and equivalent CTAs across screens. Variant keys match `theme.components.stickerButton.*`.

```ts
type Props = {
  label: string;
  variant?: keyof Theme['components']['stickerButton'];  // 'primary' | 'secondary' | 'inverted' | 'ghost'
  shadow?: 'normal' | 'heavy';
  fullWidth?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};
```

#### `Mascot.tsx`

Renders `theme.mascot.emoji` with configurable size, rotation, and drop-shadow. Centralized so the mascot is theme-driven: a future theme can swap the cat for a different character, or set `theme.mascot.emoji = null` to render nothing.

```ts
type Props = {
  size?: number;                       // default 32
  tilt?: keyof Theme['tilts'];         // default 'none'
  withShadow?: boolean;                // ink drop-shadow, default true
};
```

`Mascot.tsx` MUST NOT contain a literal `🐱`. It reads `theme.mascot.emoji`; if null, renders nothing (no fallback). The drop-shadow color comes from `theme.colors.border`.

#### `Avatar.tsx`

A round, sticker-bordered surface used for user/member avatars across settings, profile, members sheet, etc. Falls back to `<Mascot />` when no image URL is available.

```ts
type Props = {
  size?: number;                       // default 40
  src?: string | null;                 // image URL; null → fallback to mascot
  bgColor?: keyof Theme['colors'];     // background when no image; default 'primary'
  withCameraOverlay?: boolean;         // for profile editor; default false
};
```

#### Alternating tilts

Lists that alternate tilts (Home album rows, Day grid cells) accept a `flip?: boolean` prop on the sticker components. The component negates the rotation value from `theme.tilts[tilt]` when `flip` is true. Consumers compute `flip` from the row index (`flip={index % 2 === 1}`). This keeps tilt direction logic out of the theme — the theme owns magnitudes, the component owns direction.

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
- Hero: large `<Mascot size={80} tilt="playful" flip />` centered upper third (replaces the 👶 emoji).
- Logo: "Nhật ký" rendered as `<StickerChip variant="yellow" tilt="default" flip />`. Replaces plain text headline.
- Tagline: "cuốn nhật ký của gia đình" below logo.
- Apple button: `<StickerButton variant="inverted" />` (ink-dark with cream text).
- Google button: `<StickerButton variant="surface" />` (white with ink text and border).
- Floating dots: keep the existing `FloatingDot` component but reduce count to 4 (down from 6) for less visual noise.
- Privacy link: stays as small text at bottom.

### Onboarding — `app/onboarding.tsx` (NEW)

See "Onboarding Flow" section above.

### Home / Albums — `mobile/src/components/tabs/AlbumsPage.tsx`

- Heading row: `<Mascot size={24} tilt="playful" flip />` + "Nhật ký" title in `displayCute` typography + `StickerCard`-bordered menu button. Replaces plain `Text` heading + outline `DotsThree`.
- Album rows: wrap each row in `<StickerCard tilt="subtle" flip={index % 2 === 1}>`. Alternating tilt creates the hand-placed feel.
- Album row content: 42px square `<Avatar bgColor="accent1" size={42} src={item.cover_thumb_url} />` thumb (uses the next swatch color when no cover) + name + `<StickerChip variant="yellow" tilt="default" flip label={count} />` showing photo count.
- Empty state: large 80px `<Mascot size={80} />` + caption "Chưa có album nào" + `<StickerButton variant="primary" label="Tạo album đầu tiên" />`.
- Capture pill: replace existing `cameraPill` styles with `<StickerButton variant="primary" shadow="heavy" label="Chụp ảnh" icon={<Camera />} />`. Same position, same behavior.
- Create-album modal: card uses `StickerCard` shadow; input gets ink border; confirm button is `StickerButton`.

**New data needed:** album photo count. If not already returned by `/albums`, add `photo_count` to the response (backend out of scope; if unavailable at ship time, hide the chip rather than show a placeholder).

### Camera — `mobile/src/components/tabs/CameraPage.tsx`

- Top bar icons (close + flip): replace existing dark-circle buttons with butter-colored `StickerCard` icons (26px). Provides visual contrast against the live camera feed.
- Time strip: replace the existing thin `MediaCaption` time display with `<StickerChip variant="yellow" tilt="playful" flip />` centered on screen showing the live clock. Larger and more confident.
- Hint pill: when the first-time hint is shown, render as `<StickerChip variant="ink" />` so it reads against the camera feed but stays in the sticker vocabulary.
- Shutter: keep the existing animated progress arc but enlarge the outer ring to 70px and add ink border + offset shadow on the outer ring. Inner circle becomes pink instead of white when not recording.
- Permission modal: replace plain card with `StickerCard` + `<StickerButton variant="primary" />`.

### Photo Review — `mobile/app/photo-review.tsx`

- Background: full-bleed photo or video (unchanged).
- Top bar: close icon becomes a butter `StickerCard` button. "Chụp lại" becomes `<StickerChip variant="yellow" />`.
- Time display: `<StickerChip variant="yellow" tilt="playful" flip />` replacing the existing `MediaCaption` strip.
- Caption input: `<StickerCard>` containing the text input. Replaces the existing inline caption strip.
- Album chips: switch from current grayscale opacity-based selection to `StickerChip` — unselected is `<StickerChip variant="white" />`, selected is `<StickerChip variant="pink" />` with a checkmark prefix.
- Save button: full-width `<StickerButton variant="inverted" shadow="heavy" />` (ink background, cream text, stands out best against the photo background).
- Confetti animation on save: keep existing `<Confetti />` — already on-brand.

### Album / Day Grid — `mobile/app/albums/[id].tsx`

- Header: back + menu buttons become butter `StickerCard` 24px icons. Title is centered.
- Day cells (existing `DayCell` component): rebuild as `<StickerCard tilt="default" flip={index % 2 === 1}>`. Photo thumb gets a `border.thin` ink stroke. Date label below thumb uses `displayCute` typography ("Thứ 5 · 11.06" pattern). Video badge becomes `<StickerChip variant="ink" />` in the top-right corner of the thumb.
- Empty state: 80px `<Mascot />` + "Chưa có khoảnh khắc nào" + "Vuốt sang tab Camera để chụp ảnh đầu tiên" hint.
- Rename modal: same upgrade as the create-album modal (StickerCard + StickerButton).
- Archived banner: thin `StickerChip variant="ink"` instead of the current borderless gray bar.

### Story Viewer — `app/story/[albumId]/[date].tsx`

- Progress bar: thicker (5px), with an ink border (1.5px), segments separated by tiny gaps, active segments filled yellow.
- Top bar: back + menu buttons become butter `StickerCard` icons (24px). Date chip becomes `<StickerChip variant="yellow" tilt="default" flip />` reading "DD.MM.YYYY" in `displayCute` typography.
- Time display: `<StickerChip variant="ink" />` in upper-left below the top bar (replaces the current overlay logic).
- Caption: rendered as a `<StickerCard tilt="subtle" flip />` at the bottom of the screen, instead of the current `MediaCaption` strip.
- Reaction button: top-right area gets a 32px round `StickerCard` with the dominant emoji (or "💖" by default). Tap opens existing `ReactionPicker`. Picker itself is re-skinned to use sticker chips.
- Menu dropdown: card uses `StickerCard` styling (warm dark instead of cold gray); items get pink/cream hover.

### Photo Detail — `mobile/app/photo/[id].tsx`

This screen exists today and shows a single photo. Refactor toward Sticker World:

- Top bar: back + menu butter `StickerCard` buttons; centered `<StickerChip variant="yellow" tilt="default" flip />` date chip.
- Reaction row at bottom: row of round `StickerCard` reaction buttons. Active reactions show a `<StickerChip variant="pink" />` count badge. Replaces current `ReactionBadge` row styling.
- Caption: rendered as a `<StickerCard tilt="subtle" flip />` above the reaction row.
- All controls use the unified sticker vocabulary.

### Manage Day — `app/story/[albumId]/[date]/manage.tsx`

- Header: ink-bordered back button + "Quản lý ngày" title.
- Grid of photos for the day: each is `<StickerCard tilt="default" flip={i % 2 === 1}>`, photo inside, with `<StickerChip variant="ink" label="✕" />` overlay in top-right for delete.
- Caption editor: full-width `StickerCard` with ink border for the note input.
- Save: `<StickerButton variant="primary" fullWidth />` at bottom.

### Settings — `mobile/app/(tabs)/settings/index.tsx`

- Header: back button (butter `StickerCard`) + "Cài đặt" title in `displayCute` typography.
- Profile card: `<StickerCard tilt="subtle" flip>` containing `<Avatar size={36} src={user.avatar_url} />` + display name + email.
- Section rows: each row is a `StickerCard` with a 22px square icon container background cycling through `accent1 → accent2 → accent3 → accent4` by row index + label + chevron. Replaces current borderless rows from `2026-06-11-settings-rich-design.md`.
- Sign-out button: `<StickerButton variant="danger" fullWidth />`.
- Version string: small text at bottom (unchanged).

### Profile — `mobile/app/(tabs)/settings/profile.tsx`

- Large `<Avatar size={78} src={user.avatar_url} bgColor="primary" withCameraOverlay />` — fallback to mascot if no image set.
- Display name field: small uppercase label + `StickerCard`-bordered input.
- Email field: read-only `StickerCard`-bordered input.
- Save button: `<StickerButton variant="primary" fullWidth />` at bottom.

### Language — `mobile/app/(tabs)/settings/language.tsx`

- Header same as Settings.
- Each language option is a `StickerCard` row with flag emoji + label + `<StickerChip variant="yellow" />` checkmark when active.
- Three options stay: Theo thiết bị / Tiếng Việt / English.

### Members Sheet — `mobile/src/components/family/MembersSheet.tsx`

- Sheet container: `theme.colors.background` with ink-bordered top edges (`border.medium`) and rounded top corners. Drag handle.
- Title: "👥 Thành viên · {album name}" in `displayCute` typography.
- Each member row: `<StickerCard>` containing `<Avatar size={30} src={member.avatar_url} bgColor={cycledAccent} />` + name + status (`<StickerChip variant="yellow" label="CHỦ" />` for owner, X icon for removable members).
- "+ Mời thêm người" at bottom is `<StickerButton variant="primary" fullWidth />`.

### Invite Sheet — `mobile/src/components/family/InviteSheet.tsx`

- Same sheet container.
- Title: "📨 Mời vào album"
- QR code: kept as actual generated QR; wrapped in `<StickerCard surface="default" />`.
- Link row: `StickerCard` with truncated link text + `<StickerChip variant="yellow" label="Sao chép" />` tap target.
- "📤 Chia sẻ link" `<StickerButton variant="primary" fullWidth />` at bottom.

### Album Menu / QR / Settings Sheets

The remaining sheets (`AlbumMenuSheet`, `QRSheet`, `SettingsSheet`) follow the same pattern: butter background, ink-bordered, sticker rows for items. Each list item gets a colored 22px square sticker icon for visual rhythm.

---

## Implementation Order

The redesign should land in dependency order, not screen order. Suggested sequence (each step is independently testable):

1. **Theme system foundation.** Refactor `theme.ts` to export the `Theme` interface, the `stickerWorld` theme object, and the convenience re-exports (see Theme System → Migration above). Add the ESLint/CI check that forbids raw hex outside `theme.ts`. Audit and replace inline color/shadow/rotation literals across the existing codebase. App still looks identical after this step — but all visual values are now reachable from `theme.ts`.
2. **Base sticker components.** Build `Mascot`, `StickerCard`, `StickerChip`, `StickerButton` against `theme.components.*` with unit tests. No screen changes yet.
3. **Home / Albums.** Apply new components to `AlbumsPage`. Highest-impact screen, validates the system end-to-end.
4. **Onboarding flow.** Build `app/onboarding.tsx` + root layout gating + SecureStore key. New users will see it; existing users (token already present) will set `onboarding.seen` on next launch to skip.
5. **Sign-in.** Refresh with new components.
6. **Capture flow** (Camera + Photo Review). High-traffic, makes the daily experience feel new.
7. **Day Grid + Story Viewer + Photo Detail.** The viewing experience.
8. **Settings + Profile + Language.** Lower priority surfaces.
9. **Sheets** (Members, Invite, Album Menu, QR, Settings sheet).

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
