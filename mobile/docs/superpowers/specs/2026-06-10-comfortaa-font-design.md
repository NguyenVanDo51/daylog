# Font Migration: Fredoka → Comfortaa

**Date:** 2026-06-10  
**Goal:** Replace Fredoka with Comfortaa across the mobile app for a softer, more feminine feel suited to the app's target audience (moms, girls, families).

---

## Decision

**Single font: Comfortaa** — used for all weights across the entire app. No accent/script font pairing. Comfortaa's rounded geometry reads as warm and gentle without being childish, and its full weight range (300–700) covers every typographic role in the existing theme.

---

## Changes

### 1. Install Comfortaa, remove Fredoka and Caveat

```
npx expo install @expo-google-fonts/comfortaa
npm uninstall @expo-google-fonts/fredoka @expo-google-fonts/caveat
```

Caveat was installed but never loaded or used. Both can be removed cleanly.

### 2. `app/_layout.tsx`

Replace the `useFonts` import and font map:

```ts
// Before
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';

// After
import { useFonts, Comfortaa_400Regular, Comfortaa_500Medium, Comfortaa_600SemiBold, Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';
```

Update the `useFonts` call:

```ts
// Before
const [fontsLoaded] = useFonts({
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
});

// After
const [fontsLoaded] = useFonts({
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
});
```

### 3. `src/constants/theme.ts`

Replace font family name strings in the `fonts` object:

```ts
// Before
export const fonts = {
  regular:  'Fredoka_400Regular',
  medium:   'Fredoka_500Medium',
  semiBold: 'Fredoka_600SemiBold',
  bold:     'Fredoka_700Bold',
} as const;

// After
export const fonts = {
  regular:  'Comfortaa_400Regular',
  medium:   'Comfortaa_500Medium',
  semiBold: 'Comfortaa_600SemiBold',
  bold:     'Comfortaa_700Bold',
} as const;
```

The `typography` object and all component files are unchanged — they reference `fonts.*` keys, not font family strings directly.

---

## Scope

- **In scope:** Font package swap, `_layout.tsx` font loading, `theme.ts` font names.
- **Out of scope:** Font size adjustments, spacing changes, color palette changes, new components. Comfortaa renders at a similar scale to Fredoka; no size tuning is expected.

---

## Risk

Low. All components reference `theme.fonts.*` — the font family string is defined in exactly one place (`theme.ts`). No grep-and-replace across component files is needed. The uninstall of `fredoka` and `caveat` removes unused packages with no consumers remaining.
