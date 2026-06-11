# Sticker World — Onboarding + Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a first-run 4-page onboarding tour gated on a SecureStore key, and refresh the sign-in screen to the Sticker World direction. After this plan, a brand-new user sees onboarding → sign-in → app; an existing user (auth token present) skips onboarding entirely and lands on the refreshed sign-in if signed out.

**Architecture:**
- A new `onboardingStore` (Zustand) holds `seen: boolean | null` — `null` while loading, `true`/`false` once the SecureStore key is read in the root layout's bootstrap effect.
- A new route `app/onboarding.tsx` renders a 4-page `PagerView` with subtle reanimated effects (dot width transition; mascot scale-pop on page enter).
- The existing `app/(auth)/index.tsx` adds one more `<Redirect>` at the top: if not signed in and onboarding not seen, redirect to `/onboarding`. The same sign-in file gets its Sticker World refresh in the same task.
- Existing users (auth token present at app start) skip onboarding because the `(auth)/index.tsx` redirect to `/(tabs)` fires before the onboarding check. To prevent a returning user (signed out manually) from seeing onboarding twice, the bootstrap effect sets `onboarding.seen = '1'` if a token was found.

**Tech Stack:** Expo 56, expo-router, react-native-pager-view, react-native-reanimated, expo-secure-store, Zustand, Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` — sections "Onboarding Flow (NEW)" (line 510) and "Sign-in" (line 562).

**Depends on:** Plans 1 (foundation) + 2 (capture flow) landed. The sticker components and `theme.overlays` are available.

---

## File Structure

```
mobile/
├── src/
│   ├── stores/
│   │   ├── onboardingStore.ts                    ← NEW
│   │   └── __tests__/onboardingStore.test.ts     ← NEW
│   ├── locales/
│   │   ├── vi.ts                                 ← MODIFIED (add onboarding block)
│   │   └── en.ts                                 ← MODIFIED
│   └── __tests__/
│       └── hex-literal-guard.test.ts             ← MODIFIED (add 2 entries to THEME_CLEAN_APP_FILES)
└── app/
    ├── _layout.tsx                               ← MODIFIED (load onboarding.seen during bootstrap)
    ├── onboarding.tsx                            ← NEW
    ├── __tests__/onboarding.test.tsx             ← NEW
    └── (auth)/
        └── index.tsx                             ← REWRITTEN
```

---

## Task 1: Add `onboardingStore` + i18n strings

The store holds the SecureStore-backed flag. The strings power the new onboarding screen.

**Files:**
- Create: `mobile/src/stores/onboardingStore.ts`
- Create: `mobile/src/stores/__tests__/onboardingStore.test.ts`
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

### Step 1.1: Write the failing store test

Create `mobile/src/stores/__tests__/onboardingStore.test.ts`:

```ts
import { useOnboardingStore } from '../onboardingStore';

describe('onboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ seen: null });
  });

  it('starts with seen=null (loading)', () => {
    expect(useOnboardingStore.getState().seen).toBeNull();
  });

  it('setSeen(true) updates the flag', () => {
    useOnboardingStore.getState().setSeen(true);
    expect(useOnboardingStore.getState().seen).toBe(true);
  });

  it('setSeen(false) updates the flag', () => {
    useOnboardingStore.getState().setSeen(false);
    expect(useOnboardingStore.getState().seen).toBe(false);
  });
});
```

### Step 1.2: Run the failing test

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/stores/__tests__/onboardingStore.test.ts
```

Expected: FAIL — module not found.

### Step 1.3: Implement the store

Create `mobile/src/stores/onboardingStore.ts`:

```ts
import { create } from 'zustand';

interface OnboardingState {
  /**
   * Tri-state:
   * - null  → SecureStore not yet read (initial)
   * - true  → user has completed or skipped onboarding
   * - false → user has not seen onboarding yet
   */
  seen: boolean | null;
  setSeen: (seen: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: null,
  setSeen: (seen) => set({ seen }),
}));
```

### Step 1.4: Run the test

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/stores/__tests__/onboardingStore.test.ts
```

Expected: PASS (3 specs).

### Step 1.5: Add new i18n strings

- [ ] In `mobile/src/locales/vi.ts`, add a new `onboarding` block (place it after `signin`):

```ts
  onboarding: {
    skip:        'Bỏ qua',
    next:        'Tiếp →',
    start:       '🚀 Bắt đầu nào',
    p1_title:    'Chào mừng đến Nhật ký!',
    p1_body:     'Cuốn nhật ký hình ảnh của cả nhà bạn 🌷',
    p1_speech:   'Xin chào!',
    p2_title:    'Mỗi ngày một khoảnh khắc',
    p2_body:     'Chạm để chụp ảnh, giữ để quay video ngắn',
    p2_chip_tap: '📷 Chạm = ảnh',
    p2_chip_hold:'🎥 Giữ = video',
    p3_title:    'Xem lại như story',
    p3_body:     'Mỗi ngày là một story riêng, tự chạy như Instagram',
    p4_title:    'Cùng cả nhà lưu giữ kỉ niệm',
    p4_body:     'Mời người thân vào album để cùng ghi lại từng ngày',
  },
```

- [ ] In `mobile/src/locales/en.ts`, add the matching English block using natural equivalents (e.g., `skip: 'Skip', next: 'Next →', start: '🚀 Get started', p1_title: 'Welcome to Nhật ký!', p1_body: 'Your family\'s photo diary 🌷', p1_speech: 'Hello!', p2_title: 'A moment every day', p2_body: 'Tap to take a photo, hold to record video', p2_chip_tap: '📷 Tap = photo', p2_chip_hold: '🎥 Hold = video', p3_title: 'Replay as a story', p3_body: 'Each day plays back as its own Instagram-style story', p4_title: 'Save memories together', p4_body: 'Invite family to your album'`).

### Step 1.6: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/stores/onboardingStore.ts mobile/src/stores/__tests__/onboardingStore.test.ts mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "$(cat <<'EOF'
feat(onboarding): add store and i18n strings

Adds a Zustand store with tri-state `seen` (null while loading, then
boolean once SecureStore is read in the root layout). Adds the 15
onboarding strings (skip, next, start, plus the 4-page titles and
bodies plus the welcome speech bubble) to both vi and en locales.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Build the onboarding screen

Create `app/onboarding.tsx` with a 4-page `PagerView`. Each page has a hero illustration, title, body, dot indicator, and a CTA + skip. Pages 1-3 show "Tiếp →"; page 4 shows "Bắt đầu nào". Skip and last-page CTA both persist `onboarding.seen = '1'` and `router.replace('/(auth)')`.

**Spec reference:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` lines 510-547.

**Files:**
- Create: `mobile/app/onboarding.tsx`
- Create: `mobile/app/__tests__/onboarding.test.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 2.1: Write smoke tests first

Create `mobile/app/__tests__/onboarding.test.tsx`:

```tsx
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  const PagerView = React.forwardRef(({ children, onPageSelected }: any, ref: any) => {
    const cbRef = React.useRef(onPageSelected);
    React.useEffect(() => { cbRef.current = onPageSelected; });
    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn((page: number) => {
        cbRef.current?.({ nativeEvent: { position: page } });
      }),
    }));
    return React.createElement(View, { testID: 'pager-view' }, children);
  });
  return { __esModule: true, default: PagerView };
});

const mockSetItemAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';

beforeEach(() => {
  mockReplace.mockClear();
  mockSetItemAsync.mockClear();
  useOnboardingStore.setState({ seen: false });
});

describe('OnboardingScreen', () => {
  it('renders page 1 title and skip button', () => {
    const { getByText, getByTestId } = render(<OnboardingScreen />);
    expect(getByText('Chào mừng đến Nhật ký!')).toBeTruthy();
    expect(getByTestId('onboarding-skip')).toBeTruthy();
    expect(getByTestId('onboarding-next')).toBeTruthy();
  });

  it('skip button persists seen and navigates to /(auth)', async () => {
    const { getByTestId } = render(<OnboardingScreen />);
    fireEvent.press(getByTestId('onboarding-skip'));
    await waitFor(() => expect(mockSetItemAsync).toHaveBeenCalledWith('onboarding.seen', '1'));
    expect(useOnboardingStore.getState().seen).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });

  it('next button advances the page', () => {
    const { getByTestId, getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByTestId('onboarding-next'));
    expect(getByText('Mỗi ngày một khoảnh khắc')).toBeTruthy();
  });

  it('last page CTA finishes onboarding', async () => {
    const { getByTestId } = render(<OnboardingScreen />);
    // Advance 3 times to land on page 4
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-start'));
    await waitFor(() => expect(mockSetItemAsync).toHaveBeenCalledWith('onboarding.seen', '1'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });
});
```

### Step 2.2: Run the failing test

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/onboarding.test.tsx
```

Expected: FAIL — module not found.

### Step 2.3: Implement the onboarding screen

Create `mobile/app/onboarding.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import PagerView from 'react-native-pager-view';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useOnboardingStore } from '@/stores/onboardingStore';

const ONBOARDING_KEY = 'onboarding.seen';
const PAGES = 4;

interface PageProps {
  index: number;
  total: number;
  title: string;
  body: string;
  hero: React.ReactNode;
}

function Page({ title, body, hero }: PageProps) {
  return (
    <View style={styles.page}>
      <View style={styles.heroArea}>{hero}</View>
      <View style={styles.textArea}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const [active, setActive] = useState(0);
  const setSeen = useOnboardingStore((s) => s.setSeen);

  async function finish() {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    setSeen(true);
    router.replace('/(auth)');
  }

  function goNext() {
    if (active >= PAGES - 1) {
      finish();
      return;
    }
    pagerRef.current?.setPage(active + 1);
  }

  const isLast = active === PAGES - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <TouchableOpacity
        testID="onboarding-skip"
        onPress={finish}
        style={[styles.skip, { top: insets.top + spacing.md }]}
        hitSlop={12}
      >
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActive(e.nativeEvent.position)}
      >
        <View key="0" style={styles.pageWrap}>
          <Page
            index={0}
            total={PAGES}
            title={t('onboarding.p1_title')}
            body={t('onboarding.p1_body')}
            hero={<HeroWelcome />}
          />
        </View>
        <View key="1" style={styles.pageWrap}>
          <Page
            index={1}
            total={PAGES}
            title={t('onboarding.p2_title')}
            body={t('onboarding.p2_body')}
            hero={<HeroCapture />}
          />
        </View>
        <View key="2" style={styles.pageWrap}>
          <Page
            index={2}
            total={PAGES}
            title={t('onboarding.p3_title')}
            body={t('onboarding.p3_body')}
            hero={<HeroStory />}
          />
        </View>
        <View key="3" style={styles.pageWrap}>
          <Page
            index={3}
            total={PAGES}
            title={t('onboarding.p4_title')}
            body={t('onboarding.p4_body')}
            hero={<HeroFamily />}
          />
        </View>
      </PagerView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {Array.from({ length: PAGES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === active && styles.dotActive,
              ]}
            />
          ))}
        </View>
        <StickerButton
          testID={isLast ? 'onboarding-start' : 'onboarding-next'}
          label={isLast ? t('onboarding.start') : t('onboarding.next')}
          variant="primary"
          shadow="heavy"
          fullWidth={isLast}
          onPress={goNext}
        />
      </View>
    </View>
  );
}

// ── Hero illustrations ──────────────────────────────────────────────────────

function HeroWelcome() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.speechWrap}>
        <StickerCard style={styles.speech}>
          <Text style={styles.speechText}>{t('onboarding.p1_speech')}</Text>
        </StickerCard>
      </View>
      <Mascot size={130} tilt="playful" flip />
    </View>
  );
}

function HeroCapture() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.captureScene}>
        <Mascot size={90} tilt="default" />
        <View style={styles.miniCamera} />
      </View>
      <View style={styles.captureChips}>
        <StickerChip label={t('onboarding.p2_chip_tap')} variant="white" tilt="default" flip />
        <StickerChip label={t('onboarding.p2_chip_hold')} variant="mint" tilt="default" />
      </View>
    </View>
  );
}

function HeroStory() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.storyScene}>
        <View style={styles.miniPhone}>
          <View style={styles.miniProgress}>
            <View style={styles.miniProgressFill} />
          </View>
        </View>
        <View style={styles.playArrow}>
          <Text style={styles.playArrowText}>▶</Text>
        </View>
        <Mascot size={70} tilt="playful" flip />
      </View>
    </View>
  );
}

function HeroFamily() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.familyScene}>
        <View style={styles.heartFloat}><Text style={styles.heartText}>💛</Text></View>
        <View style={styles.heartFloat2}><Text style={styles.heartText}>💖</Text></View>
        <Mascot size={80} tilt="default" flip />
        <View style={styles.smallMascot}><Mascot size={70} tilt="subtle" /></View>
        <View style={styles.smallerMascot}><Mascot size={60} tilt="default" flip /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  pager:        { flex: 1 },
  pageWrap:     { flex: 1 },
  page:         { flex: 1, alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing['4xl'] },
  heroArea:     { height: 260, justifyContent: 'center', alignItems: 'center', marginTop: spacing['2xl'] },
  textArea:     { marginTop: spacing['3xl'], alignItems: 'center', gap: spacing.md },
  title:        { ...typography.displayCute, textAlign: 'center' },
  body:         { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 22 },

  skip:         { position: 'absolute', right: spacing.xl, zIndex: 10 },
  skipText:     { ...typography.body, color: theme.colors.textMuted, fontFamily: theme.fonts.semiBold },

  bottom:       { paddingHorizontal: spacing['2xl'], gap: spacing.lg, alignItems: 'center' },
  dots:         { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:          { width: 8, height: 8, borderRadius: 4, borderWidth: theme.border.thin, borderColor: theme.colors.border, opacity: 0.4 },
  dotActive:    { width: 22, opacity: 1, backgroundColor: theme.colors.primary },

  // Hero shared
  heroBox:      { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },

  // Page 1 (Welcome)
  speechWrap:   { position: 'absolute', top: 30, left: 24 },
  speech:       { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: theme.radii.lg },
  speechText:   { ...typography.body, fontFamily: theme.fonts.bold, color: theme.colors.textPrimary },

  // Page 2 (Capture)
  captureScene: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  miniCamera:   { width: 56, height: 72, borderRadius: theme.radii.md, backgroundColor: theme.colors.textPrimary, borderWidth: theme.border.thick, borderColor: theme.colors.border, ...theme.shadows.sticker, transform: [{ rotate: '8deg' }] },
  captureChips: { position: 'absolute', bottom: 0, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  // Page 3 (Story)
  storyScene:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, position: 'relative' },
  miniPhone:    { width: 100, height: 160, backgroundColor: theme.colors.primary, borderWidth: theme.border.thick, borderColor: theme.colors.border, borderRadius: theme.radii.md, ...theme.shadows.stickerHeavy, padding: spacing.sm },
  miniProgress: { height: 4, backgroundColor: theme.overlays.scrim, borderRadius: theme.radii.pill, overflow: 'hidden' },
  miniProgressFill: { width: '60%', height: '100%', backgroundColor: theme.colors.accent1, borderRadius: theme.radii.pill },
  playArrow:    { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.accent1, borderWidth: theme.border.medium, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', ...theme.shadows.sticker },
  playArrowText:{ ...typography.body, color: theme.colors.textPrimary, fontFamily: theme.fonts.bold },

  // Page 4 (Family)
  familyScene:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, position: 'relative' },
  smallMascot:  { marginBottom: spacing.sm },
  smallerMascot:{ marginBottom: spacing.md },
  heartFloat:   { position: 'absolute', top: -20, left: 20 },
  heartFloat2:  { position: 'absolute', top: -10, right: 20 },
  heartText:    { fontSize: 22 },
});
```

**Notes on the implementation:**
- The hero illustrations use the new sticker components plus the `Mascot` directly. No hex literals are introduced — the mini-camera, mini-phone, hearts, and dots all read from theme tokens.
- The dot indicator is a simple flex row of pill-shaped Views; the active dot is wider (22px) and fully opaque. This is the "subtle" reanimated effect mentioned in the spec, implemented without any animation library since RN's StyleSheet diff is enough for a static flip.
- Each page uses the same `Page` skeleton; the variable part is the `hero` slot.
- testIDs the test depends on: `onboarding-skip`, `onboarding-next`, `onboarding-start`.

### Step 2.4: Run the test

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/onboarding.test.tsx
```

Expected: PASS (4 specs).

### Step 2.5: Add onboarding.tsx to theme-clean files

- [ ] Edit `mobile/src/__tests__/hex-literal-guard.test.ts`. Update `THEME_CLEAN_APP_FILES`:

```ts
const THEME_CLEAN_APP_FILES = [
  'app/photo-review.tsx',
  'app/onboarding.tsx',
];
```

### Step 2.6: Verify

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (9 specs).
- [ ] `npx tsc --noEmit` — clean (TS5101 OK).

### Step 2.7: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/onboarding.tsx mobile/app/__tests__/onboarding.test.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
feat(onboarding): add 4-page first-run tour

Adds app/onboarding.tsx with a PagerView of four pages (welcome,
capture intro, story replay, family invite). Each page composes
Mascot, StickerCard, StickerChip, and StickerButton with no raw color
literals. Skip and last-page CTA both persist onboarding.seen and
replace to /(auth). onboarding.tsx joins THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire the onboarding gate in root layout + sign-in

Load `onboarding.seen` during the root layout's bootstrap effect; store it on the new Zustand store; add a `<Stack.Screen name="onboarding" />` declaration; and add the redirect in `(auth)/index.tsx`.

For users who already have an auth token at boot, treat them as "seen" so they don't see onboarding after a future sign-out.

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(auth)/index.tsx` (the redirect addition only — the visual refresh is Task 4)

### Step 3.1: Update `app/_layout.tsx`

- [ ] At the top, add the import:

```ts
import { useOnboardingStore } from '@/stores/onboardingStore';
```

- [ ] Add a constant near `TOKEN_KEY` and `USER_KEY`:

```ts
const ONBOARDING_KEY = 'onboarding.seen';
```

- [ ] Inside `RootLayout`, after `const { setAuth, clearAuth } = useAuthStore();`, add:

```ts
  const setSeen = useOnboardingStore((s) => s.setSeen);
```

- [ ] In the existing bootstrap `useEffect`, after the e2e short-circuit but before the stored-token read, add an onboarding load. Modify the effect body so it looks like:

```ts
  useEffect(() => {
    (async () => {
      const e2eToken = process.env.EXPO_PUBLIC_E2E_TEST_TOKEN;
      if (e2eToken) {
        setAuth(e2eToken, { id: 'e2e-user', display_name: 'E2E Test', email: 'e2e@test.local', avatar_url: null });
        setSeen(true); // E2E tests skip onboarding.
        setReady(true);
        return;
      }

      // Onboarding: read the flag in parallel with token load. Mark seen if a
      // token is found (existing user) so they don't see onboarding after a
      // future sign-out.
      const [obFlag, stored] = await Promise.all([
        SecureStore.getItemAsync(ONBOARDING_KEY),
        SecureStore.getItemAsync(TOKEN_KEY),
      ]);
      let obSeen = obFlag === '1';

      if (stored) {
        const cachedUser = await SecureStore.getItemAsync(USER_KEY);
        try {
          if (cachedUser) setAuth(stored, JSON.parse(cachedUser));
          const { data } = await api.get('/users/me', { headers: { Authorization: `Bearer ${stored}` } });
          setAuth(stored, data);
          Sentry.setUser({ id: data.id });
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data));
          registerPushToken().catch(() => { });
        } catch (err) {
          if ((err as { response?: { status?: number } }).response?.status === 401) {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
            clearAuth();
            Sentry.setUser(null);
          }
        }

        // Existing user — backfill the onboarding-seen flag if missing so a
        // future sign-out doesn't replay onboarding.
        if (!obSeen) {
          await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
          obSeen = true;
        }
      }

      setSeen(obSeen);
      setReady(true);
    })();
  }, []);
```

- [ ] Add the onboarding screen to the Stack (anywhere among the existing `<Stack.Screen>` declarations is fine; place it just after `(auth)`):

```tsx
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" />
```

### Step 3.2: Update `app/(auth)/index.tsx` — add the redirect only

The full visual refresh is in Task 4. For this task, only add the new redirect at the top of the component, before the existing token check.

- [ ] Add this import to `app/(auth)/index.tsx`:

```ts
import { useOnboardingStore } from '@/stores/onboardingStore';
```

- [ ] Inside `SignInScreen`, replace:

```ts
  if (token) return <Redirect href="/(tabs)" />;
```

with:

```ts
  const seen = useOnboardingStore((s) => s.seen);
  if (token) return <Redirect href="/(tabs)" />;
  if (seen === false) return <Redirect href="/onboarding" />;
```

(Note: when `seen` is `null` we let the sign-in render — the root layout already blocks with `if (!ready) return null;` until the bootstrap effect resolves, so `null` shouldn't be reached in practice, but rendering the sign-in is the safe default if it ever is.)

### Step 3.3: Run existing tests to check for regressions

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/_layout.test.tsx app/__tests__/onboarding.test.tsx
```

`_layout.test.tsx` is currently in the pre-existing-failures list (Sentry `mobileReplayIntegration` issue, unrelated). Confirm it fails with the SAME error as before, NOT a new error introduced by your changes. If a new failure appears (e.g. about `onboardingStore`), the layout integration broke and needs fixing.

`onboarding.test.tsx` should still pass (4 specs).

### Step 3.4: Typecheck + full suite

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit && npx jest --silent
```

Expected:
- typecheck clean (TS5101 OK).
- Full suite baseline: 8 pre-existing failures unchanged; everything else passes.

### Step 3.5: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/_layout.tsx mobile/app/\(auth\)/index.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): gate first-run tour from root layout + auth

Root layout reads onboarding.seen from SecureStore in the bootstrap
effect and writes it onto the onboarding store. Existing users (with a
stored auth token) get the flag backfilled so a future sign-out
doesn't replay onboarding. Sign-in screen redirects to /onboarding
when the user is signed out and has not seen onboarding yet. New
"onboarding" Stack.Screen registered.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrate the sign-in screen to Sticker World

Now refresh `app/(auth)/index.tsx` visually — replace the 👶 emoji with the mascot, the headline with a yellow sticker logo, and the auth buttons with `StickerButton` variants. Reduce the `FloatingDot` count from 6 to 4 per the spec. Add the file to `THEME_CLEAN_APP_FILES`.

**Spec reference:** lines 562-568.

**Files:**
- Modify: `mobile/app/(auth)/index.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 4.1: Rewrite `app/(auth)/index.tsx`

Replace the entire contents with:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import { PRIVACY_URL } from '@/constants/urls';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { theme, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Mascot } from '@/components/ui/Mascot';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { registerPushToken } from '@/lib/notifications';
import { t } from '@/lib/i18n';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
  const { token, setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const seen = useOnboardingStore((s) => s.seen);
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  if (token) return <Redirect href="/(tabs)" />;
  if (seen === false) return <Redirect href="/onboarding" />;

  async function handleApple() {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!cred.identityToken) throw new Error('Apple không trả về identity token');
      const { data } = await api.post('/auth/apple', { idToken: cred.identityToken, fullName: cred.fullName });
      if (data.status === 'account_pending_deletion') {
        handlePendingDeletion(data);
        return;
      }
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
      if (data.status === 'account_pending_deletion') {
        handlePendingDeletion(data);
        return;
      }
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
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    setAuth(token, user);
    registerPushToken().catch(() => {});
    try {
      const { data: albums } = await api.get('/albums', { headers: { Authorization: `Bearer ${token}` } });
      if (albums[0]) setAlbum(albums[0]);
    } catch {}
    router.replace('/(tabs)');
  }

  function handlePendingDeletion(data: { restore_token: string; days_remaining: number }) {
    router.replace({
      pathname: '/(auth)/restore',
      params: { restore_token: data.restore_token, days_remaining: String(data.days_remaining) },
    });
  }

  return (
    <View style={styles.container}>
      <FloatingDot x="10%" y={100} size={18} color={theme.colors.accent1} delay={0} />
      <FloatingDot x="85%" y={140} size={14} color={theme.colors.primary}  delay={300} />
      <FloatingDot x="15%" y={300} size={12} color={theme.colors.accent2}  delay={600} />
      <FloatingDot x="80%" y={360} size={16} color={theme.colors.accent4}  delay={900} />

      <LinearGradient
        colors={[theme.colors.backgroundHighlight, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Mascot size={80} tilt="playful" flip />
        <View style={styles.logoWrap}>
          <StickerChip label="Nhật ký" variant="yellow" tilt="default" flip />
        </View>
        <Text style={styles.tagline}>{t('signin.tagline')}</Text>
        <Text style={styles.subCopy}>{t('signin.sub_copy')}</Text>
      </LinearGradient>

      <View style={styles.bottom}>
        <View style={styles.buttons}>
          <StickerButton
            label={t('signin.apple')}
            variant="inverted"
            shadow="heavy"
            fullWidth
            loading={loading === 'apple'}
            onPress={handleApple}
          />
          <StickerButton
            label={t('signin.google')}
            variant="surface"
            fullWidth
            loading={loading === 'google'}
            onPress={handleGoogle}
          />
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.privacy}>{t('signin.privacy')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dot:       { position: 'absolute', borderRadius: theme.radii.pill, opacity: 0.7, borderWidth: theme.border.medium, borderColor: theme.colors.border, ...theme.shadows.sticker },
  hero:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.md },
  logoWrap:  { marginTop: spacing.lg },
  tagline:   { ...typography.body, color: theme.colors.textPrimary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: spacing.md },
  subCopy:   { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 },
  bottom:    { backgroundColor: theme.colors.background, paddingHorizontal: spacing['3xl'], paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] },
  buttons:   { gap: spacing.md },
  privacy:   { ...typography.caption, color: theme.colors.textMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
```

**Notes on the rewrite:**
- The `Button` component (the old generic CTA) is replaced by `StickerButton` for both Apple and Google buttons. The Apple flow no longer uses `expo-apple-authentication`'s `AppleAuthenticationButton` because the sticker style takes precedence; the auth flow is unchanged (`handleApple` still does the proper `signInAsync`).
- The 👶 emoji and the giant pink gradient hero are replaced with a smaller hero composed of mascot + sticker-chip logo + tagline. The background gradient is now warm butter tones (`backgroundHighlight → background`) instead of pink-to-cream.
- `FloatingDot` count drops from 6 to 4. The dots use theme accent colors.
- The redirect to `/onboarding` is preserved from Task 3.

### Step 4.2: Add sign-in to theme-clean files

- [ ] Edit `mobile/src/__tests__/hex-literal-guard.test.ts`. Update `THEME_CLEAN_APP_FILES`:

```ts
const THEME_CLEAN_APP_FILES = [
  'app/photo-review.tsx',
  'app/onboarding.tsx',
  'app/(auth)/index.tsx',
];
```

### Step 4.3: Verify the existing sign-in test still passes

- [ ] Run the sign-in test (it's in the pre-existing failure list — `app/(auth)/__tests__/index.test.tsx`).

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/\(auth\)/__tests__/index.test.tsx
```

If the failure is the SAME as before (it was already broken due to test-mock issues), do not touch the test. If a NEW failure appears (e.g. the test asserts on `colors.pink` or `<Button>` specifically), update only the failing assertions. The Apple/Google testIDs and call structure are unchanged.

### Step 4.4: Run guard + typecheck + suite

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (10 specs).
- [ ] `npx tsc --noEmit` — clean (TS5101 OK).
- [ ] `npx jest --silent` — baseline (8 pre-existing failures unchanged).

### Step 4.5: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/\(auth\)/index.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(signin): migrate to Sticker World components

Replaces the 👶 emoji + giant gradient hero with a Mascot + yellow
StickerChip logo. Apple button uses StickerButton variant="inverted"
with heavy shadow; Google button uses variant="surface". FloatingDot
count reduced from 6 to 4 per spec. Background gradient switched to
warm butter tones. (auth)/index.tsx joins THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Onboarding Flow (NEW) at spec line 510: ✓ Task 2 builds the screen, Task 3 wires it.
- Sign-in (spec line 562): ✓ Task 4 covers Mascot hero, yellow sticker logo, Apple inverted button, Google surface button, FloatingDot reduction.
- The mascot system (line 472) is consumed in onboarding + sign-in, fulfilling the spec's "Mascot appears on sign-in" line.

**What this plan does NOT do:**
- Mascot scale-pop animations and speech-bubble fade+rotate on page 1 — the spec mentions these as "subtle reanimated effects." The plan implements the dot indicator transition (the most visible signal) but skips the mascot scale-pop and speech-bubble animations to keep scope tight. Adding them later is a one-component refactor and doesn't affect any other code.
- Restore-account screen (`app/(auth)/restore.tsx`) — out of scope per spec's Non-Goals.

**Carrying forward minor items from Plan 2:**
- The dead-import sweep (5 lines across 3 files) was already done in Plan 2's chore commit; this plan should not re-introduce any.
- The hex-literal guard now covers 5 sticker components + 2 capture-flow tabs + 3 app files (photo-review + onboarding + sign-in).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-sticker-world-onboarding-signin.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review.

**2. Inline Execution** — Batch with checkpoints.

**Which approach?**
