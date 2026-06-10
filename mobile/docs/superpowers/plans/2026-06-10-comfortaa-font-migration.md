# Comfortaa Font Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Fredoka font with Comfortaa across the mobile app for a softer, more feminine feel.

**Architecture:** Single font swap — install `@expo-google-fonts/comfortaa`, remove unused font packages, update the `useFonts` call in the root layout, and replace the four font family name strings in `theme.ts`. All components reference `theme.fonts.*` so no component files need to change.

**Tech Stack:** Expo SDK 56, `@expo-google-fonts/comfortaa`, React Native

---

### Task 1: Install Comfortaa and remove unused font packages

**Files:**
- Modify: `package.json` (via npm commands)

- [ ] **Step 1: Install Comfortaa**

Run from `mobile/`:
```bash
npx expo install @expo-google-fonts/comfortaa
```
Expected: package added to `node_modules/@expo-google-fonts/comfortaa` with weights 300–700.

- [ ] **Step 2: Remove Fredoka and Caveat**

Run from `mobile/`:
```bash
npm uninstall @expo-google-fonts/fredoka @expo-google-fonts/caveat
```
Expected: both packages removed from `node_modules` and `package.json`.

- [ ] **Step 3: Verify package.json**

Confirm `package.json` no longer contains `@expo-google-fonts/fredoka` or `@expo-google-fonts/caveat`, and does contain `@expo-google-fonts/comfortaa`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace fredoka/caveat with comfortaa font package"
```

---

### Task 2: Update font loading in root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Replace the import line**

In `app/_layout.tsx`, replace line 10:
```ts
// Before
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';

// After
import { useFonts, Comfortaa_400Regular, Comfortaa_500Medium, Comfortaa_600SemiBold, Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';
```

- [ ] **Step 2: Replace the useFonts call**

In `app/_layout.tsx`, replace lines 35–40:
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

- [ ] **Step 3: Verify no Fredoka references remain**

```bash
grep -r "Fredoka\|fredoka\|Caveat\|caveat" mobile/app/ mobile/src/
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: load Comfortaa font weights in root layout"
```

---

### Task 3: Update font family names in theme

**Files:**
- Modify: `src/constants/theme.ts`

- [ ] **Step 1: Replace font family strings**

In `src/constants/theme.ts`, replace lines 74–79:
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

- [ ] **Step 2: Verify no Fredoka references remain anywhere**

```bash
grep -r "Fredoka\|fredoka\|Caveat\|caveat" mobile/app/ mobile/src/
```
Expected: no output.

- [ ] **Step 3: Start Metro and visually verify**

```bash
npx expo start --clear
```

Open the app in simulator or device. Check that:
- Text renders in the rounded Comfortaa style (not Fredoka's chunkier rounded style)
- Vietnamese diacritics (ắ, ề, ộ, etc.) render correctly across screens
- No "unrecognized font family" warnings in Metro output

- [ ] **Step 4: Commit**

```bash
git add src/constants/theme.ts
git commit -m "feat: switch app font to Comfortaa"
```
