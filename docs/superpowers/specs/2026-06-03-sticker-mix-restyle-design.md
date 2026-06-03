# Sticker Mix Restyle — Design Spec

**Date:** 2026-06-03
**Status:** Approved
**Supersedes (visual layer only):** `2026-06-03-mobile-app-design.md` Design-System section. Navigation, data model, API, push notifications, and feature scope from that doc remain in force.

---

## Goal

Replace the existing "Soft & Dreamy" lavender visual language with a distinctive **"Sticker Mix"** identity across the entire mobile app, add a coherent motion language for a smoother feel, and ship a Vietnamese-first interface.

**Why:** The current lavender palette is visually competent but generic for the baby/family-album category. The user wants the app to feel **cute and different even at MVP**, and the target audience is Vietnamese families.

## Scope

**In scope:**
- Full visual restyle of every existing screen and UI component
- Two-tier design system (Joyful + Quiet) sharing the same tokens
- Motion language (springs, haptics, skeletons, shared-element transition for photo viewer, confetti on celebrations)
- Vietnamese-first localization (i18n with `vi` default, `en` fallback)
- Font loading (Fredoka + Caveat) via `expo-font`

**Out of scope (explicitly deferred):**
- Reactions on photos
- On-this-day / memory cards
- Vietnamese cultural milestone presets (đầy tháng, 100 ngày, etc.)
- Multi-kid / multi-album support
- Any backend changes
- Any new endpoints, new tables, new push notification types
- Auto-sync, in-app camera, video, comments, Android, web

This is a **UI-only** sprint. No backend or feature additions.

---

## Audience & Localization

**Vietnamese-first.** All shipping UI strings are Vietnamese (`vi`). English (`en`) is a fallback for translators and English-speaking testers, not a primary user experience.

- Tab labels: `Nhà · Khoảnh khắc · Gia đình · Tôi`
- Date formats: `Tháng 10 · 14 tháng tuổi` (not "October · 14 months")
- Greetings: `Chào buổi sáng/trưa/chiều/tối, <Tên>`
- All buttons, alerts, errors, empty states in Vietnamese
- Font choices must support full Vietnamese diacritic set — Fredoka and Caveat both do

---

## Design System

### Color tokens (full rewrite of `src/constants/theme.ts → colors`)

```ts
colors = {
  // Base
  cream:        '#FFFBF0',  // app background, surface
  ink:          '#3D2A1F',  // primary text — warm dark brown
  inkSoft:      '#7B5544',  // secondary text
  inkMuted:     '#B5A89C',  // placeholder, captions

  // 5 sticker accents
  pink:         '#FF7AA8',  // brand — CTAs, active state, FAB end
  pinkDeep:     '#E55B8C',  // pressed states
  yellow:       '#FFD66B',  // celebration, badges
  mint:         '#7FD7B5',  // success, accent
  peach:        '#FF8E66',  // accent, FAB start
  sky:          '#7FB7FA',  // link, accent

  // Surface
  white:        '#FFFFFF',  // cards
  border:       '#3D2A1F',  // dashed/sticker borders (1.5-2px)
  borderSoft:   '#F0E6D6',  // hairline dividers (Quiet tier)

  // Functional
  error:        '#E55B8C',  // reuse pinkDeep — no separate red
  success:      '#7FD7B5',  // reuse mint
}
```

The previous lavender tokens (`primary`, `primaryLight`, `primaryPastel`, `surface`, `background`, `gradientStart/End`) are **removed**. All call sites must be migrated.

### Typography

System font replaced with two Google Fonts bundled locally via `expo-font`:

- **Fredoka** — rounded sans, weights 400 / 500 / 600 / 700, full Latin Extended + Vietnamese
- **Caveat** — handwritten script, weights 500 / 600 / 700, full Latin Extended + Vietnamese

```ts
typography = {
  display:     { fontFamily: 'Fredoka_700Bold', fontSize: 28, color: ink },
  heading:     { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: ink },
  title:       { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: ink },
  body:        { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: ink },
  bodySmall:   { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: inkSoft },
  pill:        { fontFamily: 'Fredoka_600SemiBold', fontSize: 11, color: ink, letterSpacing: 0.3 },
  caption:     { fontFamily: 'Fredoka_500Medium', fontSize: 10, color: inkMuted },
  handAccent:  { fontFamily: 'Caveat_600SemiBold', fontSize: 18, color: pink },
  handLarge:   { fontFamily: 'Caveat_700Bold', fontSize: 28, color: pink },
}
```

Caveat is used sparingly: greetings, photo captions, month labels in feed, milestone subtitles, empty-state messages, on celebration screens. **Never** for button labels, settings rows, or anything that needs to be scannable at small sizes.

### Spacing (unchanged)

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48` exported as `xs / sm / md / lg / xl / 2xl / 3xl / 4xl`.

### Radii

```ts
radii = {
  xs:   8,
  sm:   12,
  md:   18,
  lg:   28,
  full: 9999,
  sticker:    [36, 12, 36, 12] as const,  // tuple for borderRadius4-corner
  stickerAlt: [12, 36, 12, 36] as const,
}
```

Sticker shapes alternate per index to give the photo grid its rhythm.

### Shadows

```ts
shadows = {
  // Soft card shadow used in Quiet tier
  card: {
    shadowColor: '#3D2A1F', shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  // Hard "sticker" shadow — no blur, fixed offset, ink color
  sticker: {
    shadowColor: '#3D2A1F', shadowOpacity: 1, shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 }, elevation: 4,
  },
  // FAB lift
  fab: {
    shadowColor: '#FF7AA8', shadowOpacity: 0.45, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
}
```

### Motion tokens (new file `src/lib/motion.ts`)

```ts
import { Easing } from 'react-native-reanimated';

export const motion = {
  spring:       { damping: 14, stiffness: 180 },              // default bouncy
  springTight:  { damping: 18, stiffness: 240 },              // taps
  springLoose:  { damping: 10, stiffness: 140, mass: 1.2 },   // sticker drop-in, sheet rise
  fade:         { duration: 220, easing: Easing.out(Easing.cubic) },
  scaleTap:     { from: 1, to: 0.94 },                         // press scale
  confetti:     { particles: 24, durationMs: 1200 },           // celebrations
};
```

### Haptics (`expo-haptics`)

- `Light` — every primary tap (buttons, tab switch, photo cell)
- `Medium` — destructive cancel, sheet dismiss
- `Success` — photo upload complete, milestone created
- `Warning` — error alerts (network, auth)

Wrapped in `src/lib/haptics.ts` helper so it's one-line and easy to disable for testing.

---

## Two Tiers

The visual system has two density tiers using the same tokens. Pick per screen, never mix within one screen.

| | **Joyful** | **Quiet** |
|---|---|---|
| Used on | Home, Khoảnh khắc, Photo viewer, Sign In, Onboarding-style screens, Family member cards, Invite/QR/Join, Upload sheet, Milestone create/detail | Cài đặt, Family invite section, error states, alert dialogs |
| Background | `cream` + scattered dot motif (4 radial-gradient stickers, opacity 0.5) | `cream`, no motif |
| Cards | `white`, 2px dashed `ink` border, sticker radii, `sticker` shadow | `white`, 12px radius, `borderSoft` hairline, `card` shadow |
| Buttons | `pink` fill + ink border + sticker shadow | Solid `pink` or ghost with hairline border, no sticker shadow |
| Accent colors | All 5 (pink/yellow/mint/peach/sky) freely used | Single `pink` accent only |
| Caveat usage | Common — greetings, captions, month labels, empty states | Rare — section labels only if at all |
| Stars / washi tape / dashed dividers | Yes | No |
| Motion | Bouncy springs, scaleTap, confetti on celebration | Standard ease-out, no celebration |

---

## Screen-by-screen plan

All paths relative to `mobile/`.

### Tab bar + FAB · `app/(tabs)/_layout.tsx` — Joyful

- Tab bar: `white` bg, `border: { top, 2, solid, ink }`, label = `pill` token, active tint `pink`, inactive `inkMuted`
- Tab labels: `Nhà`, `Khoảnh khắc`, (FAB), `Gia đình`, `Tôi`
- FAB: 54×54 circle, linear-gradient `peach → pink`, white 4px ring, `sticker` shadow, sits `-12px` above bar
- FAB tap: `scaleTap` + haptic `Light` → opens Upload sheet with `springLoose` slide-up

### Sign In · `app/(auth)/index.tsx` — Joyful

- Replace lavender gradient bg with `cream` + scattered sticker dots
- 6 sticker dots gently float (Reanimated `withRepeat` + `withTiming` Y translation, 8s loop, opacity 0.5)
- 👶 logo (72px) + Fredoka 700 32px ink "Family Guy"
- Caveat 18px pink tagline: "lưu giữ từng khoảnh khắc bé yêu"
- Apple button: keep `AppleAuthenticationButton`, `cornerRadius={22}`
- Google button: ghost variant, 2px dashed ink border, sticker shadow, "Đăng nhập với Google"
- Privacy: `bodySmall` inkSoft, center, "Bằng việc đăng nhập, bạn đồng ý với Chính sách bảo mật."

### Home / Timeline · `app/(tabs)/index.tsx`, `src/components/timeline/*` — Joyful

- Drop `HeaderGradient`, use new `JoyfulHeader` (cream + dot motif)
- Greeting `handAccent` "Chào buổi sáng, Linh ✦"
- Album name `heading` ink + ✦ accent
- Badge row: 3 pills (yellow = `14 tháng`, mint = `3 thành viên`, peach = `216 ảnh`), all with dashed ink border
- Avatar row: 28px avatars with white 2px ring + sticker shadow
- `MonthHeader`: replace uppercase tracking with `handAccent` size 20 pink "~ Tháng 10 · 14 tháng tuổi ~"
- `PhotoRow`: switch to **2-col asymmetric sticker tiles** (no 3-col variant); alternate radii per index between `sticker` and `stickerAlt`; 3px white border; sticker shadow
- `PhotoCell`: optional Caveat caption beneath tile when `caption` is present
- Pull-to-refresh: tint `pink`, "spinner" is a bouncing sticker dot (custom component)
- Empty: 🌸 (72px) + `handLarge` "chưa có ảnh nào ~ thêm khoảnh khắc đầu tiên nhé!"
- Loading: `SkeletonRow` placeholders (sticker-shape, cream↔borderSoft pulse)
- Tap photo cell: capture source rect, transition to photo viewer using shared-element pattern (see Photo Viewer section)

### Photo viewer · `app/photo/[id].tsx` — Joyful

- Background: `#1A1A1A` (kept dark)
- Top header bar (blur backdrop, rgba black 0.3): close `×` in 34px white-opacity circle (left), photo position "3 / 27 · 12 Th10" in white `bodySmall` (center), more `⋯` (right)
- Caption (above tab bar): `handAccent` white, center, drop-shadow
- **Entry transition:** shared element. On press in Home, capture cell rect; on viewer mount, render an animated `Image` interpolating from source rect → full-screen rect using Reanimated 3 `useSharedValue` + `useAnimatedStyle`. Use `motion.fade` for 220ms. Document the pattern in `src/lib/sharedElement.ts`.
- Swipe left/right between photos: `spring` transition with edge resistance
- Pinch-to-zoom: existing, plus haptic `Light` once on max zoom reached
- Dismiss (close or swipe down): reverse shared-element transition back to source cell

### Khoảnh khắc / Milestones list · `app/(tabs)/milestones.tsx` — Joyful

- `JoyfulHeader` with Caveat eyebrow "~ những khoảnh khắc đáng nhớ ~" + heading "Khoảnh khắc 🌟"
- Replace `MilestoneCard` design:
  - White card, sticker shadow, 1.5px dashed ink border
  - **Left accent strip** 6px wide, full card height, alternating color per index (pink → yellow → mint → peach → sky → repeat)
  - Title: `title` ink
  - Note preview: Caveat 16 `inkSoft` (handwritten feel — override the default `pink` from `handAccent` token)
  - Date: `caption` inkMuted
- Empty: 🌟 (72px) + `handLarge` "chưa có mốc nào ~ ghi lại khoảnh khắc đầu tiên ✦"
- FAB (on-screen, not tab bar): same gradient + sticker shadow

### Milestone detail · `app/milestone/[id].tsx` — Joyful

- Cover photo: sticker tile shape, 3px white border, sticker shadow, full-bleed top
- Title `display` ink
- Date `handAccent` pink
- Note body: `body` ink, line-height 1.6, max-width readable
- Back button: 34px white circle, ink border, sticker shadow (top-left, safe area)

### Create milestone · `app/milestone/new.tsx` — Joyful (sheet)

- Sheet handle: 42×5 `inkMuted` pill
- Eyebrow `handAccent` "~ thêm khoảnh khắc ~", title `heading` "Mốc đáng nhớ"
- Inputs: `TextInput` with 2px dashed ink border, focused = solid `pink`, radius 18px
- Date picker: native, wrapped in a styled trigger chip showing date in Caveat
- Cover photo picker: horizontal scroll of sticker-shape thumbnails (24px gap)
- Save button: solid pink, ink border, sticker shadow, "Lưu mốc ✦"
- Slide-up = `springLoose`

### Upload sheet · `src/components/upload/UploadSheet.tsx` — Joyful

- Same sheet style as create-milestone
- Header `handAccent` "~ thêm ảnh ~", title `heading` "Ảnh mới"
- `PhotoThumbnailGrid`: 4-per-row sticker-shape thumbs; checkmark overlay = yellow sticker stamp with ✓ in ink, sticker shadow
- Caption input: dashed border, Caveat placeholder "ghi chú nhỏ cho ảnh..."
- Progress bar: ink track, `pink` fill, label below in Caveat "đang nén... · đang tải lên 3/12..."
- On complete: brief `Confetti` burst (24 particles) + haptic `Success`, then sheet auto-dismisses

### Gia đình / Family · `app/(tabs)/family.tsx` — Joyful list, Quiet invite section

- Header (Joyful): `handAccent` eyebrow + heading "Gia đình 👨‍👩‍👧"
- Member list (Joyful):
  - Horizontal sticker card per member: avatar (40px white-ring + sticker shadow) + name `title` + role badge (yellow pill "Chủ album" / mint pill "Thành viên") + Caveat "tham gia ngày 3 Th10"
- "Mời gia đình" section (Quiet):
  - Plain white card, 12px radius, hairline divider, label `title` ink "Mời gia đình"
  - Two pill buttons: solid pink "Sao chép link mời" + ghost dashed "Quét mã QR"

### Invite sheet · `src/components/family/InviteSheet.tsx` — Joyful

- Handle + `handAccent` "~ mời ai đó tham gia ~"
- Sticker card with link in monospace + copy icon (mint accent on copy), tap-to-copy with haptic `Success`
- "Hết hạn sau 7 ngày" `handAccent` inkSoft below

### QR sheet · `src/components/family/QRSheet.tsx` — Joyful

- Handle + `handAccent` "quét mã này nhé ✦"
- QR in white sticker card, 3px dashed ink border, sticker shadow
- "Mã hợp lệ trong 5 phút" Caveat

### Join · `app/join/[token].tsx` — Joyful

- Cream + dot motif background
- 🎉 (72px) + `handLarge` "Bạn được mời tham gia ~"
- Album name `display` ink
- Member count `handAccent` "3 thành viên · 216 ảnh"
- "Tham gia album" solid pink sticker button

### Cài đặt / Settings · `app/(tabs)/settings.tsx` — Quiet

- `QuietHeader`: cream bg, hairline divider, no decoration
- Title `heading` ink "Cài đặt" (no emoji)
- Profile card: plain white, 12px radius, hairline divider, avatar (no sticker shadow — quiet tier) + name `title` + email `bodySmall` inkSoft
- Setting row: plain white card, label `body` ink, Switch `trackColor: { true: pink }`
- Sign Out: pink ghost button with dashed ink border (friendlier than red), `body` "Đăng xuất"
- Bottom hint: `caption` inkMuted "Phiên bản 0.1.0"
- All alerts (notif permission, errors): use native `Alert` for now — restyling alerts is out of scope

---

## Component changes

All in `src/components/ui/` unless noted.

| Component | Change |
|---|---|
| `Button` | Add `tier: 'joyful' \| 'quiet'` (default joyful). Joyful: ink border 1.5px + sticker shadow + accent fill. Quiet: solid pink or ghost with hairline border, no sticker shadow. Both use Fredoka 600 14px. Add haptic `Light` on press. |
| `Card` | Add `tier`. Joyful: dashed 1.5px ink + sticker shadow + cream/white. Quiet: hairline borderSoft + card shadow + 12px radius. |
| `Badge` | Add `color: 'pink' \| 'yellow' \| 'mint' \| 'peach' \| 'sky'` (default pink). All have dashed ink border, `pill` font. |
| `Avatar` | Add optional `ring: boolean` (white 2px) and `shadow: boolean` (sticker). |
| `TextInput` | Dashed ink border at rest, solid pink on focus. Support optional `caveatPlaceholder: boolean`. |
| `MilestoneCard` | Left accent strip 6px (color from index), dashed border, sticker shadow, title + Caveat note + date. |
| `PhotoCell` | Alternating sticker radii per `index` prop (0,2,4... = sticker; 1,3,5... = stickerAlt). 3px white border, sticker shadow. Optional caption beneath tile in `handAccent`. |
| `SectionHeader` | Replace uppercase tracked label with `handAccent` 20 pink, optional `~` prefix. |
| `HeaderGradient` | **Delete.** All call sites switch to `JoyfulHeader` or `QuietHeader`. |
| `EmptyState` | 72px emoji + `handLarge` message. Subtle float animation (translateY `withRepeat`). |
| `LoadingSpinner` | **Delete.** Replaced by skeleton components. |
| **(new)** `JoyfulHeader` | Cream bg with dot motif radial-gradient. Renders children inline. |
| **(new)** `QuietHeader` | Cream bg, hairline bottom divider. Renders children inline. |
| **(new)** `Confetti` | Reanimated 3 particle burst — 24 small sticker-shape particles emanate from a given x,y with gravity. Used on upload complete. |
| **(new)** `SkeletonTile`, `SkeletonRow`, `SkeletonCard` | Sticker-shape pulse loaders. Pulse via `withRepeat(withTiming(...))` between cream and borderSoft. |
| **(new)** `Sticker` | Generic wrapper applying ink border + sticker shadow + optional rotation prop. Used by checkmark overlay on upload thumbnails and any future ad-hoc sticker affordance. FAB and badges apply shadows directly. |
| **(new)** `BouncingDot` | Pull-to-refresh indicator. |
| **(new)** `StickerButton` | Convenience wrapper around Button with required ink border + shadow + scaleTap. (Or just default Button's joyful tier to this — implementer's call.) |

---

## Tokens file rewrite

`src/constants/theme.ts` is fully rewritten:
- `colors` replaced per Section above
- `radii` adds `sticker` and `stickerAlt` tuples
- `shadows` rewritten with `card`, `sticker`, `fab`
- `typography` rewritten with Fredoka + Caveat references and the 9 tokens listed
- `spacing` unchanged

`src/lib/motion.ts` is new and exports the `motion` object.

`src/lib/haptics.ts` is new and wraps `expo-haptics` calls.

`src/lib/sharedElement.ts` is new and provides a helper hook for the photo-cell → photo-viewer transition.

---

## Internationalization

New files:
- `src/lib/i18n.ts` — i18n-js setup, default locale `vi`, fallback `en`
- `src/locales/vi.ts` — primary translation file
- `src/locales/en.ts` — fallback (can be sparse)

Dependencies:
- `i18n-js`
- `expo-localization`

All hard-coded UI strings move to translation keys. Examples:
- `home.greeting.morning` → "Chào buổi sáng"
- `home.album_default` → "Album của bé"
- `tabs.home` → "Nhà"
- `tabs.moments` → "Khoảnh khắc"
- `tabs.family` → "Gia đình"
- `tabs.me` → "Tôi"
- `settings.signout` → "Đăng xuất"
- `upload.uploading` → "Đang tải lên"
- `errors.network` → "Lỗi kết nối mạng"

Date formatting: use `Intl.DateTimeFormat('vi-VN', ...)` with `month: 'short'` → "Th10". Custom helper `formatVnMonth(date) → "Tháng 10"` and `formatVnDate(date) → "12 Th10"`.

Age formatting: `formatVnAge(birthdate) → "14 tháng tuổi"` / `"2 tuổi"`.

Greeting selection by hour: 5-11 = sáng, 11-13 = trưa, 13-18 = chiều, 18-22 = tối, 22-5 = khuya.

---

## Font loading

```ts
// app/_layout.tsx
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';

const [fontsLoaded] = useFonts({
  Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold,
  Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold,
});
```

Wait for fonts before hiding splash. Both packages are tree-shakable and include Vietnamese diacritic subsets.

---

## Tests

Restyling work is mostly presentational, but the following must still pass before merge:

- All existing backend tests (`backend/tests/`) — untouched
- All existing mobile snapshot/unit tests in `mobile/__tests__/` re-recorded with new visuals
- New tests:
  - `i18n.test.ts` — `formatVnMonth`, `formatVnDate`, `formatVnAge`, hour-based greeting selector
  - `motion.test.ts` — verifies motion preset object shape (just import + assertion)
  - Render snapshot for `JoyfulHeader`, `QuietHeader`, `SkeletonTile`, `Confetti` (smoke)

Manual verification (per `AGENTS.md` "Expo HAS CHANGED" — verify against [Expo SDK 56 docs](https://docs.expo.dev/versions/v56.0.0/) for any API changes):
- Cold start with Vietnamese system locale → all strings Vietnamese
- Tap each screen via tab bar → no lavender visible anywhere
- Upload a photo → confetti fires, haptic Success felt
- Open photo viewer from Home → shared-element transition smooth at 60fps
- Settings → quiet tier visible, no decorations leaking from Joyful

---

## Risks & mitigations

- **Shared-element transition complexity** — `react-native-shared-element` is unmaintained; the manual Reanimated 3 approach has more rope. **Mitigation:** prototype the photo-cell → viewer transition first as a spike; if it slips past 1 day, ship a simple cross-fade and revisit.
- **Caveat readability at small sizes** — Vietnamese diacritics on a script font can crowd. **Mitigation:** never use Caveat below 14px; always pair with `lineHeight: 1.4+`; review against the full diacritic set during dev.
- **Custom font Vietnamese coverage** — Fredoka and Caveat Google Fonts include `vietnamese` subsets, but verify at integration time by rendering: `à á ả ã ạ ằ ắ ẳ ẵ ặ â ầ ấ ẩ ẫ ậ è é ẻ ẽ ẹ ê ề ế ể ễ ệ ì í ỉ ĩ ị ò ó ỏ õ ọ ô ồ ố ổ ỗ ộ ơ ờ ớ ở ỡ ợ ù ú ủ ũ ụ ư ừ ứ ử ữ ự ỳ ý ỷ ỹ ỵ đ Đ`.
- **Two-tier discipline drift** — once Joyful patterns are widely used, contributors will reach for them on Quiet screens. **Mitigation:** linter-level grep in CI for `shadows.sticker` inside `app/(tabs)/settings.tsx` (and similar).
- **i18n string regression** — moving every string risks misses. **Mitigation:** add a CI grep for common Vietnamese-untranslated English words ("Loading", "Home", "Settings") in `app/` and `src/components/`.

---

## File-level summary

**Modified:**
- `mobile/src/constants/theme.ts` — full rewrite
- `mobile/app/_layout.tsx` — add font loading
- `mobile/app/(auth)/index.tsx` — Sticker Mix sign-in
- `mobile/app/(tabs)/_layout.tsx` — new tab bar + FAB style
- `mobile/app/(tabs)/index.tsx` — JoyfulHeader, new badge row, Vietnamese copy
- `mobile/app/(tabs)/milestones.tsx` — JoyfulHeader, new MilestoneCard
- `mobile/app/(tabs)/family.tsx` — mixed Joyful list + Quiet invite section
- `mobile/app/(tabs)/settings.tsx` — full Quiet tier rewrite
- `mobile/app/photo/[id].tsx` — Joyful header, shared-element transition
- `mobile/app/milestone/new.tsx` — Joyful sheet
- `mobile/app/milestone/[id].tsx` — Joyful detail
- `mobile/app/join/[token].tsx` — Joyful join
- `mobile/src/components/timeline/TimelineFeed.tsx` — switch to 2-col asymmetric sticker tiles, skeletons
- `mobile/src/components/timeline/MonthHeader.tsx` — Caveat label
- `mobile/src/components/timeline/PhotoRow.tsx` — alternating sticker radii
- `mobile/src/components/upload/UploadSheet.tsx` — Joyful sheet + confetti on complete
- `mobile/src/components/upload/PhotoThumbnailGrid.tsx` — sticker-shape thumbs
- `mobile/src/components/family/MemberList.tsx` — sticker member cards
- `mobile/src/components/family/InviteSheet.tsx` — Joyful sheet
- `mobile/src/components/family/QRSheet.tsx` — Joyful sheet
- `mobile/src/components/ui/Button.tsx` — add `tier` prop, haptics
- `mobile/src/components/ui/Card.tsx` — add `tier` prop
- `mobile/src/components/ui/Badge.tsx` — add `color` prop
- `mobile/src/components/ui/Avatar.tsx` — add `ring`, `shadow` props
- `mobile/src/components/ui/TextInput.tsx` — dashed border, Caveat placeholder
- `mobile/src/components/ui/MilestoneCard.tsx` — new accent strip + Caveat
- `mobile/src/components/ui/PhotoCell.tsx` — alternating sticker radii + caption
- `mobile/src/components/ui/SectionHeader.tsx` — Caveat label
- `mobile/src/components/ui/EmptyState.tsx` — handLarge + float animation
- `mobile/package.json` — add deps (see below)

**New:**
- `mobile/src/lib/motion.ts`
- `mobile/src/lib/haptics.ts`
- `mobile/src/lib/sharedElement.ts`
- `mobile/src/lib/i18n.ts`
- `mobile/src/locales/vi.ts`
- `mobile/src/locales/en.ts`
- `mobile/src/components/ui/JoyfulHeader.tsx`
- `mobile/src/components/ui/QuietHeader.tsx`
- `mobile/src/components/ui/SkeletonTile.tsx`
- `mobile/src/components/ui/SkeletonRow.tsx`
- `mobile/src/components/ui/SkeletonCard.tsx`
- `mobile/src/components/ui/Confetti.tsx`
- `mobile/src/components/ui/Sticker.tsx`
- `mobile/src/components/ui/BouncingDot.tsx`

**Deleted:**
- `mobile/src/components/ui/HeaderGradient.tsx`
- `mobile/src/components/ui/LoadingSpinner.tsx`

**Dependencies to add:**
- `@expo-google-fonts/fredoka`
- `@expo-google-fonts/caveat`
- `expo-font` (likely already in)
- `expo-haptics`
- `i18n-js`
- `expo-localization`
- `react-native-reanimated` (already in via Expo SDK 56 base)

**Dependencies to remove:**
- `expo-linear-gradient` — verify after restyle is complete; FAB still uses gradient so it likely stays

---

## Acceptance criteria

- Zero references to the old lavender hex codes (`#7C5CBF`, `#A78BF0`, `#C9B8F5`, etc.) anywhere in `mobile/` source
- Zero references to `HeaderGradient` or `LoadingSpinner` (deleted)
- Every screen renders correctly with `vi` locale; English fallback works when device locale is `en`
- Fredoka and Caveat render Vietnamese diacritics correctly (manual visual check against the diacritic set in Risks section)
- Upload flow shows confetti on success
- Photo viewer entry transition does not drop frames on a mid-tier iPhone (test on iPhone 12 or equivalent)
- Pull-to-refresh shows bouncing dot, not lavender spinner
- Settings screen has zero sticker shadows, dashed borders, or multi-color accents
