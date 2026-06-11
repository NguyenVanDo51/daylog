# E2E Testing with Maestro

## Overview

End-to-end tests run locally on the iOS Simulator using [Maestro CLI](https://maestro.mobile.dev). No CI required — run them manually before pushing.

**Flows:**
| File | What it tests |
|---|---|
| `flows/00-smoke.yaml` | App launches and lands on Albums screen |
| `flows/01-day-grid.yaml` | Tap an album → day grid renders |
| `flows/02-story-viewer.yaml` | Tap a day → story opens → swipe → go back |

---

## Prerequisites

- macOS with Xcode installed
- iOS Simulator available (`xcrun simctl list devices`)
- Maestro CLI installed (see below)
- A real test account with at least one album containing photos

---

## First-time setup

### 1. Install Maestro CLI

```bash
brew install maestro
```

Verify:
```bash
maestro --version   # should print 2.6.0 or later
```

### 2. Get a test JWT

The tests bypass OAuth by using a pre-baked JWT. You need a real token from a test account.

**How to get it:**

a. Log in normally via the app on the simulator (Google or Apple sign-in)

b. Open Expo dev menu (press `d` in Metro terminal or shake the device), tap **Open JS Debugger**

c. In the debugger console, run:
```js
SecureStore.getItemAsync('auth_token').then(t => console.log(t))
```

d. Copy the printed JWT (starts with `eyJ`)

> If `SecureStore` is not in scope, add a temporary `console.log` to `_layout.tsx` right after line `const stored = await SecureStore.getItemAsync(TOKEN_KEY)`:
> ```ts
> console.log('TOKEN:', stored);
> ```
> Reload the app, copy from Metro terminal, then remove the log.

### 3. Create `.env.e2e`

```bash
cp mobile/.env.e2e.example mobile/.env.e2e
```

Open `mobile/.env.e2e` and replace `REPLACE_ME` with your JWT:
```bash
EXPO_PUBLIC_E2E_TEST_TOKEN=eyJhbGci...your-real-token...
```

This file is gitignored — never commit it.

---

## Running the tests

### Step 1: Build the app with the token baked in

**This is critical.** `EXPO_PUBLIC_E2E_TEST_TOKEN` must be in your shell environment when Metro bundles the JS. It is baked in at build time, not runtime.

```bash
cd mobile
source .env.e2e                    # load token into current shell
echo $EXPO_PUBLIC_E2E_TEST_TOKEN   # verify it printed — if empty, token not loaded
npx expo run:ios                   # build and install on simulator
```

Wait for the app to launch. You should see the **Albums screen** directly (no login screen). If you see the login screen, the token was not baked in — re-run the commands above.

### Step 2: Run the flows

In a separate terminal (keep Metro running):

```bash
# Run all flows in order
maestro test mobile/e2e/flows/

# Run a single flow
maestro test mobile/e2e/flows/00-smoke.yaml

# Run with verbose output
maestro test mobile/e2e/flows/ --format junit
```

---

## Debugging

### See what Maestro sees on screen

```bash
maestro hierarchy
```

This prints the full accessibility tree of whatever is currently on screen. Use it when a flow fails to check what testIDs are visible.

### Common failures

| Error | Cause | Fix |
|---|---|---|
| `Unable to launch app com.familyguy.app` | App not installed / wrong bundle ID | Run `npx expo run:ios` first |
| `id: menu-btn is not visible` | App showing login screen | Token not baked — re-run `source .env.e2e && npx expo run:ios` |
| `id: album-row-.* is not visible` | Test account has no albums | Create an album in the app manually |
| `id: day-cell-.* is not visible` | Album has no photos | Add photos to the album manually |
| `Unknown Property: timeout` | Wrong Maestro syntax | Use `extendedWaitUntil` not `assertVisible` with timeout |

### How the auth bypass works

`mobile/app/_layout.tsx` checks for `EXPO_PUBLIC_E2E_TEST_TOKEN` at startup. If set, it hydrates the auth store directly and skips SecureStore + the `/users/me` API call entirely. This is how the app boots logged-in without going through Google/Apple OAuth.

The bypass only activates if the env var is baked into the bundle at build time. Production builds never set it.

---

## Known issues

- **Bundle ID:** Flow files use `appId: com.familyguy.app` — the actual installed bundle ID. `app.json` has `com.andynguyen.daylog` but the native `ios/` project still has the old ID. To align them, run `npx expo prebuild --clean` and update Google Cloud Console with the new bundle ID.
- **Test data dependency:** Flows `01-day-grid` and `02-story-viewer` require the test account to have at least one album with photos. If the account is fresh, seed it manually before running.

---

## Adding a new flow

1. Create `e2e/flows/NN-name.yaml` (number determines run order)
2. Start with the standard header:
```yaml
appId: com.familyguy.app
---
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible:
      id: "menu-btn"
    timeout: 8000
```
3. Use `testID` values from source code to target elements (see list below)
4. Use `extendedWaitUntil` (not `assertVisible` with `timeout`) for waits

### testID reference

| testID | Location | Description |
|---|---|---|
| `menu-btn` | AlbumsPage | Albums tab menu button — confirms home screen is loaded |
| `album-row-{id}` | AlbumsPage | Each album row — use regex `album-row-.*` |
| `create-album-btn` | AlbumsPage | Create new album button |
| `camera-pill-btn` | AlbumsPage | Camera shortcut pill |
| `day-cell-{date}` | DayCell | Each day in the album grid — use regex `day-cell-.*` |
| `story-back` | StoryScreen | Back button in story viewer |
| `story-date-chip` | StoryScreen | Date label in story viewer |
| `story-menu-btn` | StoryScreen | Menu button in story viewer |
