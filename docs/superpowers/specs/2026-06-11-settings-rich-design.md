# Settings Screen — Rich Features Design

**Date:** 2026-06-11
**Status:** Approved

## Overview

Enhance the settings screen from a minimal 5-item list into a properly organised settings experience covering profile editing, language preferences, and account management.

## Screen Structure

Route `app/(tabs)/settings/` becomes a directory:

```
app/(tabs)/settings/
  index.tsx      ← main settings list (refactored from settings.tsx)
  profile.tsx    ← edit display name + avatar
  language.tsx   ← language picker
app/(auth)/
  restore.tsx    ← restore pending-deletion account
```

### `settings/index.tsx` — section order

1. **Profile card** — avatar + name + email; entire card is tappable, navigates to `/settings/profile`
2. **Thông báo** — push notification toggle (unchanged)
3. **Ứng dụng** — Language row (shows current language label + chevron → `/settings/language`)
4. **Tài khoản** — "Tải dữ liệu về" row + "Xoá tài khoản" row (danger color)
5. **Pháp lý** — privacy policy + terms (unchanged)
6. Sign-out button + version string

---

## Section 1: Profile Editor (`settings/profile.tsx`)

**UI:**
- Large centered avatar (96px) with a camera icon overlay tap target
- Display name text input below avatar, pre-filled, Baloo 2 font
- "Lưu" save button — disabled until a field changes; shows loading spinner during save

**Avatar upload flow:**
1. Tap avatar → `expo-image-picker` (camera roll or camera)
2. Selected image → upload to R2 via existing presigned URL endpoint
3. On upload success → hold the new URL in local state (not yet saved)
4. Tap "Lưu" → `PATCH /users/me` with `{ display_name?, avatar_url? }`
5. On success → update Zustand `authStore` user object → `router.back()`

No intermediate "uploading…" screen — progress indicator on the avatar thumbnail is sufficient.

---

## Section 2: Language Picker (`settings/language.tsx`)

**UI:** Simple list with three rows and checkmark on active selection:

| Row | Value | Behaviour |
|-----|-------|-----------|
| Theo thiết bị | `device` | Read `expo-localization`, apply closest supported locale |
| Tiếng Việt | `vi` | Force Vietnamese |
| English | `en` | Force English |

**Storage:** `AsyncStorage` key `app_language`. On app boot `i18n.ts` reads this key; if absent, falls back to device locale.

**Apply immediately:** Call `i18n.changeLanguage(resolvedLocale)` on selection — no restart required. Backend is not involved; this is a local preference.

---

## Section 3: Account Actions (inline in `settings/index.tsx`)

### Tải dữ liệu về (Download my data)

- Tap → `Alert` confirmation: *"Chúng tôi sẽ gửi link tải về email của bạn."*
- On confirm → `GET /users/me/export`
- On success → success toast: *"Đã gửi email."*
- No sub-screen needed.

### Xoá tài khoản (Delete account — soft delete)

**Confirmation flow (two steps):**
1. Alert: *"Bạn có chắc muốn xoá tài khoản?"* → Cancel / Tiếp tục
2. Alert with email input: *"Nhập email để xác nhận"* → Cancel / Xoá

**On confirm:**
- `DELETE /users/me` — soft-delete: sets `deleted_at = now()` on the user row
- Sign out (clear SecureStore + Zustand)
- Navigate to `/(auth)` with toast: *"Tài khoản của bạn sẽ bị xoá sau 7 ngày. Đăng nhập lại để huỷ."*

### Restore flow (`/(auth)/restore.tsx`)

When a user attempts to sign in and the auth endpoint detects `deleted_at` is set (within 7-day window), it returns `{ status: "account_pending_deletion", deleted_at: "<iso>" }` instead of a token.

The mobile app routes to `/(auth)/restore.tsx` which shows:
- Warning message with days remaining until permanent deletion
- "Khôi phục tài khoản" button → `POST /users/me/restore` → clears `deleted_at` → returns normal auth token → sign in normally
- "Xác nhận xoá" link → signs out and leaves the account in pending-deletion state

**Backend changes required:**
- Add `deleted_at TIMESTAMPTZ` column to `users` table
- `DELETE /users/me` sets `deleted_at` (no hard delete)
- `POST /users/me/restore` clears `deleted_at`, returns token
- Auth middleware: check `deleted_at`; if set and within 7 days, return `account_pending_deletion` status; if past 7 days, treat as not-found

> **TODO — Cron job:** Add a scheduled job that hard-deletes user rows where `deleted_at < now() - interval '7 days'`. Should also cascade-delete albums owned solely by that user, their photos, reactions, and push tokens. Schedule: daily.

---

## Backend API Summary

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/users/me` | Update `display_name` and/or `avatar_url` |
| GET | `/users/me/export` | Trigger data export email |
| DELETE | `/users/me` | Soft-delete (set `deleted_at`) |
| POST | `/users/me/restore` | Clear `deleted_at`, return auth token |

---

## Data Model Change

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
```

Auth middleware must filter out hard-deleted users and handle pending-deletion status.

---

## Out of Scope

- Dark/light theme toggle
- Notification granularity (per-type controls)
- Family/album management from settings
