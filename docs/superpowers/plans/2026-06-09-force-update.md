# Force Update & OTA Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-controlled force update gate and an OTA update prompt so Daylog can block old broken app versions and silently deliver JS updates.

**Architecture:** App calls `GET /version` on startup; if current version < `minVersion` from backend, a blocking `ForceUpdateScreen` renders and the user cannot proceed. Independently, `expo-updates` checks for OTA bundles in background; when one is ready, a native Alert offers an immediate restart.

**Tech Stack:** Express (backend route), `expo-application` (read native version), `expo-updates` (OTA), `semver` (version comparison), React Native Alert + Linking (UI)

---

## File Map

**Backend (create/modify):**
- Create: `backend/src/routes/version.ts` — `GET /version` handler, reads env vars per-request
- Create: `backend/src/routes/version.test.ts` — supertest tests for the route
- Modify: `backend/src/app.ts` — mount the version route

**Mobile (install + create/modify):**
- Install: `expo-application`, `expo-updates`, `semver` in `mobile/`
- Create: `mobile/src/lib/useAppUpdate.ts` — hook + exported `checkOta()` util
- Create: `mobile/src/lib/useAppUpdate.test.ts` — jest tests for version check + OTA util
- Create: `mobile/src/components/ui/ForceUpdateScreen.tsx` — full-screen blocking UI
- Modify: `mobile/app/_layout.tsx` — integrate `useAppUpdate`, render `ForceUpdateScreen` when needed

---

## Task 1: Backend — `GET /version` route

**Files:**
- Create: `backend/src/routes/version.ts`
- Create: `backend/src/routes/version.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/routes/version.test.ts
import request from 'supertest';
const app = require('../app');

describe('GET /version', () => {
  const originalMin = process.env.MIN_APP_VERSION;
  const originalLatest = process.env.LATEST_APP_VERSION;

  afterEach(() => {
    process.env.MIN_APP_VERSION = originalMin;
    process.env.LATEST_APP_VERSION = originalLatest;
  });

  it('returns 200 with minVersion and latestVersion strings', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(typeof res.body.minVersion).toBe('string');
    expect(typeof res.body.latestVersion).toBe('string');
  });

  it('returns default 1.0.0 when env vars are not set', async () => {
    delete process.env.MIN_APP_VERSION;
    delete process.env.LATEST_APP_VERSION;
    const res = await request(app).get('/version');
    expect(res.body.minVersion).toBe('1.0.0');
    expect(res.body.latestVersion).toBe('1.0.0');
  });

  it('returns env var values when set', async () => {
    process.env.MIN_APP_VERSION = '2.3.4';
    process.env.LATEST_APP_VERSION = '3.0.0';
    const res = await request(app).get('/version');
    expect(res.body.minVersion).toBe('2.3.4');
    expect(res.body.latestVersion).toBe('3.0.0');
  });

  it('does not require Authorization header', async () => {
    const res = await request(app).get('/version');
    expect(res.status).not.toBe(401);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npx jest src/routes/version.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../app'` or 404 on GET /version.

- [ ] **Step 3: Create the version route**

```typescript
// backend/src/routes/version.ts
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    minVersion: process.env.MIN_APP_VERSION ?? '1.0.0',
    latestVersion: process.env.LATEST_APP_VERSION ?? '1.0.0',
  });
});

export default router;
```

- [ ] **Step 4: Mount the route in app.ts**

In `backend/src/app.ts`, add the import after the last route import:

```typescript
import versionRoutes from './routes/version';
```

Add the mount after `app.use('/stories', storiesRoutes);`:

```typescript
app.use('/version', versionRoutes);
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npx jest src/routes/version.test.ts --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 6: Run full backend test suite to check for regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/version.ts backend/src/routes/version.test.ts backend/src/app.ts
git commit -m "feat(backend): add GET /version endpoint for app force-update gate"
```

---

## Task 2: Mobile — Install dependencies

**Files:**
- Modify: `mobile/package.json` (via npx expo install)

- [ ] **Step 1: Install Expo-managed packages**

```bash
cd mobile && npx expo install expo-application expo-updates
```

Expected: `expo-application` and `expo-updates` added to `package.json` with Expo SDK 56-compatible versions.

- [ ] **Step 2: Install semver**

```bash
cd mobile && npm install semver
```

- [ ] **Step 3: Verify installations**

```bash
cd mobile && cat package.json | grep -E '"expo-application|expo-updates|semver'
```

Expected: three matching lines appear.

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): install expo-application, expo-updates, semver"
```

---

## Task 3: Mobile — `useAppUpdate` hook

**Files:**
- Create: `mobile/src/lib/useAppUpdate.ts`
- Create: `mobile/src/lib/useAppUpdate.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// mobile/src/lib/useAppUpdate.test.ts
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
}));
jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { api } from '@/lib/api';
import { useAppUpdate, checkOta } from '@/lib/useAppUpdate';

const mockGet = api.get as jest.Mock;
const mockCheckForUpdate = Updates.checkForUpdateAsync as jest.Mock;
const mockFetchUpdate = Updates.fetchUpdateAsync as jest.Mock;

describe('useAppUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('starts as checking', () => {
    mockGet.mockResolvedValue({ data: { minVersion: '1.0.0', latestVersion: '1.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current).toBe('checking');
  });

  it('returns ok when current version equals minVersion', async () => {
    mockGet.mockResolvedValue({ data: { minVersion: '1.0.0', latestVersion: '1.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('ok'));
  });

  it('returns ok when current version is greater than minVersion', async () => {
    mockGet.mockResolvedValue({ data: { minVersion: '0.9.0', latestVersion: '1.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('ok'));
  });

  it('returns force-update when current version is below minVersion', async () => {
    mockGet.mockResolvedValue({ data: { minVersion: '2.0.0', latestVersion: '2.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('force-update'));
  });

  it('returns ok when version check network fails (fail open)', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('ok'));
  });
});

describe('checkOta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('shows restart Alert when update is available and downloaded', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: true });
    mockFetchUpdate.mockResolvedValue(undefined);

    await checkOta();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Có bản cập nhật mới',
      'Khởi động lại để áp dụng bản mới nhất?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Để sau' }),
        expect.objectContaining({ text: 'Khởi động lại' }),
      ])
    );
  });

  it('does nothing when no update is available', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: false });

    await checkOta();

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockFetchUpdate).not.toHaveBeenCalled();
  });

  it('fails silently when checkForUpdateAsync throws', async () => {
    mockCheckForUpdate.mockRejectedValue(new Error('No updates URL'));

    await expect(checkOta()).resolves.toBeUndefined();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('calls Updates.reloadAsync when user taps Khởi động lại', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: true });
    mockFetchUpdate.mockResolvedValue(undefined);
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      const restartBtn = buttons.find((b: any) => b.text === 'Khởi động lại');
      restartBtn?.onPress();
    });

    await checkOta();

    expect(Updates.reloadAsync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/lib/useAppUpdate.test.ts --no-coverage
```

Expected: FAIL — cannot find module `@/lib/useAppUpdate`.

- [ ] **Step 3: Create the hook**

```typescript
// mobile/src/lib/useAppUpdate.ts
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import semver from 'semver';
import { api } from '@/lib/api';

export type UpdateStatus = 'checking' | 'force-update' | 'ok';

export async function checkOta(): Promise<void> {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) return;
    await Updates.fetchUpdateAsync();
    Alert.alert(
      'Có bản cập nhật mới',
      'Khởi động lại để áp dụng bản mới nhất?',
      [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Khởi động lại', onPress: () => Updates.reloadAsync() },
      ]
    );
  } catch {
    // silent — OTA is best-effort
  }
}

async function checkVersion(setStatus: (s: UpdateStatus) => void): Promise<void> {
  try {
    const { data } = await api.get<{ minVersion: string; latestVersion: string }>('/version');
    const current = Application.nativeApplicationVersion ?? '0.0.0';
    if (semver.lt(current, data.minVersion)) {
      setStatus('force-update');
    } else {
      setStatus('ok');
    }
  } catch {
    // Fail open — network error should not block the user
    setStatus('ok');
  }
}

export function useAppUpdate(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>('checking');

  useEffect(() => {
    checkVersion(setStatus);
    if (!__DEV__) checkOta();
  }, []);

  return status;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/lib/useAppUpdate.test.ts --no-coverage
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/useAppUpdate.ts mobile/src/lib/useAppUpdate.test.ts
git commit -m "feat(mobile): add useAppUpdate hook for version gate and OTA prompt"
```

---

## Task 4: Mobile — `ForceUpdateScreen` component

**Files:**
- Create: `mobile/src/components/ui/ForceUpdateScreen.tsx`

The iOS App Store URL requires the numeric App ID assigned after first App Store submission. Store it in the `EXPO_PUBLIC_APP_STORE_URL` env var (set it in `.env` and EAS secrets after submitting). The Android Play Store URL is derived from the bundle ID and can be hardcoded now.

- [ ] **Step 1: Create the component**

```tsx
// mobile/src/components/ui/ForceUpdateScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { colors, typography, spacing } from '@/constants/theme';

const STORE_URL =
  Platform.OS === 'ios'
    ? (process.env.EXPO_PUBLIC_APP_STORE_URL ?? 'https://apps.apple.com')
    : 'https://play.google.com/store/apps/details?id=com.daylog.app';

export function ForceUpdateScreen() {
  function handleUpdate() {
    Linking.openURL(STORE_URL);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={typography.display}>Cần cập nhật ứng dụng</Text>
      <Text style={[typography.body, styles.message]}>
        Phiên bản này đã cũ và không còn hoạt động được nữa.
      </Text>
      <Button label="Cập nhật ngay" onPress={handleUpdate} fullWidth />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
  message: {
    textAlign: 'center',
    color: colors.inkSoft,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors related to `ForceUpdateScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/ui/ForceUpdateScreen.tsx
git commit -m "feat(mobile): add ForceUpdateScreen component for force update gate"
```

---

## Task 5: Mobile — Wire up in `_layout.tsx`

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Add imports to `_layout.tsx`**

At the top of `mobile/app/_layout.tsx`, after the existing imports, add:

```typescript
import { useAppUpdate } from '@/lib/useAppUpdate';
import { ForceUpdateScreen } from '@/components/ui/ForceUpdateScreen';
```

- [ ] **Step 2: Call the hook inside `RootLayout`**

Inside `function RootLayout()`, after the existing `useState`/`useFonts` lines, add:

```typescript
const updateStatus = useAppUpdate();
```

- [ ] **Step 3: Update the early-return guard and add ForceUpdateScreen render**

Replace the existing early-return:

```typescript
if (!ready || !fontsLoaded) return null;
```

With:

```typescript
if (!fontsLoaded || updateStatus === 'checking') return null;
if (updateStatus === 'force-update') {
  return (
    <SafeAreaProvider>
      <ForceUpdateScreen />
    </SafeAreaProvider>
  );
}
if (!ready) return null;
```

- [ ] **Step 4: Verify the full `_layout.tsx` compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the existing layout tests**

```bash
cd mobile && npx jest app/__tests__/_layout.test.tsx --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 6: Run the full mobile test suite**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all tests pass (including new useAppUpdate tests).

- [ ] **Step 7: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile): integrate force update gate and OTA prompt into root layout"
```

---

## Post-implementation checklist

- [ ] Add `MIN_APP_VERSION` and `LATEST_APP_VERSION` to backend `.env` and production env vars (set to `1.0.0` initially)
- [ ] Add `EXPO_PUBLIC_APP_STORE_URL` to mobile `.env` after first iOS App Store submission
- [ ] Verify `expo-updates` is configured in `app.json` with an `updates.url` before running `eas update`
