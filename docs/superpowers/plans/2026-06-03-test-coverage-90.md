# Test Coverage 90% Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach ≥90% line, branch, statement, and function coverage on both `backend/` and `mobile/`. Bake the threshold into jest configs so CI fails below it.

**Architecture:** Backend uses real Postgres + supertest with selected external mocks (proven pattern in existing 7 test files). Mobile uses `jest-expo` preset + `@testing-library/react-native` for components/screens, with native modules mocked per test file. Coverage gates land last, after the numbers are green.

**Tech Stack:** jest, supertest (backend), jest-expo, @testing-library/react-native, @testing-library/jest-native, MSW-style axios mocks (mobile).

---

## Baseline (measured 2026-06-03)

**Backend (76.94% stmt / 62.13% branch / 68.57% func / 83.53% line)** — gap is mostly services + a few branch holes:

| File | Stmt | Branch | Func | Line | Uncovered |
|---|---|---|---|---|---|
| src/app.js | 81 | 0 | 0 | 87 | error handler (17-18) |
| src/middleware/auth.js | 89 | 75 | 100 | 100 | 12-15 |
| src/db/client.js | 100 | 67 | 100 | 100 | SSL branch |
| src/routes/albums.js | 76 | 55 | 100 | 84 | 28-29, 46, 68, 82-86, 100 |
| src/routes/auth.js | 85 | 69 | 100 | 93 | 41, 55 |
| src/routes/invites.js | 80 | 64 | 100 | 90 | 37, 53, 78-79, 85 |
| src/routes/members.js | 93 | 100 | 100 | 93 | 27 |
| src/routes/milestones.js | 78 | 62 | 80 | 91 | 36, 52, 83, 98 |
| src/routes/photos.js | 85 | 78 | 100 | 95 | 29, 67 |
| src/routes/timeline.js | 93 | 100 | 100 | 93 | 18, 67 |
| src/services/apns.js | 15 | 0 | 0 | 17 | entire file |
| src/services/appleAuth.js | 50 | 0 | 0 | 50 | verify path |
| src/services/googleAuth.js | 50 | 0 | 0 | 50 | verify path |
| src/services/r2.js | 35 | 0 | 0 | 38 | helpers 17-32 |
| src/services/thumbnail.js | 44 | 100 | 0 | 44 | function body |
| src/services/qrcode.js | 100 | 100 | 100 | 100 | ✓ |

**Mobile** — 5 of ~43 source files have tests (theme, both stores, useAlbum, compression). Everything else is bare.

---

## File Structure: tests to create

### Backend (gap-fill — patch existing test files where possible)

| Source | Test file | Action |
|---|---|---|
| src/app.js | tests/app.test.js (new) | Cover error handler middleware |
| src/middleware/auth.js | tests/middleware.auth.test.js (new) | Cover invalid/missing tokens |
| src/db/client.js | tests/db.client.test.js (new) | Cover SSL config branch |
| src/services/apns.js | tests/services.apns.test.js (new) | Mock @parse/node-apn, exercise send |
| src/services/appleAuth.js | tests/services.appleAuth.test.js (new) | Mock JWKS client, exercise verify |
| src/services/googleAuth.js | tests/services.googleAuth.test.js (new) | Mock OAuth2Client |
| src/services/r2.js | tests/services.r2.test.js (new) | Mock S3Client + presigner |
| src/services/thumbnail.js | tests/services.thumbnail.test.js (new) | Real sharp on a fixture buffer |
| src/routes/albums.js | tests/albums.test.js (patch) | Add 7 branch cases |
| src/routes/auth.js | tests/auth.test.js (patch) | Add 2 branch cases |
| src/routes/invites.js | tests/invites.test.js (patch) | Add 5 branch cases |
| src/routes/milestones.js | tests/milestones.test.js (patch) | Add 4 branch cases |
| src/routes/members.js | tests/members.test.js (patch) | Add 1 branch case |
| src/routes/photos.js | tests/photos.test.js (patch) | Add 2 branch cases |
| src/routes/timeline.js | tests/timeline.test.js (patch) | Add 2 branch cases |

### Mobile (mostly new test files)

| Source | Test file |
|---|---|
| src/lib/api.ts | __tests__/lib/api.test.ts |
| src/lib/exif.ts | __tests__/lib/exif.test.ts |
| src/lib/notifications.ts | __tests__/lib/notifications.test.ts |
| src/lib/queryClient.ts | __tests__/lib/queryClient.test.ts |
| src/hooks/useMembers.ts | __tests__/hooks/useMembers.test.tsx |
| src/hooks/useMilestones.ts | __tests__/hooks/useMilestones.test.tsx |
| src/hooks/useTimeline.ts | __tests__/hooks/useTimeline.test.tsx |
| src/hooks/useUpload.ts | __tests__/hooks/useUpload.test.tsx |
| src/components/ui/Button.tsx | __tests__/components/ui/Button.test.tsx |
| src/components/ui/Avatar.tsx | __tests__/components/ui/Avatar.test.tsx |
| src/components/ui/Badge.tsx | __tests__/components/ui/Badge.test.tsx |
| src/components/ui/Card.tsx | __tests__/components/ui/Card.test.tsx |
| src/components/ui/EmptyState.tsx | __tests__/components/ui/EmptyState.test.tsx |
| src/components/ui/HeaderGradient.tsx | __tests__/components/ui/HeaderGradient.test.tsx |
| src/components/ui/LoadingSpinner.tsx | __tests__/components/ui/LoadingSpinner.test.tsx |
| src/components/ui/MilestoneCard.tsx | __tests__/components/ui/MilestoneCard.test.tsx |
| src/components/ui/PhotoCell.tsx | __tests__/components/ui/PhotoCell.test.tsx |
| src/components/ui/SectionHeader.tsx | __tests__/components/ui/SectionHeader.test.tsx |
| src/components/ui/TextInput.tsx | __tests__/components/ui/TextInput.test.tsx |
| src/components/family/InviteSheet.tsx | __tests__/components/family/InviteSheet.test.tsx |
| src/components/family/MemberList.tsx | __tests__/components/family/MemberList.test.tsx |
| src/components/family/QRSheet.tsx | __tests__/components/family/QRSheet.test.tsx |
| src/components/timeline/MonthHeader.tsx | __tests__/components/timeline/MonthHeader.test.tsx |
| src/components/timeline/PhotoRow.tsx | __tests__/components/timeline/PhotoRow.test.tsx |
| src/components/timeline/TimelineFeed.tsx | __tests__/components/timeline/TimelineFeed.test.tsx |
| src/components/upload/PhotoThumbnailGrid.tsx | __tests__/components/upload/PhotoThumbnailGrid.test.tsx |
| src/components/upload/UploadSheet.tsx | __tests__/components/upload/UploadSheet.test.tsx |
| app/(auth)/index.tsx | __tests__/screens/signIn.test.tsx |
| app/(tabs)/_layout.tsx | __tests__/screens/tabsLayout.test.tsx |
| app/(tabs)/index.tsx | __tests__/screens/timeline.test.tsx |
| app/(tabs)/family.tsx | __tests__/screens/family.test.tsx |
| app/(tabs)/milestones.tsx | __tests__/screens/milestones.test.tsx |
| app/(tabs)/upload.tsx | __tests__/screens/upload.test.tsx |
| app/(tabs)/settings.tsx | __tests__/screens/settings.test.tsx |
| app/_layout.tsx | __tests__/screens/rootLayout.test.tsx |
| app/join/[token].tsx | __tests__/screens/join.test.tsx |
| app/photo/[id].tsx | __tests__/screens/photoViewer.test.tsx |
| app/milestone/[id].tsx | __tests__/screens/milestoneDetail.test.tsx |
| app/milestone/new.tsx | __tests__/screens/milestoneNew.test.tsx |

### Config

| File | Action |
|---|---|
| backend/jest.config.js | Add coverageThreshold global ≥90 |
| mobile/jest.config.js | Add coverageThreshold global ≥90 + a `moduleNameMapper` for image/asset imports + a setup file for global native-module mocks |
| mobile/jest.setup.js | New — global mocks for expo-router, expo-secure-store, expo-notifications, expo-image, expo-image-picker, react-native-google-signin, expo-apple-authentication, expo-camera |

---

## Canonical Patterns (one per category — copy these)

### Pattern A: Backend route branch fill (patch existing test file)

```js
// adding to tests/albums.test.js
it('returns 403 when non-member fetches album', async () => {
  const owner = await createTestUser({ apple_sub: 'a' });
  const stranger = await createTestUser({ apple_sub: 'b' });
  const album = await createTestAlbum(owner.id);
  const res = await request(app).get(`/albums/${album.id}`).set(authHeader(stranger));
  expect(res.status).toBe(403);
});
```

### Pattern B: Backend service unit (mock external SDK)

```js
// tests/services.r2.test.js
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const r2 = require('../src/services/r2');

beforeEach(() => { getSignedUrl.mockResolvedValue('https://signed.example/x'); });

it('returns a signed PUT url for a key', async () => {
  const url = await r2.getUploadUrl('photos/abc.jpg', 'image/jpeg');
  expect(url).toBe('https://signed.example/x');
  expect(getSignedUrl).toHaveBeenCalledTimes(1);
});
```

### Pattern C: Mobile lib (pure logic, no native)

```ts
// __tests__/lib/api.test.ts
import { api } from '@/lib/api';

it('uses EXPO_PUBLIC_API_URL as baseURL', () => {
  expect(api.defaults.baseURL).toBeDefined();
});
```

### Pattern D: Mobile hook (with QueryClientProvider wrapper)

```tsx
// __tests__/hooks/useTimeline.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTimeline } from '@/hooks/useTimeline';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

function wrapper({ children }: any) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it('fetches timeline groups', async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: [{ month: '2025-09', photos: [] }] });
  const { result } = renderHook(() => useTimeline('album-1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(1);
});
```

### Pattern E: Mobile component (RNTL)

```tsx
// __tests__/components/ui/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

it('fires onPress when tapped', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button label="Tap me" onPress={onPress} />);
  fireEvent.press(getByText('Tap me'));
  expect(onPress).toHaveBeenCalled();
});

it('does not fire onPress while loading', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button label="Tap me" onPress={onPress} loading />);
  fireEvent.press(getByText('Tap me'));
  expect(onPress).not.toHaveBeenCalled();
});
```

### Pattern F: Mobile screen (heavy mocking, focus on logic branches)

```tsx
// __tests__/screens/signIn.test.tsx
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationButton: 'AppleButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { WHITE: 0 },
  AppleAuthenticationScope: { FULL_NAME: 'name', EMAIL: 'email' },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: (r: any) => r?.type === 'success',
  statusCodes: { SIGN_IN_CANCELLED: 'CANCELLED' },
}));
jest.mock('@/lib/api', () => ({ api: { post: jest.fn(), get: jest.fn().mockResolvedValue({ data: [] }) } }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn() }));
jest.mock('@/lib/notifications', () => ({ registerPushToken: jest.fn().mockResolvedValue(null) }));

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Apple from 'expo-apple-authentication';
import { api } from '@/lib/api';
import { router } from 'expo-router';
import SignIn from '@/../app/(auth)/index';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

it('routes to tabs after successful Google sign-in', async () => {
  (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: 'tok' } });
  (api.post as jest.Mock).mockResolvedValue({ data: { token: 'jwt', user: { id: 'u1' } } });
  const { getByText } = render(<SignIn />);
  fireEvent.press(getByText('Sign in with Google'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
});
```

---

## Phase 1: Backend gap-fill

### Task 1: Add error-handler test for app.js

**File:** `backend/tests/app.test.js` (new)

- [ ] Write a tiny route in the test that throws; assert handler returns `{error}` with err.status or 500.
- [ ] Run `npm test -- app.test.js` — passes.
- [ ] Commit: `test(backend): cover app-level error handler`

### Task 2: Add middleware/auth.js tests

**File:** `backend/tests/middleware.auth.test.js` (new)

Cases to cover (lines 12-15 = the 401 paths):
- [ ] No Authorization header → 401
- [ ] Malformed header (no Bearer) → 401
- [ ] Invalid JWT signature → 401
- [ ] Valid JWT → next() called, req.userId set

Mount a tiny test app that uses `authRequired` on a `/probe` route returning `req.userId`. Run + commit.

### Task 3: Cover SSL branch in db/client.js

**File:** `backend/tests/db.client.test.js` (new)

- [ ] With `DATABASE_URL` containing `sslmode=require`, require the module → `pool.options.ssl` is the `{rejectUnauthorized:true}` object.
- [ ] Without sslmode=require, `pool.options.ssl` is false.
- [ ] Use `jest.isolateModules` + `delete require.cache` to re-import per case.

### Task 4: Patch backend route tests for branch holes

For each of these files, add the listed cases. Refer to `tests/setup.js` for `createTestUser`, `createTestAlbum`, `authHeader`.

**albums.js (lines 28-29, 46, 68, 82-86, 100):**
- [ ] GET /albums/:id by non-member → 403
- [ ] GET /albums/:id with bad UUID → 400 or 404
- [ ] PATCH /albums/:id by non-admin member → 403
- [ ] DELETE /albums/:id by non-admin → 403
- [ ] DELETE /albums/:id by admin → 204
- [ ] POST /albums without name → 400

**auth.js (lines 41, 55):**
- [ ] POST /auth/apple when verifyAppleToken rejects → next(err) → 500/401
- [ ] POST /auth/google with no idToken → 400

**invites.js (lines 37, 53, 78-79, 85):**
- [ ] POST /albums/:id/invites by non-member → 403
- [ ] POST /join/:token with expired invite → 410
- [ ] POST /join/:token with already-member user → 409
- [ ] POST /join/:token with non-existent token → 404
- [ ] DELETE /invites/:id by non-admin → 403

**members.js (line 27):**
- [ ] DELETE /albums/:id/members/:userId where target is last admin → 400

**milestones.js (lines 36, 52, 83, 98):**
- [ ] POST /milestones by non-member → 403
- [ ] PATCH /milestones/:id by non-author non-admin → 403
- [ ] DELETE /milestones/:id by non-author non-admin → 403
- [ ] GET /milestones/:id not found → 404

**photos.js (lines 29, 67):**
- [ ] POST /photos by non-member → 403
- [ ] GET /photos/:id/full where photo is from a different album → 403

**timeline.js (lines 18, 67):**
- [ ] GET /albums/:id/timeline by non-member → 403
- [ ] GET /albums/:id/timeline with empty album → 200, []

For each: write the test, run `npm test -- <file>`, commit `test(backend): close branch gaps in <file>`.

### Task 5: Service unit tests

For each service, mirror Pattern B. **Each service gets its own test file.**

**apns.js** — mock `@parse/node-apn`:
- [ ] `send()` builds a Notification with payload + topic, calls `provider.send`, resolves on success.
- [ ] `send()` propagates failed responses.
- [ ] Missing `APNS_KEY` → no-op (logs but doesn't throw).

**appleAuth.js** — mock `apple-signin-auth`:
- [ ] Verifies token with audience = APPLE_CLIENT_ID, returns `{sub, name, email}`.
- [ ] Invalid token → throws.

**googleAuth.js** — mock `google-auth-library`:
- [ ] `verifyIdToken({audience})` called with GOOGLE_CLIENT_ID.
- [ ] Returns `{sub, name, picture}` from payload.
- [ ] Invalid token → throws.

**r2.js** — mock `@aws-sdk/s3-request-presigner`:
- [ ] `getUploadUrl(key, contentType)` returns presigned PUT URL.
- [ ] `getDownloadUrl(key)` returns presigned GET URL.
- [ ] `publicUrl(key)` returns `${R2_PUBLIC_URL}/${key}`.

**thumbnail.js** — use real sharp on a fixture jpeg buffer:
- [ ] Generates a 256x256 jpeg buffer from input.
- [ ] Preserves EXIF rotation (use a portrait test fixture if available, else just verify output is jpeg and width/height correct).

Each: own test file, commit per file.

### Task 6: Re-measure backend coverage

- [ ] `cd backend && npm test -- --coverage --coverageReporters=text-summary`
- [ ] All four metrics ≥ 90. If a file is still under, add targeted cases.
- [ ] Commit if any new tests added: `test(backend): close residual coverage gaps`

---

## Phase 2: Mobile global setup

### Task 7: Create mobile jest.setup.js with global native mocks

**File:** `mobile/jest.setup.js` (new)

Block module-resolution warnings + provide reasonable defaults so component/screen tests don't repeat boilerplate. Mock at least: `expo-router`, `expo-secure-store`, `expo-notifications`, `expo-camera`, `expo-image`, `expo-image-picker`, `expo-linear-gradient`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `react-native-reanimated` (use built-in mock), `react-native-safe-area-context` (use built-in mock), `react-native-gesture-handler`.

Reference: each mock returns the minimum shape used by code (look at the imports across screens).

### Task 8: Reference jest.setup.js from jest.config.js

```js
setupFiles: ['./jest.setup.js'],
setupFilesAfterEach: ['@testing-library/jest-native/extend-expect'],
```

Run `npm test` — all existing 5 tests still pass.

---

## Phase 3: Mobile lib tests

For each lib file: ~5-10 cases covering happy path + each branch.

### Task 9: src/lib/api.ts
- [ ] baseURL = EXPO_PUBLIC_API_URL when set.
- [ ] Request interceptor attaches `Authorization` header from authStore token when present.
- [ ] Response interceptor on 401 clears auth and redirects (if that logic exists — read source).

### Task 10: src/lib/exif.ts
- [ ] Parses date from EXIF buffer.
- [ ] Returns null when no date.

### Task 11: src/lib/notifications.ts
- [ ] `registerPushToken()` no-ops when permission denied.
- [ ] `registerPushToken()` posts token to backend when granted.
- [ ] Notification handler shape matches SDK 56 spec.

### Task 12: src/lib/queryClient.ts
- [ ] Exports a configured QueryClient with retry: false (or whatever the actual config is) — read source.

Commit per file.

---

## Phase 4: Mobile hooks (4 new files)

Use Pattern D wrapper. For each hook, cover:
- [ ] Fetches data via the right endpoint.
- [ ] Returns `data` on success.
- [ ] Returns `error` on failure.
- [ ] Mutations call api.post/put/delete with right args + invalidate the right query keys.

### Task 13: useMembers
### Task 14: useMilestones
### Task 15: useTimeline
### Task 16: useUpload

Commit per file.

---

## Phase 5: Mobile components

For each component:
- [ ] Renders without crashing with required props.
- [ ] Renders each prop variant (loading, disabled, variant=ghost/primary, etc.).
- [ ] Fires callbacks (onPress, onChange) when interacted.
- [ ] Snapshot is NOT required (we measure coverage, not visual regression).

### Task 17: ui/Button.tsx
- [ ] Default render.
- [ ] loading=true disables press.
- [ ] disabled=true disables press.
- [ ] variant='ghost' applies ghost styles (assert testID or style array contains ghostStyle).
- [ ] fullWidth=true sets width 100%.

### Task 18: ui/Avatar
- [ ] Renders fallback initials when no uri.
- [ ] Renders Image when uri present.

### Task 19: ui/Badge
### Task 20: ui/Card
### Task 21: ui/EmptyState
### Task 22: ui/HeaderGradient
### Task 23: ui/LoadingSpinner
### Task 24: ui/MilestoneCard
### Task 25: ui/PhotoCell
### Task 26: ui/SectionHeader
### Task 27: ui/TextInput
### Task 28: family/InviteSheet
### Task 29: family/MemberList
### Task 30: family/QRSheet
### Task 31: timeline/MonthHeader
### Task 32: timeline/PhotoRow
### Task 33: timeline/TimelineFeed
### Task 34: upload/PhotoThumbnailGrid
### Task 35: upload/UploadSheet

For each: write `__tests__/components/<path>/<name>.test.tsx`, run `npm test -- <name>`, commit.

---

## Phase 6: Mobile screens

Use Pattern F. For each screen, cover:
- [ ] Renders with mocked dependencies.
- [ ] Each user-driven branch (button press → expected side effect).
- [ ] Error states (api rejects → error UI).
- [ ] Loading states (initial render before api resolves).

### Task 36: app/(auth)/index.tsx (signIn)
- [ ] Renders Apple + Google buttons.
- [ ] handleApple success → router.replace('/(tabs)').
- [ ] handleApple cancel → no router call, no alert.
- [ ] handleApple error → Alert.
- [ ] handleGoogle success → router.replace('/(tabs)').
- [ ] handleGoogle cancel → swallowed silently.
- [ ] handleGoogle no idToken → Alert.

### Task 37: app/_layout.tsx
- [ ] Renders Stack with router config; auth-aware redirect.

### Task 38: app/(tabs)/_layout.tsx
- [ ] Tabs render with the right number of routes.

### Task 39: app/(tabs)/index.tsx (timeline screen)
- [ ] Renders TimelineFeed when album exists.
- [ ] Renders EmptyState when no album.

### Task 40: app/(tabs)/family.tsx
- [ ] Renders MemberList from useMembers.
- [ ] Tap "Invite" opens InviteSheet.

### Task 41: app/(tabs)/milestones.tsx
- [ ] Renders MilestoneCard list.
- [ ] Tap card → router.push to detail.

### Task 42: app/(tabs)/upload.tsx
- [ ] Tap "Pick photos" calls ImagePicker.
- [ ] Selected photos render in grid.
- [ ] "Upload" calls useUpload mutation.

### Task 43: app/(tabs)/settings.tsx
- [ ] Renders user info.
- [ ] Notification toggle reflects OS permission.
- [ ] Sign out clears auth + redirects.

### Task 44: app/join/[token].tsx
- [ ] On mount, calls `POST /join/:token`.
- [ ] Success → router.replace to family tab.
- [ ] Already-member → friendly message.
- [ ] Invalid token → error UI.

### Task 45: app/photo/[id].tsx
- [ ] Renders photo by id from route params.
- [ ] Swipe through siblings (cover the carousel index logic).
- [ ] Cold cache loading state shown then resolved.

### Task 46: app/milestone/[id].tsx
### Task 47: app/milestone/new.tsx

Commit per screen.

---

## Phase 7: Coverage gates

### Task 48: Add backend threshold

**File:** `backend/jest.config.js`

```js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEach: ['./tests/setup.js'],
  testTimeout: 15000,
  transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/db/migrate.js', '!src/db/migrations/**'],
  coverageThreshold: { global: { statements: 90, branches: 90, functions: 90, lines: 90 } },
};
```

- [ ] Run `npm test -- --coverage` — passes thresholds.

### Task 49: Add mobile threshold

**File:** `mobile/jest.config.js`

Same shape, with mobile collectCoverageFrom = `['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}']` and exclusions for `_layout.tsx` if a screen is purely declarative routing.

### Task 50: Verify CI-style run

- [ ] `cd backend && npm test -- --coverage` passes.
- [ ] `cd mobile && npm test -- --coverage` passes.
- [ ] Both report ≥90% across all four metrics.
- [ ] Commit `chore: enforce 90% test coverage threshold`.

---

## Self-Review

**Spec coverage:** Every source file in the inventory has a task. ✓

**Placeholders scanned:** "Refer to source" appears in Phase 3-6 — this is intentional (agents have read access). Patterns A-F give complete examples. No "TBD" / "TODO" / "fill in later" without complete signal of what to do.

**Type consistency:** Mocks use the same module names across patterns. `api` mock shape is consistent (`{ post, get }`). `router` mock is `{ replace, push }`.

**Risk callouts:**
- Photo viewer (Task 45) uses gesture-handler — may need extra mocking.
- Timeline + family hooks both use react-query; setup file already provides QueryClient shim, but if tests fail with "no QueryClient" we need to make wrappers reusable.
- The `signIn` screen test imports `app/(auth)/index` — the parens in the path may need Jest module resolution tweak (or just import via relative path from __tests__).

