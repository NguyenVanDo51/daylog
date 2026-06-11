# E2E Testing — Paused

## Status: Blocked on token bake-in

Tests fail because `menu-btn` is never visible after launch — app shows the login screen instead of Albums. Root cause: `EXPO_PUBLIC_E2E_TEST_TOKEN` was not set in the shell when `npx expo run:ios` ran, so Metro didn't bake it into the JS bundle.

## Resume steps

1. Verify the token is loaded in the current terminal:
   ```bash
   echo $EXPO_PUBLIC_E2E_TEST_TOKEN
   ```

2. If empty, source the env file and rebuild:
   ```bash
   cd mobile
   source .env.e2e
   npx expo run:ios
   ```

3. Once the app launches and shows the **Albums screen** (not login), run tests:
   ```bash
   maestro test e2e/flows/
   ```

## Known issues

- Flow files use `appId: com.familyguy.app` — the actual installed bundle ID. `app.json` has `com.andynguyen.daylog` but the native `ios/` project still has the old ID. Fix with `npx expo prebuild --clean` when ready to align them.
- Maestro v2.6.0 does not support `timeout` inside `assertVisible` — flows use `extendedWaitUntil` instead.
