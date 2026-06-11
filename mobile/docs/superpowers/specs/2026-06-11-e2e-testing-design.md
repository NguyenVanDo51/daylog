# E2E Testing with Maestro — Design Spec

**Date:** 2026-06-11
**Status:** Approved

## Overview

Add local end-to-end tests using Maestro CLI to cover the three core user journeys in the Daylog mobile app. Tests run on the developer's Mac against the iOS simulator. No CI required initially; GitHub Actions can be added later if the manual discipline breaks down.

## Goals

- Catch regressions in core flows before pushing
- Zero ongoing cost (Maestro CLI is free for local use)
- Fast feedback (~30-60s per flow on Apple Silicon)
- Easy to run: one command, no extra services

## Non-Goals

- Testing OAuth login dialogs (handled by existing unit tests)
- Android (iOS-first; Android flows can be added later with identical YAML)
- Automated CI gate (deferred; trivial to add with GitHub Actions later)

## File Structure

```
mobile/
  e2e/
    config.yaml               # global Maestro config (appId)
    flows/
      00-smoke.yaml           # app launches, lands on home screen
      01-day-grid.yaml        # albums tab renders, day cards visible
      02-story-viewer.yaml    # tap day card, story opens, swipe, go back
  .env.e2e                    # gitignored — holds E2E_TEST_TOKEN locally
```

Flows are numbered so `maestro test e2e/flows/` runs them in order. Each flow is also runnable individually.

## Auth Strategy

The app authenticates via Google/Apple OAuth — impossible to automate in E2E. Instead:

1. A long-lived test JWT (`E2E_TEST_TOKEN`) is generated once from a test account and stored in `.env.e2e` (gitignored).
2. The app is built with `EXPO_PUBLIC_E2E_TEST_TOKEN` set to that value.
3. In `app/_layout.tsx`, during the auth initialization `useEffect`, a 3-4 line guard checks for this env var. If present, it hydrates the auth store directly instead of reading from SecureStore — the app boots already authenticated.
4. Production builds never set this var, so the guard is permanently inert in prod.

This requires one small code change in `_layout.tsx` and no new screens, routes, or feature flags.

## The Three Flows

### `00-smoke.yaml`
Verifies the app launches without crashing and lands on the Albums tab (home screen). If this fails, all other flows are meaningless and should be skipped.

Steps: launch app → assert Albums tab content visible

### `01-day-grid.yaml`
Verifies the day grid renders correctly with content.

Steps: launch app → assert PagerView is on Albums tab → assert at least one day card is visible → scroll down → assert more content loads

### `02-story-viewer.yaml`
Verifies the story viewer opens and navigation works.

Steps: launch app → tap first day card → assert story viewer opens (back button visible) → swipe to next photo → assert navigation worked → tap back → assert returned to day grid

## Code Change: Auth Bypass in `_layout.tsx`

In the existing `useEffect` that reads from `SecureStore` (line 44), add a guard before the SecureStore read:

```ts
// E2E only: boot authenticated without OAuth
const e2eToken = process.env.EXPO_PUBLIC_E2E_TEST_TOKEN;
if (e2eToken) {
  setAuth(e2eToken, { id: 'e2e-user', display_name: 'E2E Test', email: 'e2e@test.local', avatar_url: null });
  setReady(true);
  return;
}
```

This short-circuits the normal SecureStore + `/users/me` hydration path when the env var is present.

## How to Run

```bash
# Install Maestro CLI once (global, not a project dep)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Build dev client with E2E token (reads from .env.e2e)
source mobile/.env.e2e && npx expo run:ios

# Run all flows
maestro test mobile/e2e/flows/

# Run a single flow
maestro test mobile/e2e/flows/01-day-grid.yaml
```

The `readme.md` in `mobile/` will be updated with these commands.

## Future: GitHub Actions

When local discipline breaks down, adding CI requires:
1. A `maestro-e2e.yml` GitHub Actions workflow that triggers on EAS preview build completion
2. Downloads the `.ipa` artifact from EAS
3. Boots a macOS runner with the iOS simulator
4. Runs `maestro test mobile/e2e/flows/`

The flow YAML files are identical — no changes needed to the flows themselves.

## `.env.e2e` Format

```bash
# mobile/.env.e2e — gitignored
EXPO_PUBLIC_E2E_TEST_TOKEN=eyJhbGci...
```

The test JWT must be generated from a real account on the backend and will not expire (or expire very long). Rotation is manual.
