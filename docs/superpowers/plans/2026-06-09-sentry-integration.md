# Sentry Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Sentry on both mobile (Expo React Native) and backend (Express.js) for end-to-end distributed tracing, error capture, and user identity.

**Architecture:** Two Sentry projects (mobile + backend) linked by distributed tracing via `sentry-trace` headers injected by Axios on every API call. Sentry is initialized on the backend before Express/pg load so it can auto-instrument both. User identity is attached per-request from the JWT on the backend, and after auth bootstrap on mobile.

**Tech Stack:** `@sentry/react-native` (Expo), `@sentry/node` (Express/CommonJS), `sentry-cli` for source map uploads.

---

## File Map

| File | Change |
|---|---|
| `fly.toml` | Deleted |
| `backend/.env.example` | Add Sentry env vars |
| `backend/src/index.ts` | Sentry.init() before app loads; require('./app') in body |
| `backend/src/app.ts` | Import Sentry; setupExpressErrorHandler after routes |
| `backend/src/middleware/auth.ts` | Sentry.setUser() after req.user is set |
| `backend/src/middleware/auth.test.ts` | Mock Sentry; assert setUser called on valid auth |
| `backend/src/app.test.ts` | Mock Sentry to prevent side effects in tests |
| `backend/deploy.sh` | New: tsc + sentry-cli source map upload + app restart |
| `mobile/app.json` | Add @sentry/react-native/expo plugin + extra.sentryDsn |
| `mobile/app/_layout.tsx` | Sentry.init() at module level; Sentry.wrap(); setUser/setUser(null) |

---

### Task 1: Remove fly.toml

**Files:**
- Delete: `fly.toml`

- [ ] **Step 1: Delete the file**

```bash
git rm fly.toml
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove fly.toml — deploying on VPS"
```

---

### Task 2: Update backend .env.example with Sentry vars

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add Sentry vars to .env.example**

Append to the end of `backend/.env.example`:

```
# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "chore(backend): add Sentry env vars to .env.example"
```

---

### Task 3: Backend — install @sentry/node

**Files:**
- Modify: `backend/package.json` (via npm install)

- [ ] **Step 1: Install the package**

```bash
cd backend && npm install @sentry/node
```

- [ ] **Step 2: Verify install succeeded**

```bash
node -e "require('@sentry/node'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): install @sentry/node"
```

---

### Task 4: Backend — init Sentry in index.ts before app loads

**Files:**
- Modify: `backend/src/index.ts`

**Why this order matters:** TypeScript compiles `import` to `require()`. All import-derived requires run before module body code. By keeping `@sentry/node` as a top-level import and using a body `require('./app')`, Sentry is guaranteed to init before Express and pg are loaded — which is required for auto-instrumentation.

- [ ] **Step 1: Replace index.ts with this content**

```ts
import 'dotenv/config';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV ?? 'development',
});

// require() in body — runs AFTER Sentry.init() so pg and Express are instrumented
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: import('express').Application = require('./app');

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => console.log(`API running on port ${port}`));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat(backend): init Sentry before app loads for pg/Express instrumentation"
```

---

### Task 5: Backend — wire setupExpressErrorHandler into app.ts

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.test.ts`

`Sentry.setupExpressErrorHandler(app)` must be placed **after all routes** and **before** the custom error handler so Sentry captures unhandled exceptions before the app swallows them.

- [ ] **Step 1: Add Sentry mock to app.test.ts so tests don't make real Sentry calls**

Add this at the very top of `backend/src/app.test.ts`, before all existing code:

```ts
jest.mock('@sentry/node', () => ({
  setupExpressErrorHandler: jest.fn(),
  init: jest.fn(),
  setUser: jest.fn(),
}));
```

- [ ] **Step 2: Run existing app tests to confirm they still pass before any change**

```bash
cd backend && npx jest src/app.test.ts --no-coverage
```

Expected: 3 passed.

- [ ] **Step 3: Add Sentry import and setupExpressErrorHandler to app.ts**

In `backend/src/app.ts`, add the import after existing imports:

```ts
import * as Sentry from '@sentry/node';
```

Then add `Sentry.setupExpressErrorHandler(app)` after the last route registration and before the custom error handler:

```ts
// After all app.use(...routes) calls:
Sentry.setupExpressErrorHandler(app);

// Existing error handler stays unchanged:
app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  const message = status < 500 ? (err.message || 'Error') : 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});
```

- [ ] **Step 4: Run app tests again to confirm they still pass**

```bash
cd backend && npx jest src/app.test.ts --no-coverage
```

Expected: 3 passed.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts backend/src/app.test.ts
git commit -m "feat(backend): add Sentry error handler to Express app"
```

---

### Task 6: Backend — set user identity in requireAuth

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/middleware/auth.test.ts`

`Sentry.setUser()` called immediately after `req.user` is set. Sentry uses async context (AsyncLocalStorage) to scope this per-request, so it won't leak across concurrent requests.

- [ ] **Step 1: Add Sentry mock to auth.test.ts**

Add at the very top of `backend/src/middleware/auth.test.ts`, before existing imports:

```ts
import * as Sentry from '@sentry/node';
jest.mock('@sentry/node', () => ({
  setUser: jest.fn(),
}));
```

- [ ] **Step 2: Add a test that asserts Sentry.setUser is called with the authenticated user's id**

Add this test at the end of the `describe('requireAuth middleware', ...)` block in `backend/src/middleware/auth.test.ts`:

```ts
it('calls Sentry.setUser with the authenticated user id', async () => {
  const user = await createTestUser({ display_name: 'Sentry Test User' });
  const secret = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign({ userId: user.id }, secret);

  await request(buildApp())
    .get('/probe')
    .set('Authorization', `Bearer ${token}`);

  expect(Sentry.setUser).toHaveBeenCalledWith({ id: user.id });
});
```

- [ ] **Step 3: Run the auth tests to confirm the new test fails**

```bash
cd backend && npx jest src/middleware/auth.test.ts --no-coverage
```

Expected: all previous tests pass, the new `Sentry.setUser` test fails with "expected mock to have been called".

- [ ] **Step 4: Add Sentry import and setUser call to auth.ts**

In `backend/src/middleware/auth.ts`, add the import after existing imports:

```ts
import * as Sentry from '@sentry/node';
```

Then replace the `req.user = found[0]; next();` block with:

```ts
req.user = found[0];
Sentry.setUser({ id: found[0].id });
next();
```

- [ ] **Step 5: Run auth tests to confirm all pass**

```bash
cd backend && npx jest src/middleware/auth.test.ts --no-coverage
```

Expected: 8 passed (7 existing + 1 new).

- [ ] **Step 6: Run the full backend test suite to check for regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/middleware/auth.test.ts
git commit -m "feat(backend): set Sentry user identity in requireAuth middleware"
```

---

### Task 7: Backend — temporary debug-sentry route

**Files:**
- Modify: `backend/src/app.ts` (add then remove)

This route triggers a real Sentry event so you can confirm the integration is working before going to production. Remove it immediately after verifying.

- [ ] **Step 1: Add the debug route to app.ts — before Sentry.setupExpressErrorHandler**

In `backend/src/app.ts`, add this route after the `/health` route and before `Sentry.setupExpressErrorHandler(app)`:

```ts
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug-sentry', (_req, _res) => {
    throw new Error('Sentry debug — intentional test error');
  });
}
```

- [ ] **Step 2: Start the backend locally**

```bash
cd backend && SENTRY_DSN=<your-dsn> npx ts-node src/index.ts
```

- [ ] **Step 3: Trigger the error**

```bash
curl http://localhost:3000/debug-sentry
```

Expected: 500 response. Check your Sentry dashboard — the error "Sentry debug — intentional test error" should appear within ~30 seconds.

- [ ] **Step 4: Remove the debug route**

Delete the `if (process.env.NODE_ENV !== 'production')` block added in Step 1.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat(backend): complete Sentry backend integration"
```

---

### Task 8: Backend — deploy script with source map upload

**Files:**
- Create: `backend/deploy.sh`

Source maps let Sentry show real TypeScript file/line numbers instead of minified `dist/` paths in stack traces.

- [ ] **Step 1: Create backend/deploy.sh**

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Building..."
npm ci
npm run build

echo "Uploading source maps to Sentry..."
npx sentry-cli sourcemaps inject dist/
npx sentry-cli sourcemaps upload --release="$(git rev-parse HEAD)" dist/

echo "Restarting app..."
# Replace with your process manager command, e.g.:
# pm2 restart family-guy-api
# systemctl restart family-guy-api
echo "Done. Start your app with: node dist/index.js"
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x backend/deploy.sh
```

- [ ] **Step 3: Add sentry-cli as a dev dependency**

```bash
cd backend && npm install --save-dev @sentry/cli
```

- [ ] **Step 4: Verify sentry-cli is accessible**

```bash
cd backend && npx sentry-cli --version
```

Expected: prints a version string like `sentry-cli 2.x.x`.

- [ ] **Step 5: Commit**

```bash
git add backend/deploy.sh backend/package.json backend/package-lock.json
git commit -m "chore(backend): add deploy script with Sentry source map upload"
```

---

### Task 9: Mobile — install @sentry/react-native and configure app.json

**Files:**
- Modify: `mobile/app.json`

> **Important:** Before proceeding, check https://docs.expo.dev/versions/v56.0.0/ and the `@sentry/react-native` docs for the exact plugin name for Expo SDK 56.

- [ ] **Step 1: Install the Sentry SDK**

```bash
cd mobile && npx expo install @sentry/react-native
```

- [ ] **Step 2: Add the Sentry plugin to app.json**

In `mobile/app.json`, add `"@sentry/react-native/expo"` as the **first** entry in the `plugins` array, and add `extra.sentryDsn` under the `expo` key:

```json
{
  "expo": {
    "plugins": [
      [
        "@sentry/react-native/expo",
        {
          "organization": "<your-sentry-org>",
          "project": "<your-sentry-project>"
        }
      ],
      "expo-router",
      ...existing plugins...
    ],
    "extra": {
      "sentryDsn": "<your-mobile-sentry-dsn>"
    }
  }
}
```

Replace `<your-sentry-org>`, `<your-sentry-project>`, and `<your-mobile-sentry-dsn>` with real values from your Sentry dashboard.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/app.json mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): install @sentry/react-native and configure Expo plugin"
```

---

### Task 10: Mobile — Sentry.init and user identity in _layout.tsx

**Files:**
- Modify: `mobile/app/_layout.tsx`

`Sentry.init()` runs at module level (before the component function) so it initialises before any React rendering. The component is wrapped with `Sentry.wrap()` for navigation breadcrumbs and error boundary integration.

- [ ] **Step 1: Add Sentry import and init to _layout.tsx**

Add these imports at the top of `mobile/app/_layout.tsx`:

```ts
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { API_URL } from '@/constants/api';
```

Then add the `Sentry.init()` call immediately after the imports, before the component function:

```ts
Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn,
  tracesSampleRate: 0.2,
  tracePropagationTargets: [API_URL],
  integrations: [Sentry.reactNativeTracingIntegration()],
  environment: __DEV__ ? 'development' : 'production',
});
```

- [ ] **Step 2: Wrap the exported component with Sentry.wrap()**

Change the export from:

```ts
export default function RootLayout() {
```

to:

```ts
function RootLayout() {
```

And add at the very end of the file:

```ts
export default Sentry.wrap(RootLayout);
```

- [ ] **Step 3: Add setUser after successful auth and setUser(null) on 401**

Inside the `useEffect` bootstrap, add `Sentry.setUser` calls:

```ts
useEffect(() => {
  (async () => {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (stored) {
      const cachedUser = await SecureStore.getItemAsync(USER_KEY);
      if (cachedUser) setAuth(stored, JSON.parse(cachedUser));
      try {
        const { data } = await api.get('/users/me', { headers: { Authorization: `Bearer ${stored}` } });
        setAuth(stored, data);
        Sentry.setUser({ id: data.id });   // ← add this line
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data));
        registerPushToken().catch(() => { });
      } catch (err: any) {
        if (err?.response?.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
          clearAuth();
          Sentry.setUser(null);   // ← add this line
        }
      }
    }
    setReady(true);
  })();
}, []);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile): init Sentry, wrap root layout, set user identity on auth"
```

---

### Task 11: Verify end-to-end tracing and clean up

**No files changed** (this is a verification step only).

- [ ] **Step 1: Build and run the mobile app in development mode**

```bash
cd mobile && npx expo start
```

Open the app in a simulator or on a device.

- [ ] **Step 2: Trigger a test error from the mobile app**

In any screen component, temporarily add a button that calls:

```ts
import * as Sentry from '@sentry/react-native';
// In JSX:
<Button onPress={() => Sentry.captureException(new Error('Mobile test error'))} title="Test Sentry" />
```

Tap it, then check your mobile Sentry project dashboard.

- [ ] **Step 3: Verify distributed trace**

Make any authenticated API call from the mobile app (e.g. open the timeline). In the Sentry mobile project, find the transaction and click "View Full Trace". You should see the mobile span linked to a backend span in the backend Sentry project.

- [ ] **Step 4: Remove the test button**

Delete the temporary `Sentry.captureException` button added in Step 2.

- [ ] **Step 5: Final commit**

```bash
git add -p  # stage only the test button removal
git commit -m "chore: remove Sentry test button after verification"
```

---

## Setup Checklist (before deploying to production)

These are one-time manual steps in Sentry's dashboard / your VPS:

- [ ] Create two Sentry projects: one `react-native`, one `node`
- [ ] Copy DSNs into `mobile/app.json` `extra.sentryDsn` and VPS `SENTRY_DSN` env var
- [ ] Generate a Sentry Auth Token (Settings → Auth Tokens) with `project:releases` and `org:read` scopes
- [ ] Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on the VPS (for deploy.sh)
- [ ] Run `backend/deploy.sh` on first VPS deploy to upload source maps
- [ ] For EAS builds, set `SENTRY_AUTH_TOKEN` as an EAS secret (`eas secret:create`)
