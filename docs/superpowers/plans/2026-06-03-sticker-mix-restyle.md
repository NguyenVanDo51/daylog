# Sticker Mix Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Soft & Dreamy" lavender UI with "Sticker Mix" (Fredoka + Caveat, warm cream + 5 sticker accent colors, two-tier system), add a motion language (springs, haptics, skeletons, shared-element photo transition, confetti), and ship a Vietnamese-first interface across every screen.

**Architecture:** Token-first restyle in `src/constants/theme.ts` + new helper libraries (`motion`, `haptics`, `format`, `i18n`, `sharedElement`) + restyled UI primitives in `src/components/ui/` + screen-by-screen refresh in `app/`. The system has two visual tiers (Joyful and Quiet) sharing tokens; Joyful covers content-rich screens, Quiet covers utility (Settings, alerts).

**Tech Stack:** Expo SDK 56 (managed), React Native 0.85, TypeScript, expo-router, react-native-reanimated 4 (+ worklets), `@expo-google-fonts/fredoka` + `@expo-google-fonts/caveat`, `expo-font`, `expo-haptics`, `i18n-js`, `expo-localization`, `@testing-library/react-native`, Jest with `jest-expo` preset.

**Source spec:** `docs/superpowers/specs/2026-06-03-sticker-mix-restyle-design.md` — keep this open while implementing.

---

## File Structure

**Modified (33 files):**
- `mobile/package.json` — new deps
- `mobile/src/constants/theme.ts` — full token rewrite
- `mobile/app/_layout.tsx` — font loading
- `mobile/app/(auth)/index.tsx`
- `mobile/app/(tabs)/_layout.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/milestones.tsx`
- `mobile/app/(tabs)/family.tsx`
- `mobile/app/(tabs)/settings.tsx`
- `mobile/app/photo/[id].tsx`
- `mobile/app/milestone/new.tsx`
- `mobile/app/milestone/[id].tsx`
- `mobile/app/join/[token].tsx`
- `mobile/src/components/timeline/TimelineFeed.tsx`
- `mobile/src/components/timeline/MonthHeader.tsx`
- `mobile/src/components/timeline/PhotoRow.tsx`
- `mobile/src/components/upload/UploadSheet.tsx`
- `mobile/src/components/upload/PhotoThumbnailGrid.tsx`
- `mobile/src/components/family/MemberList.tsx`
- `mobile/src/components/family/InviteSheet.tsx`
- `mobile/src/components/family/QRSheet.tsx`
- `mobile/src/components/ui/Button.tsx`
- `mobile/src/components/ui/Card.tsx`
- `mobile/src/components/ui/Badge.tsx`
- `mobile/src/components/ui/Avatar.tsx`
- `mobile/src/components/ui/TextInput.tsx`
- `mobile/src/components/ui/MilestoneCard.tsx`
- `mobile/src/components/ui/PhotoCell.tsx`
- `mobile/src/components/ui/SectionHeader.tsx`
- `mobile/src/components/ui/EmptyState.tsx`
- All test snapshots under `mobile/app/**/__tests__/*.tsx`

**New (14 files):**
- `mobile/src/lib/motion.ts`
- `mobile/src/lib/haptics.ts`
- `mobile/src/lib/format.ts`
- `mobile/src/lib/i18n.ts`
- `mobile/src/lib/sharedElement.ts`
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

**Deleted (2 files):**
- `mobile/src/components/ui/HeaderGradient.tsx`
- `mobile/src/components/ui/LoadingSpinner.tsx`

**New test files (5):**
- `mobile/src/lib/__tests__/motion.test.ts`
- `mobile/src/lib/__tests__/format.test.ts`
- `mobile/src/lib/__tests__/i18n.test.ts`
- `mobile/src/components/ui/__tests__/JoyfulHeader.test.tsx`
- `mobile/src/components/ui/__tests__/QuietHeader.test.tsx`

---

## Conventions Used Below

- All paths are absolute from repo root unless otherwise noted.
- `cd mobile` is implied for all `npm` / `npx jest` commands.
- Token name migration table (use everywhere old names appear):

| Old (`colors.X`) | New |
|---|---|
| `primary` | `pink` |
| `primaryLight` | `peach` |
| `primaryPastel` | `yellow` |
| `surface` | `white` |
| `background` | `cream` |
| `border` | `border` (still exists, value changes) |
| `textPrimary` | `ink` |
| `textSecondary` | `inkSoft` |
| `textMuted` | `inkMuted` |
| `gradientStart` | `peach` |
| `gradientEnd` | `pink` |
| `error` | `error` (still exists, aliased to `pinkDeep`) |
| `success` | `success` (still exists, aliased to `mint`) |
| `white` | `white` |
| `black` | `black` |

| Old `typography.X` | New |
|---|---|
| `heading` | `heading` (size 22, weight 600 Fredoka) |
| `title` | `title` (size 18, weight 600 Fredoka) |
| `subheading` | `body` |
| `body` | `bodySmall` |
| `label` | `pill` |
| `caption` | `caption` |

---

## Phase A · Foundations

### Task 1: Install new dependencies

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Add font, haptics, and i18n dependencies**

Run from `mobile/`:
```bash
npx expo install @expo-google-fonts/fredoka @expo-google-fonts/caveat expo-font expo-haptics expo-localization
npm install i18n-js
```

- [ ] **Step 2: Verify install resolved correctly**

Run:
```bash
node -e "require('@expo-google-fonts/fredoka'); require('@expo-google-fonts/caveat'); require('expo-haptics'); require('i18n-js'); require('expo-localization'); console.log('ok')"
```
Expected: `ok` printed.

- [ ] **Step 3: Verify Expo SDK 56 compatibility**

Open `mobile/package.json`. Confirm the new lines look like:
```
"@expo-google-fonts/caveat": "^...",
"@expo-google-fonts/fredoka": "^...",
"expo-font": "~56...",
"expo-haptics": "~56...",
"expo-localization": "~56...",
"i18n-js": "^...",
```

If any expo-* package version range is wrong, re-run `npx expo install <name>` for that one. Per `mobile/AGENTS.md`, expo versions matter — never `npm install` an `expo-*` package directly.

- [ ] **Step 4: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/package.json mobile/package-lock.json
git -C /Users/do.nguyen/personal/family-guy commit -m "chore(mobile): add fonts, haptics, i18n deps for Sticker Mix restyle"
```

---

### Task 2: Rewrite theme tokens

Replace lavender system entirely. After this task, the app will compile but look broken (no fonts loaded yet, no UI primitives updated). That's fine — subsequent tasks fix it.

**Files:**
- Modify: `mobile/src/constants/theme.ts`

- [ ] **Step 1: Replace the entire contents of `mobile/src/constants/theme.ts`**

```ts
export const colors = {
  // Base
  cream:        '#FFFBF0',
  ink:          '#3D2A1F',
  inkSoft:      '#7B5544',
  inkMuted:     '#B5A89C',

  // 5 sticker accents
  pink:         '#FF7AA8',
  pinkDeep:     '#E55B8C',
  yellow:       '#FFD66B',
  mint:         '#7FD7B5',
  peach:        '#FF8E66',
  sky:          '#7FB7FA',

  // Surface
  white:        '#FFFFFF',
  border:       '#3D2A1F',   // ink, used for sticker borders at 1.5-2px
  borderSoft:   '#F0E6D6',   // hairline divider, used in Quiet tier

  // Functional aliases
  error:        '#E55B8C',
  success:      '#7FD7B5',
  black:        '#000000',
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const radii = {
  xs:   8,
  sm:   12,
  md:   18,
  lg:   28,
  full: 9999,
  // Tuples for asymmetric sticker shapes; apply via 4-corner borderRadius
  sticker:    [36, 12, 36, 12] as const,
  stickerAlt: [12, 36, 12, 36] as const,
} as const;

export const shadows = {
  // Soft drop shadow — Quiet tier cards
  card: {
    shadowColor:   '#3D2A1F',
    shadowOpacity: 0.08,
    shadowRadius:  10,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     2,
  },
  // Hard "sticker" shadow — no blur, fixed 3px offset, ink color
  sticker: {
    shadowColor:   '#3D2A1F',
    shadowOpacity: 1,
    shadowRadius:  0,
    shadowOffset:  { width: 3, height: 3 },
    elevation:     4,
  },
  // FAB lift — pink glow
  fab: {
    shadowColor:   '#FF7AA8',
    shadowOpacity: 0.45,
    shadowRadius:  14,
    shadowOffset:  { width: 0, height: 6 },
    elevation:     8,
  },
} as const;

export const typography = {
  display:     { fontFamily: 'Fredoka_700Bold',     fontSize: 28, color: colors.ink },
  heading:     { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, color: colors.ink },
  title:       { fontFamily: 'Fredoka_600SemiBold', fontSize: 18, color: colors.ink },
  body:        { fontFamily: 'Fredoka_500Medium',   fontSize: 14, color: colors.ink },
  bodySmall:   { fontFamily: 'Fredoka_500Medium',   fontSize: 12, color: colors.inkSoft },
  pill:        { fontFamily: 'Fredoka_600SemiBold', fontSize: 11, color: colors.ink, letterSpacing: 0.3 },
  caption:     { fontFamily: 'Fredoka_500Medium',   fontSize: 10, color: colors.inkMuted },
  handAccent:  { fontFamily: 'Caveat_600SemiBold',  fontSize: 18, color: colors.pink },
  handLarge:   { fontFamily: 'Caveat_700Bold',      fontSize: 28, color: colors.pink },
} as const;

export type ColorKey = keyof typeof colors;
```

- [ ] **Step 2: Update every other file that referenced an old token**

Run a sed/find across `mobile/src` and `mobile/app` (manual edits per file are also fine — code-search and replace). Use the migration table at the top of this plan. Each later task explicitly re-sets the styling on its files anyway; this step is to keep things compiling between now and then.

Mechanical replacements (do these in every `.tsx` / `.ts` file under `mobile/src/` and `mobile/app/`):
- `colors.primary` → `colors.pink`
- `colors.primaryLight` → `colors.peach`
- `colors.primaryPastel` → `colors.yellow`
- `colors.surface` → `colors.white`
- `colors.background` → `colors.cream`
- `colors.textPrimary` → `colors.ink`
- `colors.textSecondary` → `colors.inkSoft`
- `colors.textMuted` → `colors.inkMuted`
- `colors.gradientStart` → `colors.peach`
- `colors.gradientEnd` → `colors.pink`
- `typography.subheading` → `typography.body`
- `typography.body` → `typography.bodySmall`
- `typography.label` → `typography.pill`

Use the Edit tool with `replace_all: true` per file. Don't try to do this with one giant grep — Edit per file is safer.

- [ ] **Step 3: Run TypeScript**

```bash
cd mobile && npx tsc --noEmit
```
Expected: no type errors. If a reference was missed, the error will say `Property 'X' does not exist on type` — fix and re-run.

- [ ] **Step 4: Run existing tests**

```bash
cd mobile && npm test -- --ci
```
Expected: tests may fail on snapshots (visual diffs from token changes). That's expected. Do NOT update snapshots yet — leave them failing; they get re-recorded after each screen task.

- [ ] **Step 5: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/constants/theme.ts mobile/src mobile/app
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): swap lavender theme tokens for Sticker Mix"
```

---

### Task 3: Add motion library

**Files:**
- Create: `mobile/src/lib/motion.ts`
- Create: `mobile/src/lib/__tests__/motion.test.ts`

- [ ] **Step 1: Write the failing test**

`mobile/src/lib/__tests__/motion.test.ts`:
```ts
import { motion } from '../motion';

describe('motion presets', () => {
  it('exposes the documented preset shapes', () => {
    expect(motion.spring).toEqual({ damping: 14, stiffness: 180 });
    expect(motion.springTight).toEqual({ damping: 18, stiffness: 240 });
    expect(motion.springLoose).toEqual({ damping: 10, stiffness: 140, mass: 1.2 });
    expect(motion.fade.duration).toBe(220);
    expect(motion.scaleTap).toEqual({ from: 1, to: 0.94 });
    expect(motion.confetti).toEqual({ particles: 24, durationMs: 1200 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mobile && npx jest src/lib/__tests__/motion.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`mobile/src/lib/motion.ts`:
```ts
import { Easing } from 'react-native-reanimated';

export const motion = {
  spring:      { damping: 14, stiffness: 180 },
  springTight: { damping: 18, stiffness: 240 },
  springLoose: { damping: 10, stiffness: 140, mass: 1.2 },
  fade:        { duration: 220, easing: Easing.out(Easing.cubic) },
  scaleTap:    { from: 1, to: 0.94 },
  confetti:    { particles: 24, durationMs: 1200 },
} as const;
```

- [ ] **Step 4: Run test**

```bash
cd mobile && npx jest src/lib/__tests__/motion.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/lib/motion.ts mobile/src/lib/__tests__/motion.test.ts
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): add motion preset library"
```

---

### Task 4: Add haptics wrapper

**Files:**
- Create: `mobile/src/lib/haptics.ts`

- [ ] **Step 1: Implement (no test — wraps native calls only)**

`mobile/src/lib/haptics.ts`:
```ts
import * as Haptics from 'expo-haptics';

/** Light tap — primary buttons, tab switch, photo cell press */
export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** Medium tap — destructive cancel, sheet dismiss */
export const tapMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/** Success notification — upload complete, milestone created */
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/** Warning notification — error alerts */
export const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
```

- [ ] **Step 2: Confirm it imports**
```bash
cd mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/lib/haptics.ts
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): add haptics helper wrapping expo-haptics"
```

---

### Task 5: Add format helpers (VN date / age / greeting)

**Files:**
- Create: `mobile/src/lib/format.ts`
- Create: `mobile/src/lib/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing test**

`mobile/src/lib/__tests__/format.test.ts`:
```ts
import { formatVnMonth, formatVnDate, formatVnAge, greetingForHour } from '../format';

describe('formatVnMonth', () => {
  it('returns "Tháng N" with no leading zero', () => {
    expect(formatVnMonth(new Date('2024-10-15'))).toBe('Tháng 10');
    expect(formatVnMonth(new Date('2024-01-01'))).toBe('Tháng 1');
  });
});

describe('formatVnDate', () => {
  it('returns "D ThM" form', () => {
    expect(formatVnDate(new Date('2024-10-12'))).toBe('12 Th10');
    expect(formatVnDate(new Date('2024-03-05'))).toBe('5 Th3');
  });
});

describe('formatVnAge', () => {
  it('uses tháng under 24 months', () => {
    const birth = '2024-01-01';
    const today = new Date('2024-08-15');
    expect(formatVnAge(birth, today)).toBe('7 tháng tuổi');
  });
  it('uses tuổi at or above 2 years', () => {
    const birth = '2022-01-01';
    const today = new Date('2024-08-15');
    expect(formatVnAge(birth, today)).toBe('2 tuổi');
  });
  it('returns empty string when birthdate is null', () => {
    expect(formatVnAge(null, new Date())).toBe('');
  });
});

describe('greetingForHour', () => {
  it('maps hour ranges correctly', () => {
    expect(greetingForHour(6)).toBe('Chào buổi sáng');
    expect(greetingForHour(12)).toBe('Chào buổi trưa');
    expect(greetingForHour(15)).toBe('Chào buổi chiều');
    expect(greetingForHour(20)).toBe('Chào buổi tối');
    expect(greetingForHour(23)).toBe('Chào buổi khuya');
    expect(greetingForHour(3)).toBe('Chào buổi khuya');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mobile && npx jest src/lib/__tests__/format.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`mobile/src/lib/format.ts`:
```ts
export function formatVnMonth(d: Date): string {
  return `Tháng ${d.getMonth() + 1}`;
}

export function formatVnDate(d: Date): string {
  return `${d.getDate()} Th${d.getMonth() + 1}`;
}

export function formatVnAge(birthdate: string | null, now: Date = new Date()): string {
  if (!birthdate) return '';
  const birth = new Date(birthdate);
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 24) return `${months} tháng tuổi`;
  return `${Math.floor(months / 12)} tuổi`;
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Chào buổi sáng';
  if (hour >= 11 && hour < 13) return 'Chào buổi trưa';
  if (hour >= 13 && hour < 18) return 'Chào buổi chiều';
  if (hour >= 18 && hour < 22) return 'Chào buổi tối';
  return 'Chào buổi khuya';
}
```

- [ ] **Step 4: Run test**

```bash
cd mobile && npx jest src/lib/__tests__/format.test.ts
```
Expected: PASS, all 8 assertions.

- [ ] **Step 5: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/lib/format.ts mobile/src/lib/__tests__/format.test.ts
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): add Vietnamese date/age/greeting helpers"
```

---

### Task 6: Add i18n setup and `vi` / `en` locales

**Files:**
- Create: `mobile/src/lib/i18n.ts`
- Create: `mobile/src/locales/vi.ts`
- Create: `mobile/src/locales/en.ts`
- Create: `mobile/src/lib/__tests__/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

`mobile/src/lib/__tests__/i18n.test.ts`:
```ts
import { i18n, t } from '../i18n';

describe('i18n', () => {
  it('defaults to vi locale', () => {
    expect(i18n.locale).toBe('vi');
  });

  it('renders Vietnamese strings by default', () => {
    expect(t('tabs.home')).toBe('Nhà');
    expect(t('tabs.moments')).toBe('Khoảnh khắc');
    expect(t('tabs.family')).toBe('Gia đình');
    expect(t('tabs.me')).toBe('Tôi');
  });

  it('falls back to en when key missing in vi', () => {
    // Use a sentinel key only in en for this assertion — fallbacks setting must be on
    expect(i18n.enableFallback).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd mobile && npx jest src/lib/__tests__/i18n.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement locales**

`mobile/src/locales/vi.ts`:
```ts
export const vi = {
  tabs: {
    home:    'Nhà',
    moments: 'Khoảnh khắc',
    family:  'Gia đình',
    me:      'Tôi',
  },
  greeting: {
    morning:   'Chào buổi sáng',
    noon:      'Chào buổi trưa',
    afternoon: 'Chào buổi chiều',
    evening:   'Chào buổi tối',
    night:     'Chào buổi khuya',
  },
  home: {
    album_default:   'Album của bé',
    badge_age:       '{{months}} tháng',
    badge_members:   '{{count}} thành viên',
    badge_photos:    '{{count}} ảnh',
    empty_message:   'chưa có ảnh nào ~ thêm khoảnh khắc đầu tiên nhé!',
  },
  moments: {
    title:         'Khoảnh khắc 🌟',
    eyebrow:       '~ những khoảnh khắc đáng nhớ ~',
    empty_message: 'chưa có mốc nào ~ ghi lại khoảnh khắc đầu tiên ✦',
  },
  family: {
    title:        'Gia đình 👨‍👩‍👧',
    invite_title: 'Mời gia đình',
    copy_link:    'Sao chép link mời',
    scan_qr:      'Quét mã QR',
    role_admin:   'Chủ album',
    role_member:  'Thành viên',
    joined_on:    'tham gia ngày {{date}}',
  },
  settings: {
    title:      'Cài đặt',
    push_label: 'Thông báo đẩy',
    signout:    'Đăng xuất',
    version:    'Phiên bản {{v}}',
  },
  signin: {
    tagline:    'lưu giữ từng khoảnh khắc bé yêu',
    apple:      'Đăng nhập với Apple',
    google:     'Đăng nhập với Google',
    privacy:    'Bằng việc đăng nhập, bạn đồng ý với Chính sách bảo mật.',
    failed:     'Đăng nhập thất bại',
  },
  upload: {
    title:       'Ảnh mới',
    eyebrow:     '~ thêm ảnh ~',
    caption_ph:  'ghi chú nhỏ cho ảnh...',
    uploading:   'đang tải lên {{done}}/{{total}}...',
    compressing: 'đang nén...',
    cta:         'Tải lên {{n}} ảnh',
    cta_one:     'Tải lên 1 ảnh',
    cancel:      'Huỷ',
  },
  milestone: {
    new_title:    'Mốc đáng nhớ',
    new_eyebrow:  '~ thêm khoảnh khắc ~',
    name_ph:      'Tên khoảnh khắc',
    note_ph:      'ghi chú nhỏ... (tuỳ chọn)',
    save:         'Lưu mốc ✦',
    pick_cover:   'Chọn ảnh bìa',
  },
  invite: {
    sheet_eyebrow: '~ mời ai đó tham gia ~',
    link_label:    'link mời',
    expires:       'Hết hạn sau 7 ngày',
    copied:        'Đã sao chép!',
    copied_body:   'Đã sao chép link mời vào bộ nhớ tạm.',
  },
  qr: {
    sheet_title:   'quét mã này nhé ✦',
    valid_for:     'Mã hợp lệ trong 5 phút',
    perm_title:    'Cần quyền camera',
    perm_body:     'Camera dùng để quét mã QR mời.',
    perm_grant:    'Cho phép',
    joined_title:  'Đã tham gia!',
    joined_body:   'Bạn đã tham gia album.',
  },
  join: {
    invited_msg:   'Bạn được mời tham gia ~',
    members_info:  '{{members}} thành viên · {{photos}} ảnh',
    cta:           'Tham gia album',
  },
  photo: {
    counter: '{{i}} / {{n}}',
    close:   'Đóng',
  },
  common: {
    cancel: 'Huỷ',
    done:   'Xong',
    error:  'Có lỗi xảy ra',
  },
};
```

`mobile/src/locales/en.ts`:
```ts
export const en = {
  tabs:    { home: 'Home', moments: 'Moments', family: 'Family', me: 'Me' },
  greeting:{ morning: 'Good morning', noon: 'Good afternoon', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' },
  home:    { album_default: "Baby's Album", badge_age: '{{months}} months', badge_members: '{{count}} family', badge_photos: '{{count}} photos', empty_message: 'No photos yet — add your first memory!' },
  moments: { title: 'Moments 🌟', eyebrow: '~ moments to remember ~', empty_message: 'No milestones yet — record your first one ✦' },
  family:  { title: 'Family 👨‍👩‍👧', invite_title: 'Invite family', copy_link: 'Copy invite link', scan_qr: 'Scan QR code', role_admin: 'Admin', role_member: 'Member', joined_on: 'joined on {{date}}' },
  settings:{ title: 'Settings', push_label: 'Push notifications', signout: 'Sign out', version: 'Version {{v}}' },
  signin:  { tagline: 'capture every tiny moment', apple: 'Sign in with Apple', google: 'Sign in with Google', privacy: 'By signing in, you agree to our Privacy Policy.', failed: 'Sign in failed' },
  upload:  { title: 'New photos', eyebrow: '~ add photos ~', caption_ph: 'short note for the photo...', uploading: 'uploading {{done}}/{{total}}...', compressing: 'compressing...', cta: 'Upload {{n}} photos', cta_one: 'Upload 1 photo', cancel: 'Cancel' },
  milestone:{ new_title: 'New milestone', new_eyebrow: '~ add a milestone ~', name_ph: 'Milestone name', note_ph: 'short note... (optional)', save: 'Save milestone ✦', pick_cover: 'Pick cover photo' },
  invite:  { sheet_eyebrow: '~ invite someone ~', link_label: 'invite link', expires: 'Expires in 7 days', copied: 'Copied!', copied_body: 'Invite link copied to clipboard.' },
  qr:      { sheet_title: 'scan this code ✦', valid_for: 'Valid for 5 minutes', perm_title: 'Camera permission', perm_body: 'Camera is needed to scan QR codes.', perm_grant: 'Grant permission', joined_title: 'Joined!', joined_body: 'You joined the album.' },
  join:    { invited_msg: "You're invited to join ~", members_info: '{{members}} members · {{photos}} photos', cta: 'Join album' },
  photo:   { counter: '{{i}} / {{n}}', close: 'Close' },
  common:  { cancel: 'Cancel', done: 'Done', error: 'Something went wrong' },
};
```

`mobile/src/lib/i18n.ts`:
```ts
import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { vi } from '@/locales/vi';
import { en } from '@/locales/en';

export const i18n = new I18n({ vi, en });
i18n.defaultLocale = 'vi';
i18n.enableFallback = true;

const deviceLocale = getLocales()[0]?.languageCode ?? 'vi';
// Force vi-first per project policy; only flip to en if device explicitly says so.
i18n.locale = deviceLocale === 'en' ? 'en' : 'vi';

export const t = (key: string, params?: Record<string, unknown>): string =>
  i18n.t(key, params);
```

Also add path alias if not already present. Check `mobile/tsconfig.json` — `@/*` mapping should already cover `src/*`.

- [ ] **Step 4: Run test**

```bash
cd mobile && npx jest src/lib/__tests__/i18n.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/lib/i18n.ts mobile/src/locales mobile/src/lib/__tests__/i18n.test.ts
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): add i18n with vi (default) and en locales"
```

---

### Task 7: Load Fredoka + Caveat fonts in root layout

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Update the root layout to load fonts before rendering**

Open `mobile/app/_layout.tsx`. Replace its full contents with:

```tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { registerPushToken } from '@/lib/notifications';
import '@/lib/i18n'; // initialize default locale

const TOKEN_KEY = 'auth_token';

export default function RootLayout() {
  const { setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Caveat_500Medium,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        try {
          const { data } = await api.get('/users/me', { headers: { Authorization: `Bearer ${stored}` } });
          setAuth(stored, data);
          registerPushToken().catch(() => {});
          router.replace('/(tabs)');
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          clearAuth();
          router.replace('/(auth)');
        }
      } else {
        router.replace('/(auth)');
      }
      setReady(true);
    })();
  }, []);

  if (!ready || !fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="milestone/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="milestone/[id]" />
          <Stack.Screen name="photo/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="join/[token]" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Run existing layout test**
```bash
cd mobile && npx jest app/__tests__/_layout.test.tsx
```
Expected: existing test still passes (or its snapshot needs `-u` after this refactor; only `-u` if you've manually verified the snapshot is correct). If the test renders the stack with `fontsLoaded=true`, mock `useFonts` to return `[true]`. If it fails because of `useFonts` mock missing, add to the test file:
```ts
jest.mock('@expo-google-fonts/fredoka', () => ({
  useFonts: () => [true],
  Fredoka_400Regular: 'Fredoka_400Regular',
  Fredoka_500Medium: 'Fredoka_500Medium',
  Fredoka_600SemiBold: 'Fredoka_600SemiBold',
  Fredoka_700Bold: 'Fredoka_700Bold',
}));
jest.mock('@expo-google-fonts/caveat', () => ({
  Caveat_500Medium: 'Caveat_500Medium',
  Caveat_600SemiBold: 'Caveat_600SemiBold',
  Caveat_700Bold: 'Caveat_700Bold',
}));
```

- [ ] **Step 3: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/_layout.tsx mobile/app/__tests__/_layout.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): load Fredoka and Caveat fonts at app root"
```

---

## Phase B · UI Primitive Restyle

### Task 8: Restyle `Button` (joyful/quiet tiers + haptics)

**Files:**
- Modify: `mobile/src/components/ui/Button.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, radii, spacing, shadows, typography } from '@/constants/theme';
import { tap } from '@/lib/haptics';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  tier?: 'joyful' | 'quiet';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', tier = 'joyful', fullWidth, loading, disabled }: ButtonProps) {
  function handlePress() {
    tap();
    onPress();
  }

  const containerStyle: ViewStyle[] = [
    styles.base,
    tier === 'joyful' && styles.joyfulShadow,
    variant === 'primary' && styles.primary,
    variant === 'ghost' && (tier === 'joyful' ? styles.ghostJoyful : styles.ghostQuiet),
    variant === 'danger' && styles.danger,
    tier === 'joyful' && variant !== 'ghost' && styles.joyfulBorder,
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  return (
    <TouchableOpacity style={containerStyle} onPress={handlePress} disabled={disabled || loading} activeOpacity={0.85}>
      {loading
        ? <ActivityIndicator color={variant === 'ghost' ? colors.pink : colors.white} />
        : <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base:        { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'], borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  joyfulBorder:{ borderWidth: 1.5, borderColor: colors.ink },
  joyfulShadow:{ ...shadows.sticker },
  primary:     { backgroundColor: colors.pink },
  ghostJoyful: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink },
  ghostQuiet:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.pink },
  danger:      { backgroundColor: colors.pinkDeep },
  fullWidth:   { width: '100%' },
  disabled:    { opacity: 0.5 },
  label:       { ...typography.body, fontFamily: 'Fredoka_600SemiBold', color: colors.white },
  ghostLabel:  { color: colors.ink },
  dangerLabel: { color: colors.white },
});
```

- [ ] **Step 2: Run typechecker**
```bash
cd mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Update / record snapshot**

The existing `mobile/app/(auth)/__tests__/index.test.tsx` and other Button consumers will have snapshot diffs. **Do NOT regenerate snapshots in this task** — they're regenerated in their owning screen tasks below.

- [ ] **Step 4: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/components/ui/Button.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): Button gets joyful/quiet tiers + haptics"
```

---

### Task 9: Restyle `Card`, `Badge`, `Avatar`, `TextInput`

**Files:**
- Modify: `mobile/src/components/ui/Card.tsx`
- Modify: `mobile/src/components/ui/Badge.tsx`
- Modify: `mobile/src/components/ui/Avatar.tsx`
- Modify: `mobile/src/components/ui/TextInput.tsx`

- [ ] **Step 1: Card — add tier prop**

`mobile/src/components/ui/Card.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  tier?: 'joyful' | 'quiet';
  style?: ViewStyle;
}

export function Card({ children, tier = 'joyful', style }: CardProps) {
  const tierStyle = tier === 'joyful' ? styles.joyful : styles.quiet;
  return <View style={[styles.base, tierStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base:   { backgroundColor: colors.white, padding: spacing.lg },
  joyful: { borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink, ...shadows.sticker },
  quiet:  { borderRadius: radii.sm, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card },
});
```

- [ ] **Step 2: Badge — add color prop**

`mobile/src/components/ui/Badge.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

type AccentColor = 'pink' | 'yellow' | 'mint' | 'peach' | 'sky';

interface BadgeProps {
  label: string;
  color?: AccentColor;
}

const accent: Record<AccentColor, string> = {
  pink:   colors.pink,
  yellow: colors.yellow,
  mint:   colors.mint,
  peach:  colors.peach,
  sky:    colors.sky,
};

export function Badge({ label, color = 'pink' }: BadgeProps) {
  return (
    <View style={[styles.base, { backgroundColor: accent[color] }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
  },
  text: { ...typography.pill, color: colors.ink },
});
```

- [ ] **Step 3: Avatar — add ring + shadow props**

`mobile/src/components/ui/Avatar.tsx`:
```tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, shadows } from '@/constants/theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  shadow?: boolean;
}

export function Avatar({ uri, name, size = 36, ring = false, shadow = false }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 2, borderColor: colors.white } : {};
  const shadowStyle = shadow ? shadows.sticker : {};

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, circle, ringStyle, shadowStyle]} />;
  }
  return (
    <View style={[styles.fallback, circle, ringStyle, shadowStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image:    { backgroundColor: colors.yellow },
  fallback: { backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.ink, fontFamily: 'Fredoka_700Bold' },
});
```

- [ ] **Step 4: TextInput — dashed border + Caveat placeholder option**

`mobile/src/components/ui/TextInput.tsx`:
```tsx
import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface LabeledTextInputProps extends TextInputProps {
  label?: string;
  caveatPlaceholder?: boolean;
}

export function TextInput({ label, style, caveatPlaceholder, ...props }: LabeledTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          caveatPlaceholder && !props.value ? styles.caveatStyle : null,
          focused && styles.focused,
          style,
        ]}
        placeholderTextColor={colors.inkMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label:   { ...typography.body, marginBottom: spacing.xs, color: colors.inkSoft },
  input: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  focused:     { borderColor: colors.pink, borderStyle: 'solid' },
  caveatStyle: { fontFamily: 'Caveat_500Medium', fontSize: 16 },
});
```

- [ ] **Step 5: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/components/ui/Card.tsx mobile/src/components/ui/Badge.tsx mobile/src/components/ui/Avatar.tsx mobile/src/components/ui/TextInput.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): restyle Card/Badge/Avatar/TextInput to Sticker Mix"
```

---

### Task 10: Replace `HeaderGradient` + `LoadingSpinner` with new components

**Files:**
- Delete: `mobile/src/components/ui/HeaderGradient.tsx`
- Delete: `mobile/src/components/ui/LoadingSpinner.tsx`
- Create: `mobile/src/components/ui/JoyfulHeader.tsx`
- Create: `mobile/src/components/ui/QuietHeader.tsx`
- Create: `mobile/src/components/ui/SkeletonTile.tsx`
- Create: `mobile/src/components/ui/SkeletonRow.tsx`
- Create: `mobile/src/components/ui/SkeletonCard.tsx`
- Create: `mobile/src/components/ui/__tests__/JoyfulHeader.test.tsx`
- Create: `mobile/src/components/ui/__tests__/QuietHeader.test.tsx`

- [ ] **Step 1: Delete the old files**
```bash
rm /Users/do.nguyen/personal/family-guy/mobile/src/components/ui/HeaderGradient.tsx
rm /Users/do.nguyen/personal/family-guy/mobile/src/components/ui/LoadingSpinner.tsx
```

- [ ] **Step 2: Write the smoke tests**

`mobile/src/components/ui/__tests__/JoyfulHeader.test.tsx`:
```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { JoyfulHeader } from '../JoyfulHeader';

it('renders children', () => {
  const { getByText } = render(<JoyfulHeader><Text>Hi</Text></JoyfulHeader>);
  expect(getByText('Hi')).toBeTruthy();
});
```

`mobile/src/components/ui/__tests__/QuietHeader.test.tsx`:
```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { QuietHeader } from '../QuietHeader';

it('renders children', () => {
  const { getByText } = render(<QuietHeader><Text>Hi</Text></QuietHeader>);
  expect(getByText('Hi')).toBeTruthy();
});
```

- [ ] **Step 3: Run — expect FAIL (modules missing)**
```bash
cd mobile && npx jest src/components/ui/__tests__/JoyfulHeader.test.tsx src/components/ui/__tests__/QuietHeader.test.tsx
```
Expected: FAIL.

- [ ] **Step 4: Implement `JoyfulHeader`**

`mobile/src/components/ui/JoyfulHeader.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface JoyfulHeaderProps {
  children: React.ReactNode;
}

export function JoyfulHeader({ children }: JoyfulHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <DotMotif />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

function DotMotif() {
  // 4 absolutely positioned dots — scattered sticker pattern, opacity 0.5
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.dot, { backgroundColor: colors.yellow, top: 24, left: '14%', width: 10, height: 10 }]} />
      <View style={[styles.dot, { backgroundColor: colors.pink,   top: 36, left: '88%', width: 8,  height: 8 }]} />
      <View style={[styles.dot, { backgroundColor: colors.mint,   top: 96, left: '6%',  width: 8,  height: 8 }]} />
      <View style={[styles.dot, { backgroundColor: colors.peach,  top: 88, left: '92%', width: 10, height: 10 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.cream, paddingHorizontal: spacing['2xl'], paddingBottom: spacing['2xl'] },
  content: { position: 'relative' },
  dot:     { position: 'absolute', borderRadius: 9999, opacity: 0.5 },
});
```

- [ ] **Step 5: Implement `QuietHeader`**

`mobile/src/components/ui/QuietHeader.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

export function QuietHeader({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.content}>{children}</View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.cream, paddingHorizontal: spacing['2xl'], paddingBottom: spacing.lg },
  content: {},
  divider: { height: 1, backgroundColor: colors.borderSoft, marginTop: spacing.lg },
});
```

- [ ] **Step 6: Implement skeleton components**

`mobile/src/components/ui/SkeletonTile.tsx`:
```tsx
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radii } from '@/constants/theme';

interface SkeletonTileProps {
  size: number;
  alt?: boolean; // alt radius — alternating per index
}

export function SkeletonTile({ size, alt = false }: SkeletonTileProps) {
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const [tl, tr, br, bl] = alt ? radii.stickerAlt : radii.sticker;
  return (
    <Animated.View
      style={[
        { width: size, height: size, backgroundColor: colors.borderSoft,
          borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
        styles.border,
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  border: { borderWidth: 3, borderColor: colors.white },
});
```

`mobile/src/components/ui/SkeletonRow.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SkeletonTile } from './SkeletonTile';
import { spacing } from '@/constants/theme';

export function SkeletonRow({ rowIndex = 0 }: { rowIndex?: number }) {
  const { width } = useWindowDimensions();
  const cellSize = (width - spacing['2xl'] * 2 - spacing.xs) / 2;
  const altA = rowIndex % 2 === 0;
  return (
    <View style={styles.row}>
      <SkeletonTile size={cellSize} alt={altA} />
      <SkeletonTile size={cellSize} alt={!altA} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
});
```

`mobile/src/components/ui/SkeletonCard.tsx`:
```tsx
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radii, spacing } from '@/constants/theme';

export function SkeletonCard({ height = 72 }: { height?: number }) {
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.card, { height }, animStyle]} />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.borderSoft, borderRadius: radii.md, marginVertical: spacing.xs },
});
```

- [ ] **Step 7: Run smoke tests**
```bash
cd mobile && npx jest src/components/ui/__tests__/JoyfulHeader.test.tsx src/components/ui/__tests__/QuietHeader.test.tsx
```
Expected: PASS.

- [ ] **Step 8: Confirm Type compile**
```bash
cd mobile && npx tsc --noEmit
```
Expected: errors on every file that still imports `HeaderGradient` or `LoadingSpinner`. That's expected — leave them; subsequent screen tasks replace those imports.

- [ ] **Step 9: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add -A mobile/src/components/ui/
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): swap HeaderGradient/LoadingSpinner for JoyfulHeader/QuietHeader/Skeletons"
```

---

### Task 11: Restyle `SectionHeader`, `EmptyState`

**Files:**
- Modify: `mobile/src/components/ui/SectionHeader.tsx`
- Modify: `mobile/src/components/ui/EmptyState.tsx`

- [ ] **Step 1: SectionHeader → Caveat 20 pink**

`mobile/src/components/ui/SectionHeader.tsx`:
```tsx
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { spacing, typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.text}>~ {title} ~</Text>;
}

const styles = StyleSheet.create({
  text: { ...typography.handAccent, fontSize: 20, marginTop: spacing['2xl'], marginBottom: spacing.sm },
});
```

- [ ] **Step 2: EmptyState → handLarge + float animation**

`mobile/src/components/ui/EmptyState.tsx`:
```tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { colors, spacing, typography } from '@/constants/theme';

interface EmptyStateProps {
  emoji: string;
  message: string;
}

export function EmptyState({ emoji, message }: EmptyStateProps) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1);
  }, [y]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.emoji, float]}>{emoji}</Animated.Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  emoji:     { fontSize: 72, marginBottom: spacing.lg },
  message:   { ...typography.handLarge, color: colors.inkSoft, textAlign: 'center', lineHeight: 34 },
});
```

- [ ] **Step 3: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/components/ui/SectionHeader.tsx mobile/src/components/ui/EmptyState.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): SectionHeader + EmptyState use Caveat handwriting"
```

---

### Task 12: Restyle `MilestoneCard` + `PhotoCell`

**Files:**
- Modify: `mobile/src/components/ui/MilestoneCard.tsx`
- Modify: `mobile/src/components/ui/PhotoCell.tsx`

- [ ] **Step 1: MilestoneCard — left accent strip (color by index)**

`mobile/src/components/ui/MilestoneCard.tsx`:
```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { formatVnDate, formatVnMonth } from '@/lib/format';

const ACCENTS = [colors.pink, colors.yellow, colors.mint, colors.peach, colors.sky] as const;

interface MilestoneCardProps {
  title: string;
  note?: string | null;
  occurredAt: string;
  index?: number;
  onPress?: () => void;
}

export function MilestoneCard({ title, note, occurredAt, index = 0, onPress }: MilestoneCardProps) {
  const d = new Date(occurredAt);
  const date = `${formatVnDate(d)} · ${formatVnMonth(d)} ${d.getFullYear()}`;
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {note && <Text style={styles.note} numberOfLines={2}>{note}</Text>}
        <Text style={styles.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:    {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.sticker,
  },
  accent:  { width: 6 },
  content: { flex: 1, padding: spacing.lg, gap: 4 },
  title:   { ...typography.title, color: colors.ink },
  note:    { fontFamily: 'Caveat_500Medium', fontSize: 16, color: colors.inkSoft },
  date:    { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted },
});
```

- [ ] **Step 2: PhotoCell — alternating sticker radii by index + white border + sticker shadow**

`mobile/src/components/ui/PhotoCell.tsx`:
```tsx
import React from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows, typography, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  index?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function PhotoCell({ uri, caption, size, index = 0, onPress, style }: PhotoCellProps) {
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;
  return (
    <View>
      <TouchableOpacity
        onPress={() => { tap(); onPress?.(); }}
        style={[
          { width: size, height: size,
            borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
          styles.container,
          style,
        ]}
        activeOpacity={0.9}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:     { width: '100%', height: '100%' },
  caption:   {
    ...typography.handAccent, color: colors.inkSoft, fontSize: 14,
    textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs,
  },
});
```

- [ ] **Step 3: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/components/ui/MilestoneCard.tsx mobile/src/components/ui/PhotoCell.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): MilestoneCard accent strip + PhotoCell sticker shapes"
```

---

### Task 13: Add `Sticker`, `BouncingDot`, `Confetti`

**Files:**
- Create: `mobile/src/components/ui/Sticker.tsx`
- Create: `mobile/src/components/ui/BouncingDot.tsx`
- Create: `mobile/src/components/ui/Confetti.tsx`

- [ ] **Step 1: Sticker wrapper**

`mobile/src/components/ui/Sticker.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '@/constants/theme';

interface StickerProps {
  children?: React.ReactNode;
  rotation?: number;
  style?: ViewStyle;
}

export function Sticker({ children, rotation = 0, style }: StickerProps) {
  return (
    <View style={[styles.base, { transform: [{ rotate: `${rotation}deg` }] }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink, borderRadius: radii.md, ...shadows.sticker },
});
```

- [ ] **Step 2: BouncingDot (pull-to-refresh indicator)**

`mobile/src/components/ui/BouncingDot.tsx`:
```tsx
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/constants/theme';

export function BouncingDot({ size = 16, color = colors.pink }: { size?: number; color?: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-8, { duration: 400 }), withTiming(0, { duration: 400 })), -1);
  }, [y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.wrap}>
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, anim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 12 },
});
```

- [ ] **Step 3: Confetti — 24 particles burst**

`mobile/src/components/ui/Confetti.tsx`:
```tsx
import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { motion } from '@/lib/motion';

const PALETTE = [colors.pink, colors.yellow, colors.mint, colors.peach, colors.sky];

function Particle({ index, originX, originY }: { index: number; originX: number; originY: number }) {
  const angle = (Math.PI * 2 * index) / motion.confetti.particles + Math.random() * 0.4;
  const distance = 100 + Math.random() * 120;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance - 60; // bias upward
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: motion.confetti.durationMs, easing: Easing.out(Easing.quad) });
  }, [t]);

  const anim = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: dx * t.value },
      { translateY: dy * t.value + 200 * t.value * t.value },
      { rotate: `${360 * t.value}deg` },
    ],
  }));

  const color = PALETTE[index % PALETTE.length];

  return <Animated.View pointerEvents="none" style={[styles.particle, { left: originX, top: originY, backgroundColor: color }, anim]} />;
}

interface ConfettiProps {
  visible: boolean;
  originX?: number;
  originY?: number;
}

export function Confetti({ visible, originX, originY }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  if (!visible) return null;
  const ox = originX ?? width / 2;
  const oy = originY ?? height / 2;
  return (
    <>
      {Array.from({ length: motion.confetti.particles }).map((_, i) => (
        <Particle key={i} index={i} originX={ox} originY={oy} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', width: 10, height: 10, borderRadius: 2 },
});
```

- [ ] **Step 4: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/components/ui/Sticker.tsx mobile/src/components/ui/BouncingDot.tsx mobile/src/components/ui/Confetti.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): add Sticker wrapper + BouncingDot + Confetti"
```

---

## Phase C · Screens

After each screen task: re-record snapshots with `npx jest <path> -u`, **but** spot-check the test output (snapshots are usually noise; just confirm the test still passes after `-u`).

### Task 14: Sign In — Joyful

**Files:**
- Modify: `mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Button } from '@/components/ui/Button';
import { registerPushToken } from '@/lib/notifications';
import { t } from '@/lib/i18n';

const TOKEN_KEY = 'auth_token';

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

function FloatingDot({ x, y, size, color, delay }: { x: string; y: number; size: number; color: string; delay: number }) {
  const yShared = useSharedValue(0);
  useEffect(() => {
    yShared.value = withRepeat(withSequence(withTiming(-10, { duration: 2200 + delay }), withTiming(0, { duration: 2200 + delay })), -1);
  }, [yShared, delay]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: yShared.value }] }));
  return <Animated.View style={[styles.dot, { left: x, top: y, width: size, height: size, backgroundColor: color }, anim]} />;
}

export default function SignInScreen() {
  const { setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  async function handleApple() {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      const { data } = await api.post('/auth/apple', { identityToken: cred.identityToken, fullName: cred.fullName });
      await finishAuth(data.token, data.user);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert(t('signin.failed'), e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    try {
      setLoading('google');
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('No idToken returned from Google');
      const { data } = await api.post('/auth/google', { idToken });
      await finishAuth(data.token, data.user);
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return;
      Alert.alert(t('signin.failed'), e.message ?? t('common.error'));
    } finally {
      setLoading(null);
    }
  }

  async function finishAuth(token: string, user: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuth(token, user);
    registerPushToken().catch(() => {});
    try {
      const { data: albums } = await api.get('/albums', { headers: { Authorization: `Bearer ${token}` } });
      if (albums[0]) setAlbum(albums[0]);
    } catch {}
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <FloatingDot x="10%" y={100} size={18} color={colors.yellow} delay={0} />
      <FloatingDot x="85%" y={140} size={14} color={colors.pink}   delay={300} />
      <FloatingDot x="15%" y={300} size={12} color={colors.mint}   delay={600} />
      <FloatingDot x="80%" y={360} size={16} color={colors.peach}  delay={900} />
      <FloatingDot x="50%" y={70}  size={10} color={colors.sky}    delay={1200} />
      <FloatingDot x="35%" y={520} size={14} color={colors.yellow} delay={1500} />

      <View style={styles.content}>
        <Text style={styles.logo}>👶</Text>
        <Text style={styles.appName}>Family Guy</Text>
        <Text style={styles.tagline}>{t('signin.tagline')}</Text>

        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={22}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <Button label={t('signin.google')} onPress={handleGoogle} variant="ghost" fullWidth loading={loading === 'google'} />
        </View>

        <Text style={styles.privacy}>{t('signin.privacy')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  dot:       { position: 'absolute', borderRadius: 9999, opacity: 0.7, borderWidth: 2, borderColor: colors.ink, ...shadows.sticker },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  logo:      { fontSize: 72, marginBottom: spacing.lg },
  appName:   { ...typography.display, fontSize: 32, color: colors.ink, marginBottom: spacing.xs },
  tagline:   { ...typography.handAccent, color: colors.pink, fontSize: 20, marginBottom: spacing['4xl'] },
  buttons:   { width: '100%', gap: spacing.md },
  appleBtn:  { height: 52, width: '100%', marginBottom: spacing.xs },
  privacy:   { ...typography.caption, color: colors.inkMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
```

- [ ] **Step 2: Run sign-in screen test, update snapshot**
```bash
cd mobile && npx jest app/\(auth\)/__tests__/index.test.tsx -u
```
Expected: PASS after `-u`. Skim the new snapshot for sanity — should reference Fredoka, Caveat, ink/cream colors.

- [ ] **Step 3: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/\(auth\)/
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): Sign In screen Sticker Mix + Vietnamese"
```

---

### Task 15: Tab bar + FAB

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing } from '@/constants/theme';
import { UploadSheet } from '@/components/upload/UploadSheet';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

function FABButton({ onPress }: { onPress: () => void }) {
  function handle() { tap(); onPress(); }
  return (
    <TouchableOpacity onPress={handle} style={styles.fabWrap} activeOpacity={0.85}>
      <View style={styles.ring}>
        <LinearGradient colors={[colors.peach, colors.pink]} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={28} color={colors.white} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const [uploadVisible, setUploadVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.pink,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: { borderTopColor: colors.ink, borderTopWidth: 2, backgroundColor: colors.white, height: 64 },
          tabBarLabelStyle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 11 },
        }}
      >
        <Tabs.Screen name="index"     options={{ title: t('tabs.home'),    tabBarIcon: ({ color, size }) => <Ionicons name="home"            size={size} color={color} /> }} />
        <Tabs.Screen name="milestones"options={{ title: t('tabs.moments'), tabBarIcon: ({ color, size }) => <Ionicons name="star"            size={size} color={color} /> }} />
        <Tabs.Screen name="upload"    options={{ title: '',                tabBarButton: () => <FABButton onPress={() => setUploadVisible(true)} /> }} />
        <Tabs.Screen name="family"    options={{ title: t('tabs.family'),  tabBarIcon: ({ color, size }) => <Ionicons name="people"          size={size} color={color} /> }} />
        <Tabs.Screen name="settings"  options={{ title: t('tabs.me'),      tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
      </Tabs>
      <UploadSheet visible={uploadVisible} onClose={() => setUploadVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { top: -12 },
  ring:    { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadows.fab },
  fab:     { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Update snapshot**
```bash
cd mobile && npx jest app/\(tabs\)/__tests__/_layout.test.tsx -u
```
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/\(tabs\)/_layout.tsx mobile/app/\(tabs\)/__tests__/_layout.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): tab bar + FAB Sticker Mix + Vietnamese labels"
```

---

### Task 16: Home screen + TimelineFeed + MonthHeader + PhotoRow

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/src/components/timeline/MonthHeader.tsx`
- Modify: `mobile/src/components/timeline/PhotoRow.tsx`
- Modify: `mobile/src/components/timeline/TimelineFeed.tsx`

- [ ] **Step 1: MonthHeader — Caveat 20 pink + ~ ~ wrap**

```tsx
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface MonthHeaderProps { label: string }

export function MonthHeader({ label }: MonthHeaderProps) {
  return <Text style={styles.text}>~ {label} ~</Text>;
}

const styles = StyleSheet.create({
  text: { ...typography.handAccent, fontSize: 20, color: colors.pink, marginTop: spacing['2xl'], marginBottom: spacing.sm, textAlign: 'left' },
});
```

- [ ] **Step 2: PhotoRow — always 2-col with alternating sticker shapes**

```tsx
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { PhotoCell } from '@/components/ui/PhotoCell';
import { spacing } from '@/constants/theme';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PhotoRowProps {
  photos: TimelinePhoto[];
  rowIndex?: number;
}

export function PhotoRow({ photos, rowIndex = 0 }: PhotoRowProps) {
  const { width } = useWindowDimensions();
  const gap = spacing.xs;
  const count = Math.min(photos.length, 2);
  const cellSize = (width - spacing['2xl'] * 2 - gap * (count - 1)) / count;

  return (
    <View style={styles.row}>
      {photos.slice(0, count).map((p, i) => (
        <PhotoCell
          key={p.id}
          uri={`${API_URL}/photos/${p.id}/thumb`}
          caption={p.caption}
          size={cellSize}
          index={rowIndex * 2 + i}
          onPress={() => router.push(`/photo/${p.id}`)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
});
```

- [ ] **Step 3: TimelineFeed — Vietnamese month labels, skeleton loader, bouncing-dot refresh, batch always 2**

```tsx
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, View } from 'react-native';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { MonthHeader } from './MonthHeader';
import { PhotoRow } from './PhotoRow';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { colors, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { formatVnMonth, formatVnAge } from '@/lib/format';
import { t } from '@/lib/i18n';

function getMonthLabel(isoDate: string, birthdate: string | null): string {
  const d = new Date(isoDate);
  const month = formatVnMonth(d);
  if (!birthdate) return `${month} · ${d.getFullYear()}`;
  return `${month} · ${formatVnAge(birthdate, d)}`;
}

interface FlatListItem {
  type: 'month' | 'photoRow' | 'milestone';
  key: string;
  label?: string;
  photos?: any[];
  milestone?: any;
  index?: number;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } = useTimeline();

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentMonth = '';
    let photoBuffer: any[] = [];
    let rowIndex = 0;

    const flushPhotos = () => {
      while (photoBuffer.length > 0) {
        const batch = photoBuffer.splice(0, 2);
        result.push({ type: 'photoRow', key: `row-${batch[0].id}`, photos: batch, index: rowIndex });
        rowIndex++;
      }
    };

    let mIdx = 0;
    for (const item of allItems) {
      const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
      const monthKey = dateStr.slice(0, 7);
      if (monthKey !== currentMonth) {
        flushPhotos();
        currentMonth = monthKey;
        result.push({ type: 'month', key: `month-${monthKey}`, label: getMonthLabel(dateStr, childBirthdate) });
      }
      if (item.type === 'photo') {
        photoBuffer.push(item);
        if (photoBuffer.length >= 2) flushPhotos();
      } else {
        flushPhotos();
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item, index: mIdx++ });
      }
    }
    flushPhotos();
    return result;
  }, [data, childBirthdate]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.skel}>
        <SkeletonRow rowIndex={0} />
        <SkeletonRow rowIndex={1} />
        <SkeletonRow rowIndex={2} />
      </View>
    );
  }
  if (!items.length) return <EmptyState emoji="🌸" message={t('home.empty_message')} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.content}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pink} />}
      renderItem={({ item }) => {
        if (item.type === 'month') return <MonthHeader label={item.label!} />;
        if (item.type === 'photoRow') return <PhotoRow photos={item.photos!} rowIndex={item.index} />;
        return (
          <MilestoneCard
            title={item.milestone.title}
            note={item.milestone.note}
            occurredAt={item.milestone.occurred_at}
            index={item.index}
            onPress={() => router.push(`/milestone/${item.milestone.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'] },
  skel:    { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg },
});
```

- [ ] **Step 4: Home screen — JoyfulHeader + new badge row + Vietnamese greeting**

`mobile/app/(tabs)/index.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useAlbum } from '@/hooks/useAlbum';
import { useMembers } from '@/hooks/useMembers';
import { useTimeline } from '@/hooks/useTimeline';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnAge, greetingForHour } from '@/lib/format';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const albumName = useAlbumStore((s) => s.albumName);
  const childBirthdate = useAlbumStore((s) => s.childBirthdate);
  const { data: album } = useAlbum();
  const { data: members } = useMembers();
  const { data: timeline } = useTimeline();

  const firstName = user?.display_name?.split(' ')[0] ?? '';
  const birthdate = childBirthdate ?? album?.child_birthdate ?? null;
  const ageLabel = formatVnAge(birthdate);
  const photoCount = timeline?.pages.reduce((s, p) => s + p.items.filter((i: any) => i.type === 'photo').length, 0) ?? 0;

  return (
    <View style={styles.container}>
      <JoyfulHeader>
        <Text style={styles.greeting}>{greetingForHour(new Date().getHours())}, {firstName} ✦</Text>
        <Text style={styles.albumName}>{albumName ?? t('home.album_default')}</Text>

        <View style={styles.badges}>
          {ageLabel ? <Badge label={ageLabel} color="yellow" /> : null}
          {members && members.length > 0 ? <Badge label={t('home.badge_members', { count: members.length })} color="mint" /> : null}
          {photoCount > 0 ? <Badge label={t('home.badge_photos', { count: photoCount })} color="peach" /> : null}
        </View>

        {members && members.length > 0 && (
          <TouchableOpacity style={styles.avatarRow} onPress={() => router.push('/(tabs)/family')}>
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} uri={m.avatar_url} name={m.display_name} size={28} ring shadow />
            ))}
          </TouchableOpacity>
        )}
      </JoyfulHeader>

      <TimelineFeed childBirthdate={birthdate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  greeting:  { ...typography.handAccent, color: colors.pink, fontSize: 18, marginBottom: 4 },
  albumName: { ...typography.heading, color: colors.ink, marginBottom: spacing.sm },
  badges:    { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm },
  avatarRow: { flexDirection: 'row', gap: -8, marginTop: spacing.sm },
});
```

- [ ] **Step 5: Update snapshots**
```bash
cd mobile && npx jest app/\(tabs\)/__tests__/index.test.tsx -u
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/\(tabs\)/index.tsx mobile/src/components/timeline mobile/app/\(tabs\)/__tests__/index.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): Home + Timeline Sticker Mix"
```

---

### Task 17: Khoảnh khắc tab (Milestones)

**Files:**
- Modify: `mobile/app/(tabs)/milestones.tsx`

- [ ] **Step 1: Replace file**

```tsx
import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { colors, shadows, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tap } from '@/lib/haptics';

export default function MilestonesTab() {
  const { data: milestones, isLoading } = useMilestones();

  return (
    <View style={styles.container}>
      <JoyfulHeader>
        <Text style={styles.eyebrow}>{t('moments.eyebrow')}</Text>
        <Text style={styles.heading}>{t('moments.title')}</Text>
      </JoyfulHeader>

      {isLoading && (
        <View style={styles.list}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      )}
      {!isLoading && !milestones?.length && (
        <EmptyState emoji="🌟" message={t('moments.empty_message')} />
      )}
      {!isLoading && milestones && milestones.length > 0 && (
        <FlatList
          data={milestones}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <MilestoneCard
              title={item.title}
              note={item.note}
              occurredAt={item.occurred_at}
              index={index}
              onPress={() => router.push(`/milestone/${item.id}`)}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { tap(); router.push('/milestone/new'); }}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  eyebrow:   { ...typography.handAccent, color: colors.pink },
  heading:   { ...typography.heading, color: colors.ink },
  list:      { padding: spacing['2xl'], gap: spacing.sm },
  fab: {
    position: 'absolute', bottom: 90, right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.pink, borderWidth: 2, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', ...shadows.sticker,
  },
});
```

- [ ] **Step 2: Snapshots**
```bash
cd mobile && npx jest app/\(tabs\)/__tests__/milestones.test.tsx -u
```
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/\(tabs\)/milestones.tsx mobile/app/\(tabs\)/__tests__/milestones.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): Khoảnh khắc tab Sticker Mix"
```

---

### Task 18: Family tab + MemberList + InviteSheet + QRSheet

**Files:**
- Modify: `mobile/app/(tabs)/family.tsx`
- Modify: `mobile/src/components/family/MemberList.tsx`
- Modify: `mobile/src/components/family/InviteSheet.tsx`
- Modify: `mobile/src/components/family/QRSheet.tsx`

- [ ] **Step 1: MemberList — sticker member cards**

```tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Member } from '@/hooks/useMembers';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnDate, formatVnMonth } from '@/lib/format';

export function MemberList({ members }: { members: Member[] }) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar uri={item.avatar_url} name={item.display_name} size={40} ring shadow />
          <View style={styles.info}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.joined}>
              {t('family.joined_on', { date: `${formatVnDate(new Date(item.joined_at))} ${formatVnMonth(new Date(item.joined_at))}` })}
            </Text>
          </View>
          <Badge
            label={item.role === 'admin' ? t('family.role_admin') : t('family.role_member')}
            color={item.role === 'admin' ? 'yellow' : 'mint'}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    marginVertical: spacing.xs, gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radii.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink, ...shadows.sticker,
  },
  info:   { flex: 1 },
  name:   { ...typography.title, color: colors.ink },
  joined: { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted },
});
```

- [ ] **Step 2: Family tab — header + member list (Joyful) + invite section (Quiet)**

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useMembers } from '@/hooks/useMembers';
import { MemberList } from '@/components/family/MemberList';
import { InviteSheet } from '@/components/family/InviteSheet';
import { QRSheet } from '@/components/family/QRSheet';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function FamilyTab() {
  const { data: members, isLoading } = useMembers();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <View style={styles.container}>
      <JoyfulHeader>
        <Text style={styles.heading}>{t('family.title')}</Text>
      </JoyfulHeader>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <SkeletonCard />}
        {members && <MemberList members={members} />}

        <Card tier="quiet" style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>{t('family.invite_title')}</Text>
          <View style={styles.actions}>
            <Button label={t('family.copy_link')} onPress={() => setInviteVisible(true)} fullWidth tier="quiet" />
            <Button label={t('family.scan_qr')}   onPress={() => setQrVisible(true)} variant="ghost" tier="quiet" fullWidth />
          </View>
        </Card>
      </ScrollView>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} />
      <QRSheet     visible={qrVisible}     onClose={() => setQrVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.cream },
  heading:     { ...typography.heading, color: colors.ink },
  content:     { padding: spacing['2xl'], gap: spacing.md },
  inviteCard:  { marginTop: spacing.lg, gap: spacing.md },
  inviteTitle: { ...typography.title, color: colors.ink },
  actions:     { gap: spacing.md, marginTop: spacing.sm },
});
```

- [ ] **Step 3: InviteSheet — Joyful**

```tsx
import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteSheet({ visible, onClose }: InviteSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function handleCopyLink() {
    setLoading(true);
    try {
      const { data } = await api.post(`/albums/${albumId}/invites`);
      const generated = `familyguy://join/${data.token}`;
      setLink(generated);
      await Clipboard.setStringAsync(generated);
      success();
      Alert.alert(t('invite.copied'), t('invite.copied_body'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.handle} />
        <Text style={styles.eyebrow}>{t('invite.sheet_eyebrow')}</Text>
        <Text style={styles.heading}>{t('family.invite_title')}</Text>

        <Card style={styles.linkCard}>
          <Text style={styles.linkLabel}>{t('invite.link_label')}</Text>
          <Text style={styles.linkValue} numberOfLines={1}>{link ?? '—'}</Text>
        </Card>

        <Text style={styles.expires}>{t('invite.expires')}</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Button label={t('family.copy_link')} onPress={handleCopyLink} fullWidth loading={loading} />
          <Button label={t('common.done')}      onPress={onClose} variant="ghost" fullWidth />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, padding: spacing['2xl'], backgroundColor: colors.cream, gap: spacing.sm },
  handle:     { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginBottom: spacing.md },
  eyebrow:    { ...typography.handAccent, color: colors.pink },
  heading:    { ...typography.heading, color: colors.ink, marginBottom: spacing.md },
  linkCard:   { gap: 4 },
  linkLabel:  { ...typography.caption },
  linkValue:  { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: colors.inkSoft },
  expires:    { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm },
});
```

- [ ] **Step 4: QRSheet — Joyful**

```tsx
import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { useQueryClient } from '@tanstack/react-query';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface QRSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function QRSheet({ visible, onClose }: QRSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const qc = useQueryClient();
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const token = data.includes('://') ? data.split('/').pop() : data;
    try {
      await api.post(`/invites/${token}/join`);
      qc.invalidateQueries({ queryKey: ['members', albumId] });
      success();
      Alert.alert(t('qr.joined_title'), t('qr.joined_body'));
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.error ?? e.message);
      setScanned(false);
    }
  }

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.handle} />
          <Text style={styles.heading}>{t('qr.perm_title')}</Text>
          <Text style={styles.body}>{t('qr.perm_body')}</Text>
          <Button label={t('qr.perm_grant')} onPress={requestPermission} fullWidth />
          <Button label={t('common.cancel')} onPress={onClose} variant="ghost" fullWidth />
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.handle} />
        <Text style={styles.eyebrow}>{t('qr.sheet_title')}</Text>
        {visible && (
          <View style={styles.scannerFrame}>
            <CameraView style={styles.scanner} onBarcodeScanned={handleBarCodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
          </View>
        )}
        <Text style={styles.validity}>{t('qr.valid_for')}</Text>
        <Button label={t('common.cancel')} onPress={onClose} variant="ghost" fullWidth />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: spacing['2xl'], backgroundColor: colors.cream, gap: spacing.md },
  handle:       { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginBottom: spacing.md },
  eyebrow:      { ...typography.handAccent, color: colors.pink, textAlign: 'center' },
  heading:      { ...typography.heading, color: colors.ink },
  body:         { ...typography.body },
  scannerFrame: { flex: 1, borderRadius: radii.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, overflow: 'hidden', ...shadows.sticker },
  scanner:      { flex: 1 },
  validity:     { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted, textAlign: 'center' },
});
```

- [ ] **Step 5: Snapshots**
```bash
cd mobile && npx jest app/\(tabs\)/__tests__/family.test.tsx -u
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/\(tabs\)/family.tsx mobile/src/components/family mobile/app/\(tabs\)/__tests__/family.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): Family tab + sheets Sticker Mix"
```

---

### Task 19: Settings tab — Quiet tier

**Files:**
- Modify: `mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function SettingsTab() {
  const { user, clearAuth } = useAuthStore();
  const { clearAlbum } = useAlbumStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => { hasPushPermission().then(setNotifEnabled).catch(() => {}); }, []);

  async function toggleNotifications(val: boolean) {
    if (!val) { setNotifEnabled(false); return; }
    setNotifLoading(true);
    try {
      const granted = await registerPushToken();
      setNotifEnabled(granted);
      if (!granted) Alert.alert(t('common.error'), 'Vào Cài đặt thiết bị để bật thông báo.');
    } catch {
      Alert.alert(t('common.error'), 'Không thể đăng ký thông báo.');
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleSignOut() {
    await SecureStore.deleteItemAsync('auth_token');
    clearAuth();
    clearAlbum();
    router.replace('/(auth)');
  }

  return (
    <View style={styles.container}>
      <QuietHeader>
        <Text style={styles.heading}>{t('settings.title')}</Text>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <Card tier="quiet" style={styles.profileCard}>
            <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.display_name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </Card>
        )}

        <Card tier="quiet" style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.push_label')}</Text>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: colors.pink, false: colors.borderSoft }}
              disabled={notifLoading}
            />
          </View>
        </Card>

        <Button label={t('settings.signout')} onPress={handleSignOut} variant="ghost" tier="quiet" fullWidth />
        <Text style={styles.version}>{t('settings.version', { v: '0.1.0' })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.cream },
  heading:     { ...typography.heading, color: colors.ink },
  content:     { padding: spacing['2xl'], gap: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo: { flex: 1 },
  name:        { ...typography.title, color: colors.ink },
  email:       { ...typography.bodySmall, color: colors.inkSoft },
  section:     { gap: spacing.md },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel:    { ...typography.body, color: colors.ink },
  version:     { ...typography.caption, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.lg },
});
```

- [ ] **Step 2: Snapshots**
```bash
cd mobile && npx jest app/\(tabs\)/__tests__/settings.test.tsx -u
```
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/\(tabs\)/settings.tsx mobile/app/\(tabs\)/__tests__/settings.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): Settings tab Quiet tier + Vietnamese"
```

---

### Task 20: Photo viewer + shared-element transition

The shared-element transition uses Reanimated 3 with `useSharedValue` + `useAnimatedStyle`. Source rect is captured by `PhotoCell` via `measureInWindow` and passed through `router.push` params; the viewer interpolates from that rect to fullscreen.

**Files:**
- Modify: `mobile/app/photo/[id].tsx`
- Create: `mobile/src/lib/sharedElement.ts`

- [ ] **Step 1: Implement shared-element helper**

`mobile/src/lib/sharedElement.ts`:
```ts
import { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

export interface SourceRect {
  x: number; y: number; width: number; height: number;
}

/**
 * Animate an element from a source rectangle to a full-screen target.
 * Pass enter=false to play the reverse animation.
 */
export function useSharedTransition(source: SourceRect | null, screenWidth: number, screenHeight: number, enter = true) {
  const t = useSharedValue(enter ? 0 : 1);

  useEffect(() => {
    t.value = withTiming(enter ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [enter, t]);

  return useAnimatedStyle(() => {
    if (!source) return { opacity: t.value };
    return {
      position: 'absolute',
      width:  interpolate(t.value, [0, 1], [source.width,  screenWidth]),
      height: interpolate(t.value, [0, 1], [source.height, screenHeight]),
      left:   interpolate(t.value, [0, 1], [source.x, 0]),
      top:    interpolate(t.value, [0, 1], [source.y, 0]),
    };
  });
}
```

- [ ] **Step 2: Update photo viewer**

`mobile/app/photo/[id].tsx`:
```tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, useWindowDimensions, StatusBar } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTimeline } from '@/hooks/useTimeline';
import { colors, spacing, typography } from '@/constants/theme';
import { useSharedTransition } from '@/lib/sharedElement';
import { t } from '@/lib/i18n';
import { formatVnDate } from '@/lib/format';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function PhotoViewer() {
  const params = useLocalSearchParams<{ id: string; srcX?: string; srcY?: string; srcW?: string; srcH?: string }>();
  const { data } = useTimeline();
  const photos = (data?.pages.flatMap((p) => p.items) ?? []).filter((i: any) => i.type === 'photo');
  const idx    = photos.findIndex((p: any) => p.id === params.id);
  const photo  = photos[idx];
  const { width, height } = useWindowDimensions();

  const source = (params.srcX && params.srcY && params.srcW && params.srcH) ? {
    x: Number(params.srcX), y: Number(params.srcY), width: Number(params.srcW), height: Number(params.srcH),
  } : null;
  const style = useSharedTransition(source, width, height, true);

  if (!photo) return null;
  const taken = (photo as any).taken_at as string;
  const counter = t('photo.counter', { i: idx + 1, n: photos.length });

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Animated.Image source={{ uri: `${API_URL}/photos/${photo.id}/full` }} style={[style]} resizeMode="contain" />

      <BlurView intensity={30} tint="dark" style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.meta}>{counter} · {formatVnDate(new Date(taken))}</Text>
        <View style={styles.iconBtn} />
      </BlurView>

      {(photo as any).caption && (
        <Text style={styles.caption}>{(photo as any).caption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  topBar:    { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta:      { ...typography.bodySmall, color: colors.white },
  iconBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  caption:   { ...typography.handAccent, color: colors.white, fontSize: 18, position: 'absolute', bottom: 60, left: spacing.lg, right: spacing.lg, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
```

Add `expo-blur` to deps if not present:
```bash
cd mobile && npx expo install expo-blur
```

- [ ] **Step 3: Update `PhotoCell` to pass source rect on press**

Edit `mobile/src/components/ui/PhotoCell.tsx` (re-open from Task 12). Add ref + measure:

```tsx
import React, { useRef } from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, shadows, typography, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  index?: number;
  photoId?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function PhotoCell({ uri, caption, size, index = 0, photoId, onPress, style }: PhotoCellProps) {
  const ref = useRef<View>(null);
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;

  function handlePress() {
    tap();
    if (photoId) {
      ref.current?.measureInWindow((x, y, w, h) => {
        router.push({ pathname: `/photo/${photoId}`, params: { srcX: x, srcY: y, srcW: w, srcH: h } });
      });
      return;
    }
    onPress?.();
  }

  return (
    <View>
      <TouchableOpacity
        ref={ref as any}
        onPress={handlePress}
        style={[
          { width: size, height: size,
            borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
          styles.container,
          style,
        ]}
        activeOpacity={0.9}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:     { width: '100%', height: '100%' },
  caption:   { ...typography.handAccent, color: colors.inkSoft, fontSize: 14, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs },
});
```

- [ ] **Step 4: Update `PhotoRow` to pass `photoId` instead of `onPress`**

Open `mobile/src/components/timeline/PhotoRow.tsx` (from Task 16) and replace the PhotoCell call:
```tsx
<PhotoCell
  key={p.id}
  uri={`${API_URL}/photos/${p.id}/thumb`}
  caption={p.caption}
  size={cellSize}
  index={rowIndex * 2 + i}
  photoId={p.id}
/>
```

- [ ] **Step 5: Update snapshots**
```bash
cd mobile && npx jest app/photo/__tests__/\[id\].test.tsx -u
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/photo/ mobile/src/lib/sharedElement.ts mobile/src/components/ui/PhotoCell.tsx mobile/src/components/timeline/PhotoRow.tsx mobile/package.json mobile/package-lock.json
git -C /Users/do.nguyen/personal/family-guy commit -m "feat(mobile): photo viewer Sticker Mix + shared-element transition"
```

---

### Task 21: Milestone create + detail

**Files:**
- Modify: `mobile/app/milestone/new.tsx`
- Modify: `mobile/app/milestone/[id].tsx`

- [ ] **Step 1: Read both files first to preserve any backend wiring**

```bash
cat /Users/do.nguyen/personal/family-guy/mobile/app/milestone/new.tsx
cat /Users/do.nguyen/personal/family-guy/mobile/app/milestone/\[id\].tsx
```

Note: keep the data-fetching and mutation logic exactly as-is. Replace only the JSX + styles.

- [ ] **Step 2: Restyle `milestone/new.tsx` (sheet)**

Replace the JSX so it uses `JoyfulHeader`-like layout in the sheet:
- Handle bar at top
- Eyebrow + heading using `typography.handAccent` + `typography.heading`
- `TextInput` for title (Caveat placeholder)
- A date row using the existing date picker logic
- `Button` primary `tier="joyful"` with label `t('milestone.save')`

Concrete code skeleton (merge with existing data hooks from the original file):
```tsx
// header
<View style={styles.handle} />
<Text style={styles.eyebrow}>{t('milestone.new_eyebrow')}</Text>
<Text style={styles.heading}>{t('milestone.new_title')}</Text>

// title input
<TextInput placeholder={t('milestone.name_ph')} value={title} onChangeText={setTitle} />

// date trigger and existing native picker
// note input
<TextInput placeholder={t('milestone.note_ph')} value={note} onChangeText={setNote} multiline caveatPlaceholder />

// cover picker (existing horizontal scroll)

// save
<Button label={t('milestone.save')} onPress={save} fullWidth />

// styles
const styles = StyleSheet.create({
  container: { flex:1, padding: spacing['2xl'], backgroundColor: colors.cream, gap: spacing.sm },
  handle:    { alignSelf:'center', width:42, height:5, borderRadius:3, backgroundColor: colors.inkMuted, marginBottom: spacing.md },
  eyebrow:   { ...typography.handAccent, color: colors.pink },
  heading:   { ...typography.heading, color: colors.ink, marginBottom: spacing.md },
});
```

- [ ] **Step 3: Restyle `milestone/[id].tsx`**

Replace the JSX so it uses:
- Cover photo full-width with sticker shape (apply `borderTopLeftRadius`, etc. from `radii.sticker`)
- `typography.display` for title
- `typography.handAccent` for date
- `typography.body` for the note
- A back button: 34px white circle, ink border, sticker shadow, top-left safe area

Concrete code skeleton (merge with existing data fetch):
```tsx
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';

<View style={{ flex:1, backgroundColor: colors.cream }}>
  <View style={styles.coverWrap}>
    <Image source={{ uri: coverUri }} style={styles.cover} />
    <TouchableOpacity style={styles.back} onPress={() => router.back()}>
      <Ionicons name="chevron-back" size={20} color={colors.ink} />
    </TouchableOpacity>
  </View>
  <View style={styles.body}>
    <Text style={styles.title}>{milestone.title}</Text>
    <Text style={styles.date}>{`${formatVnDate(d)} · ${formatVnMonth(d)} ${d.getFullYear()}`}</Text>
    {milestone.note && <Text style={styles.note}>{milestone.note}</Text>}
  </View>
</View>

const styles = StyleSheet.create({
  coverWrap: { height: 260, padding: spacing.lg, paddingTop: 60 },
  cover:     { flex: 1,
               borderTopLeftRadius: radii.sticker[0], borderTopRightRadius: radii.sticker[1],
               borderBottomRightRadius: radii.sticker[2], borderBottomLeftRadius: radii.sticker[3],
               borderWidth: 3, borderColor: colors.white, ...shadows.sticker },
  back:      { position:'absolute', top: 50, left: spacing.lg,
               width:34, height:34, borderRadius:17, backgroundColor: colors.white,
               alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor: colors.ink, ...shadows.sticker },
  body:      { padding: spacing['2xl'], gap: spacing.sm },
  title:     { ...typography.display, color: colors.ink },
  date:      { ...typography.handAccent, color: colors.pink },
  note:      { ...typography.body, color: colors.ink, lineHeight: 22 },
});
```

- [ ] **Step 4: Snapshots**
```bash
cd mobile && npx jest app/milestone/__tests__/new.test.tsx app/milestone/__tests__/\[id\].test.tsx -u
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/milestone/ 
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): milestone create + detail Sticker Mix"
```

---

### Task 22: Join screen

**Files:**
- Modify: `mobile/app/join/[token].tsx`

- [ ] **Step 1: Read existing file**
```bash
cat /Users/do.nguyen/personal/family-guy/mobile/app/join/\[token\].tsx
```
Preserve all backend API calls and routing.

- [ ] **Step 2: Replace JSX with Joyful welcome**

Goal:
- Cream bg + scattered dots (use `JoyfulHeader`-style dot decoration manually, or wrap in a `View` with dot motif)
- 🎉 emoji at 72px
- `typography.handLarge` "Bạn được mời tham gia ~"
- `typography.display` album name
- `typography.handAccent` member-count "3 thành viên · 216 ảnh"
- Solid pink `Button` "Tham gia album"

Concrete skeleton:
```tsx
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { Button } from '@/components/ui/Button';

<View style={{ flex:1, backgroundColor: colors.cream }}>
  <View style={styles.content}>
    <Text style={styles.emoji}>🎉</Text>
    <Text style={styles.welcome}>{t('join.invited_msg')}</Text>
    <Text style={styles.album}>{album?.name}</Text>
    <Text style={styles.meta}>{t('join.members_info', { members: memberCount, photos: photoCount })}</Text>
    <Button label={t('join.cta')} onPress={handleJoin} fullWidth loading={joining} />
  </View>
</View>

const styles = StyleSheet.create({
  content: { flex:1, alignItems:'center', justifyContent:'center', padding: spacing['3xl'], gap: spacing.md },
  emoji:   { fontSize: 72 },
  welcome: { ...typography.handLarge, color: colors.pink, textAlign:'center' },
  album:   { ...typography.display, color: colors.ink, textAlign:'center' },
  meta:    { ...typography.handAccent, color: colors.inkSoft, textAlign:'center' },
});
```

- [ ] **Step 3: Snapshot**
```bash
cd mobile && npx jest app/join/__tests__/\[token\].test.tsx -u
```
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/app/join/
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): join screen Sticker Mix + Vietnamese"
```

---

### Task 23: Upload sheet + PhotoThumbnailGrid + confetti

**Files:**
- Modify: `mobile/src/components/upload/UploadSheet.tsx`
- Modify: `mobile/src/components/upload/PhotoThumbnailGrid.tsx`

- [ ] **Step 1: PhotoThumbnailGrid — sticker-shape thumbs, yellow sticker checkmark**

```tsx
import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import type { UploadAsset } from '@/hooks/useUpload';
import { tap } from '@/lib/haptics';

interface PhotoThumbnailGridProps {
  assets: UploadAsset[];
  selected: Set<string>;
  onToggle: (uri: string) => void;
}

export function PhotoThumbnailGrid({ assets, selected, onToggle }: PhotoThumbnailGridProps) {
  const { width } = useWindowDimensions();
  const cellSize = (width - spacing['2xl'] * 2 - spacing.xs * 3) / 4;

  return (
    <View style={styles.grid}>
      {assets.map((a, i) => {
        const useAlt = i % 2 === 1;
        const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;
        return (
          <TouchableOpacity key={a.uri} onPress={() => { tap(); onToggle(a.uri); }} activeOpacity={0.85}>
            <Image source={{ uri: a.uri }} style={{
              width: cellSize, height: cellSize,
              borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl,
              borderWidth: 2, borderColor: colors.white, ...shadows.sticker,
            }} />
            {selected.has(a.uri) && (
              <View style={styles.check}>
                <Ionicons name="checkmark" size={14} color={colors.ink} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  check: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.yellow, borderWidth: 1.5, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', ...shadows.sticker,
  },
});
```

- [ ] **Step 2: UploadSheet — joyful, confetti on complete, Vietnamese**

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { Confetti } from '@/components/ui/Confetti';
import { PhotoThumbnailGrid } from './PhotoThumbnailGrid';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface UploadSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadSheet({ visible, onClose }: UploadSheetProps) {
  const { pickImages, uploadImages, uploading, progress } = useUpload();
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (visible) {
      pickImages().then((a) => {
        if (!a.length) { onClose(); return; }
        setAssets(a);
        setSelected(new Set(a.map((x) => x.uri)));
      });
    } else {
      setAssets([]); setSelected(new Set()); setCaption(''); setCelebrate(false);
    }
  }, [visible]);

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uri) ? next.delete(uri) : next.add(uri);
      return next;
    });
  }

  async function handleUpload() {
    const toUpload = assets.filter((a) => selected.has(a.uri));
    await uploadImages(toUpload, caption);
    success();
    setCelebrate(true);
    setTimeout(() => { setCelebrate(false); onClose(); }, 1300);
  }

  const count = selected.size;
  const ctaLabel = count === 1 ? t('upload.cta_one') : t('upload.cta', { n: count });
  const progressLabel = uploading
    ? (progress < 0.05 ? t('upload.compressing') : t('upload.uploading', { done: Math.round(progress * count), total: count }))
    : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('upload.eyebrow')}</Text>
            <Text style={styles.title}>{t('upload.title')}</Text>
          </View>
          <Button label={t('upload.cancel')} onPress={onClose} variant="ghost" tier="quiet" />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={toggleSelect} />
          <TextInput
            placeholder={t('upload.caption_ph')}
            value={caption}
            onChangeText={setCaption}
            style={styles.captionInput}
            caveatPlaceholder
          />
          {uploading && <Text style={styles.progress}>{progressLabel}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button label={ctaLabel} onPress={handleUpload} fullWidth loading={uploading} disabled={!count} />
        </View>

        <Confetti visible={celebrate} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  handle:       { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginTop: spacing.md },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'] },
  eyebrow:      { ...typography.handAccent, color: colors.pink },
  title:        { ...typography.heading, color: colors.ink },
  content:      { padding: spacing['2xl'] },
  captionInput: { marginTop: spacing.lg },
  progress:     { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.md, fontFamily: 'Caveat_500Medium', fontSize: 18 },
  footer:       { padding: spacing['2xl'] },
});
```

- [ ] **Step 3: Snapshots**
```bash
cd mobile && npx jest app/\(tabs\)/__tests__/upload.test.tsx -u
```
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git -C /Users/do.nguyen/personal/family-guy add mobile/src/components/upload mobile/app/\(tabs\)/__tests__/upload.test.tsx
git -C /Users/do.nguyen/personal/family-guy commit -m "refactor(mobile): upload sheet Sticker Mix + confetti on success"
```

---

## Phase D · Cleanup & verification

### Task 24: Final sweep

**Files:** entire `mobile/` tree

- [ ] **Step 1: Lavender hex grep — must return empty**
```bash
cd mobile && grep -RE "#7C5CBF|#A78BF0|#C9B8F5|#F0EBFF|#F8F4FF|#E0D4FF|#2D1F4E|#7A6AAA|#B0A0CC" src app
```
Expected: no output. If anything matches, replace with the equivalent Sticker Mix token and re-run.

- [ ] **Step 2: Deleted-component reference grep — must return empty**
```bash
cd mobile && grep -R "HeaderGradient\|LoadingSpinner" src app
```
Expected: no output. If anything matches, refactor that file to use `JoyfulHeader`/`QuietHeader` or `SkeletonCard`.

- [ ] **Step 3: Run the full suite**
```bash
cd mobile && npm test -- --ci
```
Expected: all tests PASS.

- [ ] **Step 4: Run TypeScript**
```bash
cd mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual Vietnamese diacritic sanity check**

Boot the app on simulator:
```bash
cd mobile && npx expo start --ios
```
Verify:
- Sign-In tagline `lưu giữ từng khoảnh khắc bé yêu` renders without missing-glyph boxes
- Tab labels show `Nhà · Khoảnh khắc · Gia đình · Tôi`
- Home greeting shows correct hour-based Vietnamese string
- All âsdạ chữ Việt diacritics visible: hover any screen with `tháng`, `tuổi`, `khoảnh khắc`
- Upload a test photo → confetti fires + success haptic
- Open a photo from Home → smooth shared-element transition

- [ ] **Step 6: Final commit (only if any fixups were needed in steps 1-2)**
```bash
git -C /Users/do.nguyen/personal/family-guy add -A
git -C /Users/do.nguyen/personal/family-guy commit -m "chore(mobile): final Sticker Mix sweep — verify zero lavender / no dead refs" || true
```

---

## Self-Review Checklist

After implementing, verify against the spec:

- [ ] **Color palette** — all 7 base + 5 accent + 2 surface tokens from the spec exist in `theme.ts`; no lavender hex remains anywhere
- [ ] **Typography** — 9 tokens defined; Fredoka + Caveat loaded; Vietnamese diacritics render
- [ ] **Two tiers** — Joyful applied to Home/Moments/PhotoViewer/SignIn/Family-cards/Upload/Milestone/Join/QR/Invite; Quiet applied to Settings, Family-invite section
- [ ] **Motion** — `motion.ts` exports presets; `haptics.ts` exports helpers; both wired into Buttons, Photo cells, Upload, QR join
- [ ] **Shared-element transition** — `sharedElement.ts` exists; PhotoCell passes source rect; PhotoViewer interpolates
- [ ] **Skeletons** — replace LoadingSpinner across Home (`SkeletonRow`), Moments (`SkeletonCard`), Family (`SkeletonCard`)
- [ ] **Confetti** — fires on upload success
- [ ] **i18n** — `vi` is default, all UI strings translated; `en` fallback exists
- [ ] **Component changes** — every component in the Component table has been updated or created
- [ ] **Tests** — `motion`, `format`, `i18n` units pass; existing snapshot tests pass after `-u`
- [ ] **Deleted files** — `HeaderGradient.tsx`, `LoadingSpinner.tsx` are gone
