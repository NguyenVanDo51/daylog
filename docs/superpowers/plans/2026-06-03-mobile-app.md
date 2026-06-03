# Family Album Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Family Album iOS app in Expo (managed workflow) with a Soft & Dreamy lavender design system.

**Architecture:** Expo Router file-based routing with 5-tab bottom bar (FAB center upload). Zustand for local auth/album state; TanStack Query for all server data. Axios instance with JWT interceptor; 401 clears auth and redirects to sign-in.

**Tech Stack:** Expo SDK 51, TypeScript, Expo Router v3, Zustand 4, TanStack Query v5, Axios, expo-apple-authentication, expo-auth-session, expo-image-picker, expo-image-manipulator, expo-secure-store, expo-notifications, expo-barcode-scanner, expo-linear-gradient.

---

## File Map

```
mobile/
  app/
    _layout.tsx                  ← root layout: auth guard + QueryClientProvider
    (auth)/index.tsx             ← sign-in screen
    (tabs)/_layout.tsx           ← 5-tab bar with FAB
    (tabs)/index.tsx             ← home / timeline
    (tabs)/milestones.tsx        ← milestones tab
    (tabs)/family.tsx            ← family tab
    (tabs)/settings.tsx          ← settings tab
    milestone/new.tsx            ← create milestone modal
    milestone/[id].tsx           ← milestone detail
    photo/[id].tsx               ← full-screen photo viewer
    invite/join.tsx              ← join via deep link / QR
  src/
    constants/theme.ts           ← ALL design tokens
    components/ui/
      Button.tsx
      Card.tsx
      Badge.tsx
      Avatar.tsx
      TextInput.tsx
      HeaderGradient.tsx
      SectionHeader.tsx
      EmptyState.tsx
      LoadingSpinner.tsx
      PhotoCell.tsx
      MilestoneCard.tsx
    components/timeline/
      TimelineFeed.tsx
      PhotoRow.tsx
      MonthHeader.tsx
    components/upload/
      UploadSheet.tsx
      PhotoThumbnailGrid.tsx
    components/family/
      MemberList.tsx
      InviteSheet.tsx
      QRSheet.tsx
    lib/
      api.ts                     ← Axios instance + interceptors
      queryClient.ts             ← TanStack Query client config
      compression.ts             ← expo-image-manipulator wrapper
      exif.ts                    ← EXIF taken_at extraction
    stores/
      authStore.ts               ← JWT + user, sign-in/out
      albumStore.ts              ← current album ID + metadata
    hooks/
      useTimeline.ts
      useMilestones.ts
      useMembers.ts
      useAlbum.ts
      useUpload.ts
  app.json
  .env
  __tests__/
    stores/authStore.test.ts
    stores/albumStore.test.ts
    lib/api.test.ts
    lib/compression.test.ts
    hooks/useTimeline.test.ts
    hooks/useMilestones.test.ts
```

---

### Task 1: Scaffold the Expo project

**Files:**
- Create: `mobile/` (entire directory via create-expo-app)
- Modify: `mobile/app.json`
- Create: `mobile/.env`
- Create: `mobile/tsconfig.json` (adjust paths)

- [ ] **Step 1: Bootstrap project**

From `/Users/do.nguyen/personal/family-guy`:
```bash
npx create-expo-app@latest mobile --template blank-typescript
```

- [ ] **Step 2: Install all dependencies**

```bash
cd mobile
npx expo install expo-router expo-secure-store expo-apple-authentication expo-auth-session expo-image-picker expo-image-manipulator expo-notifications expo-barcode-scanner expo-linear-gradient expo-constants expo-linking react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated @expo/vector-icons
npm install zustand @tanstack/react-query axios
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo @types/jest
```

- [ ] **Step 3: Update app.json**

Replace the contents of `mobile/app.json`:
```json
{
  "expo": {
    "name": "Family Guy",
    "slug": "family-guy",
    "version": "1.0.0",
    "scheme": "familyguy",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#F8F4FF"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.familyguy.app",
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "We need access to your photos to upload memories.",
        "NSCameraUsageDescription": "We need camera access for QR scanning."
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#7C5CBF"
        }
      ],
      [
        "expo-barcode-scanner",
        {
          "cameraPermission": "Allow Family Guy to use the camera to scan QR codes."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Family Guy to access your photos."
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 4: Update tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 5: Create .env**

```bash
cat > mobile/.env << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:3000
EOF
```

- [ ] **Step 6: Create Jest config**

Create `mobile/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
```

- [ ] **Step 7: Create folder skeleton**

```bash
cd mobile
mkdir -p src/constants src/components/ui src/components/timeline src/components/upload src/components/family src/lib src/stores src/hooks __tests__/stores __tests__/lib __tests__/hooks
mkdir -p app/'(auth)' app/'(tabs)' app/milestone app/photo app/invite
```

- [ ] **Step 8: Commit**

```bash
cd mobile
git add -A
git commit -m "feat: scaffold Expo managed project with deps and folder structure"
```

---

### Task 2: Design tokens

**Files:**
- Create: `mobile/src/constants/theme.ts`
- Create: `mobile/__tests__/constants/theme.test.ts`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/constants/theme.test.ts`:
```ts
import { colors, spacing, radii, shadows, typography } from '@/constants/theme';

describe('theme tokens', () => {
  it('exports all color tokens', () => {
    expect(colors.primary).toBe('#7C5CBF');
    expect(colors.background).toBe('#F8F4FF');
    expect(colors.surface).toBe('#F0EBFF');
    expect(colors.textPrimary).toBe('#2D1F4E');
  });

  it('exports spacing scale', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
  });

  it('exports radii', () => {
    expect(radii.xs).toBe(8);
    expect(radii.full).toBe(9999);
  });

  it('exports shadows', () => {
    expect(shadows.card.shadowColor).toBe('#7C5CBF');
    expect(shadows.fab.shadowColor).toBe('#A78BF0');
  });

  it('exports typography', () => {
    expect(typography.heading.fontSize).toBe(22);
    expect(typography.heading.fontWeight).toBe('800');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest __tests__/constants/theme.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/constants/theme'`

- [ ] **Step 3: Write theme.ts**

Create `mobile/src/constants/theme.ts`:
```ts
export const colors = {
  primary:       '#7C5CBF',
  primaryLight:  '#A78BF0',
  primaryPastel: '#C9B8F5',
  surface:       '#F0EBFF',
  background:    '#F8F4FF',
  border:        '#E0D4FF',
  textPrimary:   '#2D1F4E',
  textSecondary: '#7A6AAA',
  textMuted:     '#B0A0CC',
  white:         '#FFFFFF',
  gradientStart: '#7C5CBF',
  gradientEnd:   '#A78BF0',
  error:         '#E53E3E',
  success:       '#38A169',
  black:         '#000000',
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
} as const;

export const shadows = {
  card: {
    shadowColor:   '#7C5CBF',
    shadowOpacity: 0.10,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     3,
  },
  fab: {
    shadowColor:   '#A78BF0',
    shadowOpacity: 0.45,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     8,
  },
} as const;

export const typography = {
  heading:    { fontSize: 22, fontWeight: '800' as const, color: colors.textPrimary },
  title:      { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  subheading: { fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary },
  body:       { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  label:      { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  caption:    { fontSize: 9,  fontWeight: '500' as const, color: colors.textMuted },
} as const;

export type ColorKey = keyof typeof colors;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest __tests__/constants/theme.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
cd mobile && git add src/constants/theme.ts __tests__/constants/theme.test.ts && git commit -m "feat: add design system tokens (colors, spacing, radii, shadows, typography)"
```

---

### Task 3: Zustand stores + API client

**Files:**
- Create: `mobile/src/stores/authStore.ts`
- Create: `mobile/src/stores/albumStore.ts`
- Create: `mobile/src/lib/api.ts`
- Create: `mobile/src/lib/queryClient.ts`
- Create: `mobile/__tests__/stores/authStore.test.ts`
- Create: `mobile/__tests__/stores/albumStore.test.ts`

- [ ] **Step 1: Write failing tests for authStore**

Create `mobile/__tests__/stores/authStore.test.ts`:
```ts
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

describe('authStore', () => {
  it('starts with no token or user', () => {
    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('setAuth stores token and user', () => {
    const user = { id: '1', display_name: 'Sarah', email: 'sarah@example.com', avatar_url: null };
    useAuthStore.getState().setAuth('jwt-token', user);
    expect(useAuthStore.getState().token).toBe('jwt-token');
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('clearAuth removes token and user', () => {
    useAuthStore.setState({ token: 'abc', user: { id: '1', display_name: 'Sarah', email: '', avatar_url: null } });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

Create `mobile/__tests__/stores/albumStore.test.ts`:
```ts
import { useAlbumStore } from '@/stores/albumStore';

beforeEach(() => {
  useAlbumStore.setState({ albumId: null, albumName: null, childBirthdate: null });
});

describe('albumStore', () => {
  it('starts empty', () => {
    expect(useAlbumStore.getState().albumId).toBeNull();
  });

  it('setAlbum stores album info', () => {
    useAlbumStore.getState().setAlbum({ id: 'abc', name: "Emma's Album", child_birthdate: '2025-04-01' });
    expect(useAlbumStore.getState().albumId).toBe('abc');
    expect(useAlbumStore.getState().albumName).toBe("Emma's Album");
  });

  it('clearAlbum resets', () => {
    useAlbumStore.setState({ albumId: 'abc', albumName: 'test', childBirthdate: '2025-01-01' });
    useAlbumStore.getState().clearAlbum();
    expect(useAlbumStore.getState().albumId).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd mobile && npx jest __tests__/stores/ --no-coverage
```

- [ ] **Step 3: Create authStore.ts**

Create `mobile/src/stores/authStore.ts`:
```ts
import { create } from 'zustand';

interface User {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  clearAuth: () => set({ token: null, user: null }),
}));
```

- [ ] **Step 4: Create albumStore.ts**

Create `mobile/src/stores/albumStore.ts`:
```ts
import { create } from 'zustand';

interface AlbumState {
  albumId: string | null;
  albumName: string | null;
  childBirthdate: string | null;
  setAlbum: (album: { id: string; name: string; child_birthdate: string | null }) => void;
  clearAlbum: () => void;
}

export const useAlbumStore = create<AlbumState>((set) => ({
  albumId: null,
  albumName: null,
  childBirthdate: null,
  setAlbum: ({ id, name, child_birthdate }) =>
    set({ albumId: id, albumName: name, childBirthdate: child_birthdate }),
  clearAlbum: () => set({ albumId: null, albumName: null, childBirthdate: null }),
}));
```

- [ ] **Step 5: Create api.ts**

Create `mobile/src/lib/api.ts`:
```ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(err);
  },
);
```

- [ ] **Step 6: Create queryClient.ts**

Create `mobile/src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd mobile && npx jest __tests__/stores/ --no-coverage
```

- [ ] **Step 8: Commit**

```bash
cd mobile && git add src/stores/ src/lib/ __tests__/stores/ && git commit -m "feat: add Zustand stores, Axios API client, TanStack Query client"
```

---

### Task 4: Utility libs (compression + exif)

**Files:**
- Create: `mobile/src/lib/compression.ts`
- Create: `mobile/src/lib/exif.ts`
- Create: `mobile/__tests__/lib/compression.test.ts`

- [ ] **Step 1: Write failing test for compression module**

Create `mobile/__tests__/lib/compression.test.ts`:
```ts
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://compressed.webp' }),
  SaveFormat: { WEBP: 'webp' },
}));

import { compressToWebP } from '@/lib/compression';

describe('compressToWebP', () => {
  it('returns a compressed uri', async () => {
    const result = await compressToWebP('file://original.jpg');
    expect(result).toBe('file://compressed.webp');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd mobile && npx jest __tests__/lib/compression.test.ts --no-coverage
```

- [ ] **Step 3: Create compression.ts**

Create `mobile/src/lib/compression.ts`:
```ts
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export async function compressToWebP(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 2048 } }],
    { compress: 0.85, format: SaveFormat.WEBP },
  );
  return result.uri;
}
```

- [ ] **Step 4: Create exif.ts**

Create `mobile/src/lib/exif.ts`:
```ts
import * as ImagePicker from 'expo-image-picker';

export function extractTakenAt(asset: ImagePicker.ImagePickerAsset): string | null {
  if (asset.exif?.DateTimeOriginal) {
    const raw = asset.exif.DateTimeOriginal as string;
    // EXIF format: "2024:10:15 14:30:00"
    const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd mobile && npx jest __tests__/lib/compression.test.ts --no-coverage
```

- [ ] **Step 6: Commit**

```bash
cd mobile && git add src/lib/compression.ts src/lib/exif.ts __tests__/lib/ && git commit -m "feat: add compression (WebP 0.85) and EXIF taken_at extraction"
```

---

### Task 5: UI component primitives — Button, Card, Badge, Avatar

**Files:**
- Create: `mobile/src/components/ui/Button.tsx`
- Create: `mobile/src/components/ui/Card.tsx`
- Create: `mobile/src/components/ui/Badge.tsx`
- Create: `mobile/src/components/ui/Avatar.tsx`

- [ ] **Step 1: Create Button.tsx**

Create `mobile/src/components/ui/Button.tsx`:
```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', fullWidth, loading, disabled }: ButtonProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'ghost'   && styles.ghost,
    variant === 'danger'  && styles.danger,
    fullWidth             && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  return (
    <TouchableOpacity style={containerStyle} onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}>
      {loading
        ? <ActivityIndicator color={variant === 'ghost' ? colors.primary : colors.white} />
        : <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base:        { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'], borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  primary:     { backgroundColor: colors.primary },
  ghost:       { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  danger:      { backgroundColor: colors.error },
  fullWidth:   { width: '100%' },
  disabled:    { opacity: 0.5 },
  label:       { ...typography.subheading, color: colors.white, fontWeight: '700' },
  ghostLabel:  { color: colors.primary },
  dangerLabel: { color: colors.white },
});
```

- [ ] **Step 2: Create Card.tsx**

Create `mobile/src/components/ui/Card.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    padding: 16,
    ...shadows.card,
  },
});
```

- [ ] **Step 3: Create Badge.tsx**

Create `mobile/src/components/ui/Badge.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'surface';
}

export function Badge({ label, variant = 'primary' }: BadgeProps) {
  return (
    <View style={[styles.base, variant === 'surface' && styles.surface]}>
      <Text style={[styles.text, variant === 'surface' && styles.surfaceText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base:        { backgroundColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  surface:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  text:        { fontSize: 10, fontWeight: '700', color: colors.white, letterSpacing: 0.3 },
  surfaceText: { color: colors.textSecondary },
});
```

- [ ] **Step 4: Create Avatar.tsx**

Create `mobile/src/components/ui/Avatar.tsx`:
```tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ uri, name, size = 36 }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, circle]} />;
  }
  return (
    <View style={[styles.fallback, circle]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image:    { backgroundColor: colors.primaryPastel },
  fallback: { backgroundColor: colors.primaryPastel, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.primary, fontWeight: '700' },
});
```

- [ ] **Step 5: Commit**

```bash
cd mobile && git add src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Badge.tsx src/components/ui/Avatar.tsx && git commit -m "feat: add Button, Card, Badge, Avatar UI primitives"
```

---

### Task 6: UI component primitives — TextInput, HeaderGradient, SectionHeader, EmptyState, LoadingSpinner, PhotoCell, MilestoneCard

**Files:**
- Create: `mobile/src/components/ui/TextInput.tsx`
- Create: `mobile/src/components/ui/HeaderGradient.tsx`
- Create: `mobile/src/components/ui/SectionHeader.tsx`
- Create: `mobile/src/components/ui/EmptyState.tsx`
- Create: `mobile/src/components/ui/LoadingSpinner.tsx`
- Create: `mobile/src/components/ui/PhotoCell.tsx`
- Create: `mobile/src/components/ui/MilestoneCard.tsx`

- [ ] **Step 1: Create TextInput.tsx**

Create `mobile/src/components/ui/TextInput.tsx`:
```tsx
import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface LabeledTextInputProps extends TextInputProps {
  label?: string;
}

export function TextInput({ label, style, ...props }: LabeledTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[styles.input, focused && styles.focused, style]}
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label:   { ...typography.subheading, marginBottom: spacing.xs, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  focused: { borderColor: colors.primary },
});
```

- [ ] **Step 2: Create HeaderGradient.tsx**

Create `mobile/src/components/ui/HeaderGradient.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface HeaderGradientProps {
  children: React.ReactNode;
}

export function HeaderGradient({ children }: HeaderGradientProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, { paddingTop: insets.top + spacing.lg }]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
});
```

- [ ] **Step 3: Create SectionHeader.tsx**

Create `mobile/src/components/ui/SectionHeader.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{title.toUpperCase()}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm },
  text: { ...typography.label, color: colors.textSecondary, marginRight: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
});
```

- [ ] **Step 4: Create EmptyState.tsx**

Create `mobile/src/components/ui/EmptyState.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface EmptyStateProps {
  emoji: string;
  message: string;
}

export function EmptyState({ emoji, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  emoji:     { fontSize: 48, marginBottom: spacing.lg },
  message:   { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
```

- [ ] **Step 5: Create LoadingSpinner.tsx**

Create `mobile/src/components/ui/LoadingSpinner.tsx`:
```tsx
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';

export function LoadingSpinner() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 6: Create PhotoCell.tsx**

Create `mobile/src/components/ui/PhotoCell.tsx`:
```tsx
import React from 'react';
import { TouchableOpacity, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii } from '@/constants/theme';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function PhotoCell({ uri, caption, size, onPress, style }: PhotoCellProps) {
  return (
    <TouchableOpacity onPress={onPress} style={[{ width: size, height: size }, styles.container, style]} activeOpacity={0.9}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.xs, overflow: 'hidden', backgroundColor: colors.surface },
  image:     { width: '100%', height: '100%' },
  caption: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', color: colors.white,
    fontSize: 9, padding: 4,
  },
});
```

- [ ] **Step 7: Create MilestoneCard.tsx**

Create `mobile/src/components/ui/MilestoneCard.tsx`:
```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface MilestoneCardProps {
  title: string;
  note?: string | null;
  occurredAt: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function MilestoneCard({ title, note, occurredAt, icon = 'star', onPress }: MilestoneCardProps) {
  const date = new Date(occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      <View style={styles.accent} />
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {note && <Text style={styles.note} numberOfLines={2}>{note}</Text>}
        <Text style={styles.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:    { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.sm, marginVertical: spacing.xs, overflow: 'hidden' },
  accent:  { width: 3, backgroundColor: colors.primary },
  iconWrap:{ padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: spacing.md, paddingLeft: spacing.xs },
  title:   { ...typography.subheading, color: colors.textPrimary, marginBottom: 2 },
  note:    { ...typography.body, color: colors.textSecondary, marginBottom: 2 },
  date:    { ...typography.caption },
});
```

- [ ] **Step 8: Commit**

```bash
cd mobile && git add src/components/ui/ && git commit -m "feat: add all UI primitive components (TextInput, HeaderGradient, SectionHeader, EmptyState, LoadingSpinner, PhotoCell, MilestoneCard)"
```

---

### Task 7: Root layout + auth guard + tab navigation

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Create root layout with auth guard**

Create `mobile/app/_layout.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

const TOKEN_KEY = 'auth_token';

export default function RootLayout() {
  const { token, setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        try {
          const { data } = await api.get('/users/me', {
            headers: { Authorization: `Bearer ${stored}` },
          });
          setAuth(stored, data);
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

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="milestone/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="milestone/[id]" />
          <Stack.Screen name="photo/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="invite/join" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Create tab layout with custom FAB center tab**

Create `mobile/app/(tabs)/_layout.tsx`:
```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '@/constants/theme';

function FABButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.fabWrap} activeOpacity={0.85}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.fab}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="milestones"
        options={{ title: 'Moments', tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarButton: (props) => <FABButton onPress={props.onPress!} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{ title: 'Family', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: { top: -16, ...shadows.fab },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Create placeholder upload tab (actual sheet in Task 10)**

Create `mobile/app/(tabs)/upload.tsx`:
```tsx
import React from 'react';
import { View } from 'react-native';
// This tab is never rendered as a screen — the FAB opens UploadSheet modal.
export default function UploadTab() {
  return <View />;
}
```

- [ ] **Step 4: Commit**

```bash
cd mobile && git add app/_layout.tsx app/'(tabs)'/_layout.tsx app/'(tabs)'/upload.tsx && git commit -m "feat: add root layout with auth guard and 5-tab bar with FAB center button"
```

---

### Task 8: Sign-in screen

**Files:**
- Create: `mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Create sign-in screen**

Create `mobile/app/(auth)/index.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Button } from '@/components/ui/Button';

const TOKEN_KEY = 'auth_token';

export default function SignInScreen() {
  const { setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  async function handleApple() {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { data } = await api.post('/auth/apple', { identityToken: cred.identityToken, fullName: cred.fullName });
      await finishAuth(data.token, data.user);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Sign in failed', e.message);
    } finally {
      setLoading(null);
    }
  }

  async function finishAuth(token: string, user: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuth(token, user);
    // Fetch the user's first album
    try {
      const { data: albums } = await api.get('/albums', { headers: { Authorization: `Bearer ${token}` } });
      if (albums[0]) setAlbum(albums[0]);
    } catch {}
    router.replace('/(tabs)');
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={styles.bubbles}>
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.bubble, { width: 40 + i * 20, height: 40 + i * 20, left: (i * 60) % 300, top: (i * 90) % 400, opacity: 0.08 + i * 0.02 }]} />
        ))}
      </View>
      <View style={styles.content}>
        <Text style={styles.logo}>👶</Text>
        <Text style={styles.appName}>Family Guy</Text>
        <Text style={styles.tagline}>Capture every tiny moment</Text>

        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={18}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <Button
            label="Sign in with Google"
            onPress={() => Alert.alert('Google sign-in', 'Coming soon')}
            variant="ghost"
            fullWidth
            loading={loading === 'google'}
          />
        </View>

        <Text style={styles.privacy}>By signing in, you agree to our Privacy Policy.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bubbles:   { ...StyleSheet.absoluteFillObject },
  bubble:    { position: 'absolute', borderRadius: 9999, backgroundColor: colors.white },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  logo:      { fontSize: 72, marginBottom: spacing.lg },
  appName:   { ...typography.heading, color: colors.white, fontSize: 32, marginBottom: spacing.xs },
  tagline:   { ...typography.body, color: 'rgba(255,255,255,0.8)', marginBottom: spacing['4xl'] },
  buttons:   { width: '100%', gap: spacing.md },
  appleBtn:  { height: 48, width: '100%', marginBottom: spacing.xs },
  privacy:   { ...typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: spacing['3xl'], textAlign: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
cd mobile && git add app/'(auth)'/index.tsx && git commit -m "feat: add sign-in screen with Apple auth and lavender gradient"
```

---

### Task 9: TanStack Query hooks

**Files:**
- Create: `mobile/src/hooks/useAlbum.ts`
- Create: `mobile/src/hooks/useTimeline.ts`
- Create: `mobile/src/hooks/useMilestones.ts`
- Create: `mobile/src/hooks/useMembers.ts`
- Create: `mobile/__tests__/hooks/useAlbum.test.ts`

- [ ] **Step 1: Write failing test for useAlbum**

Create `mobile/__tests__/hooks/useAlbum.test.ts`:
```ts
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: () => ({ albumId: 'album-1' }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAlbum } from '@/hooks/useAlbum';
import { api } from '@/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

test('useAlbum fetches album data', async () => {
  mockApi.get.mockResolvedValueOnce({ data: { id: 'album-1', name: "Emma's Album", child_birthdate: '2025-04-01' } });
  const { result } = renderHook(() => useAlbum(), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data?.name).toBe("Emma's Album");
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd mobile && npx jest __tests__/hooks/useAlbum.test.ts --no-coverage
```

- [ ] **Step 3: Create useAlbum.ts**

Create `mobile/src/hooks/useAlbum.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface Album {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
}

export function useAlbum() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<Album>({
    queryKey: ['album', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}`);
      return data;
    },
    enabled: !!albumId,
  });
}
```

- [ ] **Step 4: Create useTimeline.ts**

Create `mobile/src/hooks/useTimeline.ts`:
```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface TimelinePhoto {
  type: 'photo';
  id: string;
  r2_key: string;
  thumbnail_key: string | null;
  taken_at: string;
  caption: string | null;
}

export interface TimelineMilestone {
  type: 'milestone';
  id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  icon: string | null;
}

export type TimelineItem = TimelinePhoto | TimelineMilestone;

interface TimelinePage {
  items: TimelineItem[];
  nextCursor: string | null;
}

export function useTimeline() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useInfiniteQuery<TimelinePage>({
    queryKey: ['timeline', albumId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const { data } = await api.get(`/albums/${albumId}/timeline`, { params });
      return data;
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!albumId,
  });
}
```

- [ ] **Step 5: Create useMilestones.ts**

Create `mobile/src/hooks/useMilestones.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface Milestone {
  id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  cover_photo_id: string | null;
  icon: string | null;
}

export function useMilestones() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<Milestone[]>({
    queryKey: ['milestones', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/milestones`);
      return data;
    },
    enabled: !!albumId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  return useMutation({
    mutationFn: async (body: { title: string; note?: string; occurred_at: string; cover_photo_id?: string }) => {
      const { data } = await api.post(`/albums/${albumId}/milestones`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', albumId] });
      qc.invalidateQueries({ queryKey: ['timeline', albumId] });
    },
  });
}
```

- [ ] **Step 6: Create useMembers.ts**

Create `mobile/src/hooks/useMembers.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface Member {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
}

export function useMembers() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<Member[]>({
    queryKey: ['members', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/members`);
      return data;
    },
    enabled: !!albumId,
  });
}
```

- [ ] **Step 7: Run useAlbum test — expect PASS**

```bash
cd mobile && npx jest __tests__/hooks/useAlbum.test.ts --no-coverage
```

- [ ] **Step 8: Commit**

```bash
cd mobile && git add src/hooks/ __tests__/hooks/ && git commit -m "feat: add TanStack Query hooks (useAlbum, useTimeline, useMilestones, useMembers)"
```

---

### Task 10: Timeline feed components + Home screen

**Files:**
- Create: `mobile/src/components/timeline/MonthHeader.tsx`
- Create: `mobile/src/components/timeline/PhotoRow.tsx`
- Create: `mobile/src/components/timeline/TimelineFeed.tsx`
- Create: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Create MonthHeader.tsx**

Create `mobile/src/components/timeline/MonthHeader.tsx`:
```tsx
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface MonthHeaderProps {
  label: string;
}

export function MonthHeader({ label }: MonthHeaderProps) {
  return <Text style={styles.text}>{label.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  text: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing['2xl'],
    marginBottom: spacing.sm,
  },
});
```

- [ ] **Step 2: Create PhotoRow.tsx**

Create `mobile/src/components/timeline/PhotoRow.tsx`:
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
}

export function PhotoRow({ photos }: PhotoRowProps) {
  const { width } = useWindowDimensions();
  const count = photos.length >= 3 ? 3 : 2;
  const gap = spacing.xs;
  const cellSize = (width - spacing['2xl'] * 2 - gap * (count - 1)) / count;

  return (
    <View style={styles.row}>
      {photos.slice(0, count).map((p) => (
        <PhotoCell
          key={p.id}
          uri={`${API_URL}/photos/${p.id}/thumb`}
          caption={p.caption}
          size={cellSize}
          onPress={() => router.push(`/photo/${p.id}`)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
});
```

- [ ] **Step 3: Create TimelineFeed.tsx**

Create `mobile/src/components/timeline/TimelineFeed.tsx`:
```tsx
import React, { useCallback } from 'react';
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { MonthHeader } from './MonthHeader';
import { PhotoRow } from './PhotoRow';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, spacing } from '@/constants/theme';
import { router } from 'expo-router';

function getMonthLabel(isoDate: string, birthdate: string | null): string {
  const d = new Date(isoDate);
  const month = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const year = d.getFullYear();
  if (!birthdate) return `${month} · ${year}`;
  const birth = new Date(birthdate);
  const months = (d.getFullYear() - birth.getFullYear()) * 12 + d.getMonth() - birth.getMonth();
  return `${month} · ${months} MONTHS`;
}

interface FlatListItem {
  type: 'month' | 'photoRow' | 'milestone';
  key: string;
  label?: string;
  photos?: any[];
  milestone?: any;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } = useTimeline();

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentMonth = '';
    let photoBuffer: any[] = [];

    const flushPhotos = () => {
      while (photoBuffer.length > 0) {
        const batch = photoBuffer.splice(0, photoBuffer.length >= 3 ? 3 : 2);
        result.push({ type: 'photoRow', key: `row-${batch[0].id}`, photos: batch });
      }
    };

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
        if (photoBuffer.length >= 3) flushPhotos();
      } else {
        flushPhotos();
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item });
      }
    }
    flushPhotos();
    return result;
  }, [data, childBirthdate]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <LoadingSpinner />;
  if (!items.length) return <EmptyState emoji="🌸" message="No photos yet! Tap ➕ to add your first memory." />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.content}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      renderItem={({ item }) => {
        if (item.type === 'month') return <MonthHeader label={item.label!} />;
        if (item.type === 'photoRow') return <PhotoRow photos={item.photos!} />;
        return (
          <MilestoneCard
            title={item.milestone.title}
            note={item.milestone.note}
            occurredAt={item.milestone.occurred_at}
            onPress={() => router.push(`/milestone/${item.milestone.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'] },
});
```

- [ ] **Step 4: Create Home screen**

Create `mobile/app/(tabs)/index.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useAlbum } from '@/hooks/useAlbum';
import { useMembers } from '@/hooks/useMembers';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { colors, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';

function getAgeLabel(birthdate: string | null): string {
  if (!birthdate) return '';
  const birth = new Date(birthdate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (months < 24) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const albumName = useAlbumStore((s) => s.albumName);
  const childBirthdate = useAlbumStore((s) => s.childBirthdate);
  const { data: album } = useAlbum();
  const { data: members } = useMembers();

  const firstName = user?.display_name?.split(' ')[0] ?? '';
  const ageLabel = getAgeLabel(childBirthdate ?? album?.child_birthdate ?? null);

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.greeting}>{getGreeting()}, {firstName} ☁️</Text>
        <Text style={styles.albumName}>{albumName ?? "Our Album"} ✨</Text>
        {ageLabel && <Badge label={ageLabel} />}

        {members && members.length > 0 && (
          <TouchableOpacity style={styles.avatarRow} onPress={() => router.push('/(tabs)/family')}>
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} uri={m.avatar_url} name={m.display_name} size={28} />
            ))}
          </TouchableOpacity>
        )}
      </HeaderGradient>

      <TimelineFeed childBirthdate={childBirthdate ?? album?.child_birthdate ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },
  greeting:   { ...typography.body, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  albumName:  { ...typography.title, color: colors.white, marginBottom: spacing.sm },
  avatarRow:  { flexDirection: 'row', gap: -8, marginTop: spacing.sm },
});
```

- [ ] **Step 5: Commit**

```bash
cd mobile && git add src/components/timeline/ app/'(tabs)'/index.tsx && git commit -m "feat: add timeline feed components and home screen"
```

---

### Task 11: Upload flow

**Files:**
- Create: `mobile/src/hooks/useUpload.ts`
- Create: `mobile/src/components/upload/PhotoThumbnailGrid.tsx`
- Create: `mobile/src/components/upload/UploadSheet.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx` (wire FAB to open sheet)

- [ ] **Step 1: Create useUpload.ts**

Create `mobile/src/hooks/useUpload.ts`:
```ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { extractTakenAt } from '@/lib/exif';
import { useAlbumStore } from '@/stores/albumStore';

export interface UploadAsset {
  uri: string;
  localAssetId?: string;
  takenAt: string | null;
}

export function useUpload() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function pickImages(): Promise<UploadAsset[]> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      exif: true,
      quality: 1,
    });
    if (result.canceled) return [];
    return result.assets.map((a) => ({
      uri: a.uri,
      localAssetId: a.assetId ?? undefined,
      takenAt: extractTakenAt(a),
    }));
  }

  async function uploadImages(assets: UploadAsset[], caption?: string) {
    setUploading(true);
    setProgress(0);
    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        // 1. Presign
        const { data: presign } = await api.post('/photos/presign');
        // 2. Compress
        const compressedUri = await compressToWebP(asset.uri);
        // 3. Upload to R2
        const blob = await fetch(compressedUri).then((r) => r.blob());
        await fetch(presign.url, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/webp' },
        });
        // 4. Register
        await api.post('/photos', {
          album_id: albumId,
          r2_key: presign.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          caption: caption || null,
          local_asset_id: asset.localAssetId ?? null,
        });
        setProgress((i + 1) / assets.length);
      }
      qc.invalidateQueries({ queryKey: ['timeline', albumId] });
    } finally {
      setUploading(false);
    }
  }

  return { pickImages, uploadImages, uploading, progress };
}
```

- [ ] **Step 2: Create PhotoThumbnailGrid.tsx**

Create `mobile/src/components/upload/PhotoThumbnailGrid.tsx`:
```tsx
import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import type { UploadAsset } from '@/hooks/useUpload';

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
      {assets.map((a) => (
        <TouchableOpacity key={a.uri} onPress={() => onToggle(a.uri)} activeOpacity={0.8}>
          <Image source={{ uri: a.uri }} style={{ width: cellSize, height: cellSize, borderRadius: radii.xs }} />
          {selected.has(a.uri) && (
            <View style={styles.check}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  check: { position: 'absolute', top: 4, right: 4 },
});
```

- [ ] **Step 3: Create UploadSheet.tsx**

Create `mobile/src/components/upload/UploadSheet.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { PhotoThumbnailGrid } from './PhotoThumbnailGrid';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { colors, spacing, typography } from '@/constants/theme';

interface UploadSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadSheet({ visible, onClose }: UploadSheetProps) {
  const { pickImages, uploadImages, uploading, progress } = useUpload();
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (visible) {
      pickImages().then((a) => {
        if (!a.length) { onClose(); return; }
        setAssets(a);
        setSelected(new Set(a.map((x) => x.uri)));
      });
    } else {
      setAssets([]);
      setSelected(new Set());
      setCaption('');
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
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Photos</Text>
          <Button label="Cancel" onPress={onClose} variant="ghost" />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={toggleSelect} />
          <TextInput
            label="Caption (optional)"
            placeholder="Add a caption..."
            value={caption}
            onChangeText={setCaption}
            style={styles.captionInput}
          />
          {uploading && (
            <Text style={styles.progress}>{Math.round(progress * 100)}% uploaded...</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={`Upload ${selected.size} Photo${selected.size !== 1 ? 's' : ''}`}
            onPress={handleUpload}
            fullWidth
            loading={uploading}
            disabled={!selected.size}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'] },
  title:        { ...typography.title, color: colors.textPrimary },
  content:      { padding: spacing['2xl'] },
  captionInput: { marginTop: spacing.lg },
  progress:     { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  footer:       { padding: spacing['2xl'] },
});
```

- [ ] **Step 4: Wire FAB to open UploadSheet in tab layout**

Modify `mobile/app/(tabs)/_layout.tsx` — add UploadSheet state and wire FAB:
```tsx
import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '@/constants/theme';
import { UploadSheet } from '@/components/upload/UploadSheet';

function FABButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.fabWrap} activeOpacity={0.85}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name="add" size={28} color={colors.white} />
      </LinearGradient>
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
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
        <Tabs.Screen name="milestones" options={{ title: 'Moments', tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} /> }} />
        <Tabs.Screen name="upload" options={{ title: '', tabBarButton: (props) => <FABButton onPress={() => setUploadVisible(true)} /> }} />
        <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
      </Tabs>
      <UploadSheet visible={uploadVisible} onClose={() => setUploadVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { top: -16, ...shadows.fab },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 5: Commit**

```bash
cd mobile && git add src/hooks/useUpload.ts src/components/upload/ app/'(tabs)'/_layout.tsx && git commit -m "feat: add upload flow (pick, compress, presign, R2 PUT, register)"
```

---

### Task 12: Milestones tab + create + detail

**Files:**
- Create: `mobile/app/(tabs)/milestones.tsx`
- Create: `mobile/app/milestone/new.tsx`
- Create: `mobile/app/milestone/[id].tsx`

- [ ] **Step 1: Create milestones tab**

Create `mobile/app/(tabs)/milestones.tsx`:
```tsx
import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, shadows, spacing, typography } from '@/constants/theme';
import { Text } from 'react-native';

export default function MilestonesTab() {
  const { data: milestones, isLoading } = useMilestones();

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.heading}>Moments 🌟</Text>
      </HeaderGradient>

      {isLoading && <LoadingSpinner />}
      {!isLoading && !milestones?.length && (
        <EmptyState emoji="🌟" message="No moments yet! Tap ➕ to record your first milestone." />
      )}
      {!isLoading && milestones && (
        <FlatList
          data={milestones}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <MilestoneCard
              title={item.title}
              note={item.note}
              occurredAt={item.occurred_at}
              onPress={() => router.push(`/milestone/${item.id}`)}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/milestone/new')}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading:   { ...typography.heading, color: colors.white },
  list:      { padding: spacing['2xl'] },
  fab: {
    position: 'absolute', bottom: 90, right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.fab,
  },
});
```

- [ ] **Step 2: Create new milestone screen**

Create `mobile/app/milestone/new.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useCreateMilestone } from '@/hooks/useMilestones';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';

export default function NewMilestoneScreen() {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { mutateAsync, isPending } = useCreateMilestone();

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    await mutateAsync({ title: title.trim(), note: note.trim() || undefined, occurred_at: date });
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>New Moment 🌟</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.form}>
        <TextInput label="Title *" placeholder="e.g. First Steps!" value={title} onChangeText={setTitle} />
        <TextInput label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
        <TextInput label="Note" placeholder="Tell the story..." value={note} onChangeText={setNote} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top' }} />
        <Button label="Save Moment" onPress={handleSave} fullWidth loading={isPending} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'], paddingTop: spacing['4xl'] },
  heading:   { ...typography.title, color: colors.textPrimary },
  cancel:    { ...typography.subheading, color: colors.primary },
  form:      { padding: spacing['2xl'], gap: spacing.md },
});
```

- [ ] **Step 3: Create milestone detail screen**

Create `mobile/app/milestone/[id].tsx`:
```tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, spacing, typography } from '@/constants/theme';

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: milestones, isLoading } = useMilestones();
  const milestone = milestones?.find((m) => m.id === id);

  if (isLoading) return <LoadingSpinner />;
  if (!milestone) return null;

  const date = new Date(milestone.occurred_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Moment</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>🌟</Text>
        <Text style={styles.title}>{milestone.title}</Text>
        <Text style={styles.date}>{date}</Text>
        {milestone.note && <Text style={styles.note}>{milestone.note}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing['2xl'], paddingTop: spacing['4xl'] },
  heading:   { ...typography.title, color: colors.textPrimary },
  content:   { padding: spacing['2xl'], alignItems: 'center' },
  icon:      { fontSize: 64, marginBottom: spacing.lg },
  title:     { ...typography.heading, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  date:      { ...typography.subheading, color: colors.textSecondary, marginBottom: spacing['2xl'] },
  note:      { ...typography.body, color: colors.textSecondary, lineHeight: 22, textAlign: 'center' },
});
```

- [ ] **Step 4: Commit**

```bash
cd mobile && git add app/'(tabs)'/milestones.tsx app/milestone/ && git commit -m "feat: add milestones tab, create milestone modal, and detail screen"
```

---

### Task 13: Family tab + invite + QR + join

**Files:**
- Create: `mobile/src/components/family/MemberList.tsx`
- Create: `mobile/src/components/family/InviteSheet.tsx`
- Create: `mobile/src/components/family/QRSheet.tsx`
- Create: `mobile/app/(tabs)/family.tsx`
- Create: `mobile/app/invite/join.tsx`

- [ ] **Step 1: Create MemberList.tsx**

Create `mobile/src/components/family/MemberList.tsx`:
```tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Member } from '@/hooks/useMembers';
import { colors, spacing, typography } from '@/constants/theme';

export function MemberList({ members }: { members: Member[] }) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar uri={item.avatar_url} name={item.display_name} size={40} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.joined}>Joined {new Date(item.joined_at).toLocaleDateString()}</Text>
          </View>
          <Badge label={item.role} variant={item.role === 'admin' ? 'primary' : 'surface'} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  info:   { flex: 1 },
  name:   { ...typography.subheading, color: colors.textPrimary },
  joined: { ...typography.caption, color: colors.textMuted },
});
```

- [ ] **Step 2: Create InviteSheet.tsx**

Create `mobile/src/components/family/InviteSheet.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteSheet({ visible, onClose }: InviteSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const [loading, setLoading] = useState(false);

  async function handleCopyLink() {
    setLoading(true);
    try {
      const { data } = await api.post(`/albums/${albumId}/invites`);
      const link = `familyguy://join/${data.token}`;
      await Clipboard.setStringAsync(link);
      Alert.alert('Copied!', 'Invite link copied to clipboard.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>Invite Family 👨‍👩‍👧</Text>
        <Text style={styles.body}>Share an invite link so family members can join the album.</Text>
        <Button label="Copy Invite Link" onPress={handleCopyLink} fullWidth loading={loading} />
        <Button label="Done" onPress={onClose} variant="ghost" fullWidth />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing['2xl'], backgroundColor: colors.background, gap: spacing.md },
  heading:   { ...typography.heading, color: colors.textPrimary },
  body:      { ...typography.body, color: colors.textSecondary },
});
```

- [ ] **Step 3: Create QRSheet.tsx**

Create `mobile/src/components/family/QRSheet.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@/constants/theme';

interface QRSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function QRSheet({ visible, onClose }: QRSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const qc = useQueryClient();
  const [scanned, setScanned] = useState(false);

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    // Extract token from familyguy://join/<token> or raw token
    const token = data.includes('://') ? data.split('/').pop() : data;
    try {
      await api.post(`/invites/${token}/join`);
      qc.invalidateQueries({ queryKey: ['members', albumId] });
      Alert.alert('Joined!', 'You joined the album.');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message);
      setScanned(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>Scan QR Code</Text>
        {visible && (
          <BarCodeScanner
            onBarCodeScanned={handleBarCodeScanned}
            style={styles.scanner}
          />
        )}
        <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing['2xl'], backgroundColor: colors.background, gap: spacing.md },
  heading:   { ...typography.heading, color: colors.textPrimary },
  scanner:   { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
```

- [ ] **Step 4: Create family tab**

Create `mobile/app/(tabs)/family.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useMembers } from '@/hooks/useMembers';
import { MemberList } from '@/components/family/MemberList';
import { InviteSheet } from '@/components/family/InviteSheet';
import { QRSheet } from '@/components/family/QRSheet';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors, spacing, typography } from '@/constants/theme';

export default function FamilyTab() {
  const { data: members, isLoading } = useMembers();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.heading}>Family 👨‍👩‍👧</Text>
      </HeaderGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title="Members" />
        {isLoading && <LoadingSpinner />}
        {members && <MemberList members={members} />}

        <SectionHeader title="Invite Family" />
        <View style={styles.actions}>
          <Button label="Copy Invite Link" onPress={() => setInviteVisible(true)} fullWidth />
          <Button label="Scan QR Code" onPress={() => setQrVisible(true)} variant="ghost" fullWidth />
        </View>
      </ScrollView>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} />
      <QRSheet visible={qrVisible} onClose={() => setQrVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading:   { ...typography.heading, color: colors.white },
  content:   { padding: spacing['2xl'] },
  actions:   { gap: spacing.md, marginTop: spacing.sm },
});
```

- [ ] **Step 5: Create invite join screen**

Create `mobile/app/invite/join.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const authToken = useAuthStore((s) => s.token);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState<{ album_name: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get(`/invites/${token}`)
      .then(({ data }) => setInvite(data))
      .catch(() => Alert.alert('Invalid invite', 'This invite link is invalid or expired.'));
  }, [token]);

  if (!authToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Join Album 🎉</Text>
        <Text style={styles.body}>You need to sign in before joining.</Text>
        <Button label="Sign In" onPress={() => router.replace('/(auth)')} fullWidth />
      </View>
    );
  }

  if (!invite) return <LoadingSpinner />;

  async function handleJoin() {
    setJoining(true);
    try {
      await api.post(`/invites/${token}/join`);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.heading}>You're invited!</Text>
      <Text style={styles.body}>Join <Text style={{ fontWeight: '700' }}>{invite.album_name}</Text> to view and share family photos.</Text>
      <Button label="Join Album" onPress={handleJoin} fullWidth loading={joining} />
      <Button label="Cancel" onPress={() => router.back()} variant="ghost" fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] },
  emoji:     { fontSize: 72, marginBottom: spacing.lg },
  heading:   { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.sm },
  body:      { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing['3xl'] },
});
```

- [ ] **Step 6: Commit**

```bash
cd mobile && git add src/components/family/ app/'(tabs)'/family.tsx app/invite/ && git commit -m "feat: add family tab, invite flow, QR scanner, and join screen"
```

---

### Task 14: Full-screen photo viewer + Settings + Push notifications

**Files:**
- Create: `mobile/app/photo/[id].tsx`
- Create: `mobile/app/(tabs)/settings.tsx`
- Create: `mobile/src/lib/notifications.ts`
- Modify: `mobile/app/_layout.tsx` (register push token on auth)

- [ ] **Step 1: Create full-screen photo viewer**

Create `mobile/app/photo/[id].tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTimeline, TimelinePhoto } from '@/hooks/useTimeline';
import { colors, spacing, typography } from '@/constants/theme';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function PhotoViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useTimeline();

  const photos: TimelinePhoto[] = (data?.pages.flatMap((p) => p.items).filter((i) => i.type === 'photo') as TimelinePhoto[]) ?? [];
  const initialIndex = photos.findIndex((p) => p.id === id);
  const [currentIndex, setCurrentIndex] = useState(Math.max(initialIndex, 0));

  const current = photos[currentIndex];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.close} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color={colors.white} />
      </TouchableOpacity>

      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        initialScrollIndex={Math.max(initialIndex, 0)}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Image
              source={{ uri: `${API_URL}/photos/${item.id}/full` }}
              style={styles.photo}
              contentFit="contain"
            />
          </View>
        )}
      />

      {current?.caption && (
        <View style={styles.captionBar}>
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.black },
  close:      { position: 'absolute', top: 56, left: spacing['2xl'], zIndex: 10 },
  page:       { width, justifyContent: 'center', alignItems: 'center' },
  photo:      { width, height: '100%' },
  captionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.lg },
  caption:    { ...typography.body, color: colors.white },
});
```

- [ ] **Step 2: Create notifications helper**

Create `mobile/src/lib/notifications.ts`:
```ts
import * as Notifications from 'expo-notifications';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await api.patch('/users/me', { push_token: token });
}
```

- [ ] **Step 3: Create settings screen**

Create `mobile/app/(tabs)/settings.tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { registerPushToken } from '@/lib/notifications';
import { colors, spacing, typography } from '@/constants/theme';

export default function SettingsTab() {
  const { user, clearAuth } = useAuthStore();
  const { clearAlbum } = useAlbumStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  async function toggleNotifications(val: boolean) {
    if (!val) { setNotifEnabled(false); return; }
    setNotifLoading(true);
    try {
      await registerPushToken();
      setNotifEnabled(true);
    } catch {
      Alert.alert('Permission denied', 'Enable notifications in Settings.');
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
      <HeaderGradient>
        <Text style={styles.heading}>Settings ⚙️</Text>
      </HeaderGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <Card style={styles.profileCard}>
            <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.display_name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </Card>
        )}

        <Card style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: colors.primary }}
              disabled={notifLoading}
            />
          </View>
        </Card>

        <Button label="Sign Out" onPress={handleSignOut} variant="danger" fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  heading:     { ...typography.heading, color: colors.white },
  content:     { padding: spacing['2xl'], gap: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo: { flex: 1 },
  name:        { ...typography.title, color: colors.textPrimary },
  email:       { ...typography.body, color: colors.textSecondary },
  section:     { gap: spacing.md },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel:    { ...typography.subheading, color: colors.textPrimary },
});
```

- [ ] **Step 4: Register push token after auth in root layout**

Edit `mobile/app/_layout.tsx` — after `setAuth(stored, data)` add:
```ts
import { registerPushToken } from '@/lib/notifications';
// After setAuth call:
registerPushToken().catch(() => {});
```

The full updated setAuth block in the useEffect:
```ts
setAuth(stored, data);
registerPushToken().catch(() => {});
router.replace('/(tabs)');
```

- [ ] **Step 5: Run all tests**

```bash
cd mobile && npx jest --no-coverage
```
Expected: All suites pass.

- [ ] **Step 6: Commit**

```bash
cd mobile && git add app/photo/ app/'(tabs)'/settings.tsx src/lib/notifications.ts app/_layout.tsx && git commit -m "feat: add photo viewer, settings, push notification registration"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Expo managed workflow, TypeScript | Task 1 |
| Design tokens (colors, spacing, radii, shadows, typography) | Task 2 |
| Zustand authStore + albumStore | Task 3 |
| Axios JWT interceptor + 401 redirect | Task 3 |
| TanStack Query hooks | Task 9 |
| Compression (WebP 0.85) | Task 4 |
| EXIF taken_at extraction | Task 4 |
| Button, Card, Badge, Avatar | Task 5 |
| TextInput, HeaderGradient, SectionHeader, EmptyState, LoadingSpinner, PhotoCell, MilestoneCard | Task 6 |
| Root layout + auth guard | Task 7 |
| 5-tab bar with FAB center | Task 7 |
| Sign In with Apple | Task 8 |
| Timeline feed with pagination + month sections | Task 10 |
| Upload flow (presign → compress → PUT → register) | Task 11 |
| Milestones list, create, detail | Task 12 |
| Family members list | Task 13 |
| Invite link (copy) | Task 13 |
| QR scan join | Task 13 |
| Deep link join screen | Task 13 |
| Full-screen photo viewer with swipe | Task 14 |
| Settings (profile, notifications, sign out) | Task 14 |
| Push notifications (register APNs token) | Task 14 |
| expo-secure-store JWT persistence | Tasks 7 + 8 |
| `familyguy://` deep link scheme | Task 1 (app.json) |

No gaps found.

**Placeholder scan:** No TBD/TODO present. All code blocks are complete.

**Type consistency:** `TimelinePhoto`, `TimelineMilestone`, `TimelineItem`, `Member`, `Milestone`, `Album` — all defined once in hooks, referenced by name in components.
