# Migrate Push Notifications to Expo Push Service

**Date:** 2026-06-09
**Status:** Approved

## Background

The app currently uses `@parse/node-apn` to send push notifications directly to APNS (Apple Push Notification Service). This has two problems:

1. iOS only — Android is not supported.
2. The mobile already calls `getExpoPushTokenAsync()` (returns `ExponentPushToken[...]` format), but the backend expects raw APNS device tokens. These are incompatible, meaning push notifications are silently broken.
3. There is no `PATCH /users/me` route on the backend, so `registerPushToken()` on the mobile always fails silently.

## Goal

Replace `@parse/node-apn` with Expo's Push Notification Service so that push notifications work correctly on both iOS and Android, using the Expo token format the mobile already produces.

## Architecture

```
Mobile (expo-notifications)
  └─ getExpoPushTokenAsync()  →  ExponentPushToken[xxxx]
       │
       ├─ POST /auth/apple or /auth/google  (body: { pushToken })
       └─ PATCH /users/me                  (body: { push_token })
                │
           Backend (push.ts)
                │
           Expo Push API  https://exp.host/--/api/v2/push/send
                │
           ┌────┴────┐
         APNS       FCM
         (iOS)   (Android)
```

Expo's service receives the Expo Push Token and routes to APNS or FCM automatically — the backend does not need to know the device platform.

## Changes

### Database

- Migration: `ALTER TABLE users RENAME COLUMN apns_token TO push_token`

### Backend

**Dependencies:**
- Add `expo-server-sdk`
- Remove `@parse/node-apn`
- Remove env vars: `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`

**`src/services/push.ts`** (replaces `apns.ts`):
- Export `sendPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void>`
- Uses `Expo.sendPushNotificationsAsync()` from `expo-server-sdk`
- On receipt error `DeviceNotRegistered`: delete that token from DB to prevent future sends

**`src/db/schema.ts`:**
- Rename `apnsToken` → `pushToken` (maps to `push_token` column)

**`src/routes/auth.ts`:**
- `/apple` and `/google`: rename body field `apnsToken` → `pushToken`, update DB insert/upsert
- `/logout`: update `set({ apnsToken: null })` → `set({ pushToken: null })`
- `toSnakeUser()`: rename `apns_token` → `push_token` in response

**`src/routes/auth.ts` — new route:**
- `PATCH /users/me` (requires auth): accepts `{ push_token }`, updates `users.pushToken` for the authenticated user

**`src/routes/photos.ts`:**
- Update import from `../services/apns` → `../services/push`
- Update field reference `apnsToken` → `pushToken`

**`src/routes/reactions.ts`:**
- Update import from `../services/apns` → `../services/push`
- Update field references `apnsToken` → `pushToken`

### Mobile

No package changes needed — `expo-notifications` already supports both iOS and Android.

`src/lib/notifications.ts` — no changes needed. It already:
- Calls `getExpoPushTokenAsync()` (correct token format)
- Sends to `PATCH /users/me` with `{ push_token: token }` (correct once backend route exists)

### Tests

- Rename `src/services/apns.test.ts` → `src/services/push.test.ts`
- Mock `expo-server-sdk` instead of `@parse/node-apn`
- Add tests for `PATCH /users/me`: auth required, updates push_token, rejects unauthenticated
- Update mocks in `photos.test.ts` and `reactions.test.ts` to import from `../services/push`

## Error Handling

- `sendPush()` is fire-and-forget (`.catch(console.error)`) — does not block the originating request
- Expo receipt errors with `DeviceNotRegistered` status: delete the token from DB to avoid sending to stale devices
- Other Expo errors: log and continue

## Out of Scope

- Expo push credentials setup (handled separately in Expo dashboard / EAS)
- Android `google-services.json` configuration (handled by Expo/EAS build process)
- Notification categories, actions, or rich media
