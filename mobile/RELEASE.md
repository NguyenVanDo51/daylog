# App Store Release Guide

## One-time setup (do once)

- [ ] Create the app on [App Store Connect](https://appstoreconnect.apple.com) → My Apps → +
- [ ] Fill in `eas.json` → `submit.production.ios`:
  - `ascAppId` — the numeric App ID from App Store Connect (General → App Information)
  - `appleTeamId` — your Team ID from [developer.apple.com](https://developer.apple.com/account) → Membership
- [ ] Upload an app icon (1024×1024 PNG, no alpha) to App Store Connect
- [ ] Add at least one screenshot per device size (iPhone 6.7" required)
- [ ] Fill in App Store listing: name, description, keywords, category, age rating

---

## Each release

### 1. Prepare

- [ ] Update `version` in `app.json` if this is a user-visible change (e.g. `1.0.0` → `1.1.0`)
  - Build number auto-increments via `autoIncrement: true` in `eas.json` — don't touch it
- [ ] Run tests: `cd mobile && npx jest --no-coverage`
- [ ] Smoke-test on a real device via the `preview` profile first (optional but recommended):
  ```bash
  eas build --platform ios --profile preview
  ```

### 2. Build

```bash
eas build --platform ios --profile production
```

EAS builds in the cloud (~10–15 min). Watch progress at [expo.dev](https://expo.dev).

### 3. Submit

```bash
eas submit --platform ios --profile production --latest
```

This uploads the build to App Store Connect automatically.

### 4. App Store Connect

- [ ] Go to App Store Connect → your app → the new build
- [ ] Attach the build to the release
- [ ] Add release notes (What's New) in Vietnamese + English
- [ ] Click **Submit for Review**

Apple review typically takes 1–3 days.

---

## Useful commands

```bash
# Check build status
eas build:list --platform ios --limit 5

# View submission status
eas submit:list --platform ios --limit 5
```
