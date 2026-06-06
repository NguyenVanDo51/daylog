# Family Album App — Design Spec

**Superseded in part by** [2026-06-04 Photo Journal Pivot](./2026-06-04-photo-journal-pivot-design.md) — interaction model, milestones (now per-day labels), and auto-sync removal.

**Date:** 2026-06-03  
**Status:** Approved

---

## Overview

A shared family photo album mobile app where parents and family members can save high-quality photos of their kids, organized in a chronological timeline with milestone markers and notes for every important moment.

**Primary pain point:** Parents want one place to save, organize, and share high-quality photos of their kids with family — with context (milestones, notes) that a standard camera roll or WhatsApp group cannot provide.

---

## Platform

- **iOS first** (React Native)
- Android support added post-MVP — React Native codebase supports both with minimal changes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (iOS first) |
| Backend | Express.js (Node.js) |
| Database | PostgreSQL |
| Photo storage | Cloudflare R2 (zero egress fees) |
| Auth | Sign in with Apple (required) + Google Sign-In (optional) |
| Push notifications | APNs (Apple Push Notification Service) |
| Image compression | react-native-compressor (on-device → WebP) + Sharp.js (server thumbnails) |

---

## Architecture

Single Express.js API (monolith) handling all business logic. Photos upload directly from the app to Cloudflare R2 via presigned URLs — the API never handles large binary data. PostgreSQL stores all metadata.

### Upload Flow (manual and auto-sync)

1. App requests a presigned upload URL from the API
2. App uploads photo directly to Cloudflare R2
3. App notifies the API with photo metadata (R2 key, taken_at from EXIF, caption, local_asset_id)
4. API generates thumbnail, stores metadata in PostgreSQL
5. API sends APNs push notification to all album members

Auto-sync follows the same flow, triggered by `PHPhotoLibrary` change observer instead of user action. The `local_asset_id` field ensures idempotency — re-syncing the same asset is a no-op. Both paths compress to WebP before upload.

### Component Responsibilities

- **Express.js API:** Auth token validation (Apple/Google), photo metadata CRUD, timeline queries, milestone management, invite token generation, QR code generation, presigned URL generation, push notification triggers
- **PostgreSQL:** Users, albums, photos metadata, milestones, members, invites
- **Cloudflare R2:** Original photos + thumbnails (direct upload, zero egress)
- **APNs:** Push notifications for new photos and milestones

---

## Data Model

```sql
users
  id UUID PK
  apple_sub VARCHAR UNIQUE
  google_sub VARCHAR UNIQUE
  display_name VARCHAR
  avatar_url TEXT
  apns_token TEXT
  created_at TIMESTAMPTZ

albums
  id UUID PK
  name VARCHAR
  child_birthdate DATE             -- used for age-based timeline labels
  cover_photo_id UUID → photos
  created_by UUID → users
  created_at TIMESTAMPTZ

album_members
  id UUID PK
  album_id UUID → albums
  user_id UUID → users
  role ENUM(admin, member)
  joined_at TIMESTAMPTZ

photos
  id UUID PK
  album_id UUID → albums
  uploaded_by UUID → users
  r2_key TEXT
  thumbnail_key TEXT
  taken_at TIMESTAMPTZ        -- from EXIF, not upload time
  caption TEXT
  local_asset_id VARCHAR       -- iOS PHAsset localIdentifier, prevents duplicate auto-sync
  created_at TIMESTAMPTZ

milestones
  id UUID PK
  album_id UUID → albums
  created_by UUID → users
  title VARCHAR
  note TEXT
  occurred_at TIMESTAMPTZ
  cover_photo_id UUID → photos
  created_at TIMESTAMPTZ

invites
  id UUID PK
  album_id UUID → albums
  token VARCHAR UNIQUE
  created_by UUID → users
  expires_at TIMESTAMPTZ
  max_uses INT               -- null = unlimited
  use_count INT DEFAULT 0
```

**Timeline query:** Photos and milestones are fetched separately (ordered by `taken_at` / `occurred_at`) and merged client-side by date into a unified timeline. Date grouping by month/year happens in the app layer.

**Roles in MVP:** The `role` column is included for post-MVP use. In MVP, admin and member are functionally identical — everyone can upload photos and create milestones. The album creator is assigned `admin`; joiners get `member`.

---

## MVP Features

### 1. Authentication
- Sign in with Apple (required by App Store)
- Sign in with Google (optional, available on iOS)
- Profile display name + avatar pulled from auth provider

### 2. Photo Upload
- Pick one or multiple photos from iOS Photos library
- Compress locally on-device before upload: convert to **WebP at quality 0.85**, original dimensions preserved (using `react-native-compressor`)
- Upload compressed WebP to Cloudflare R2 via presigned URL — original file stays on device untouched
- Auto-generate WebP thumbnail server-side (Sharp.js)
- Add optional caption per photo
- `taken_at` populated from EXIF metadata (falls back to upload time)

> WebP is the universal storage format: supported on iOS 14+, Android API 17+, and all modern browsers. This ensures quality consistency when Android and web are added post-MVP, with no server-side format conversion needed.

### 3. Timeline
- Chronological feed of photos + milestones merged by date
- Infinite scroll with cursor-based pagination
- Date group headers show **baby's age** ("2 months old", "8 months old") derived from `albums.child_birthdate` + `taken_at`, with month/year as secondary label
- Tap photo to view full-resolution
- Milestone cards appear inline at correct date position

### 4. Milestones
- Create milestone with title, note, and date
- Attach a cover photo from the album
- Appears as a special card in the timeline
- Any family member can create milestones

### 5. Family Sharing
- Create a family album (first user becomes admin)
- Generate shareable invite link via deep link (e.g. `familyguy://join/abc123`, or a universal link once a domain is configured)
- Generate QR code from invite token (for in-person sharing)
- Join album by tapping link or scanning QR code
- View list of album members

### 6. Auto-Sync
- On first setup, user grants Photos library access
- App registers a `PHPhotoLibrary` change observer (iOS native)
- When new photos are added to the device camera roll, app detects them in the background and uploads automatically to the family album
- `photos.local_asset_id` (iOS `PHAsset.localIdentifier`) is stored to prevent duplicate uploads on re-sync
- User can toggle auto-sync on/off in settings
- Sync runs when the app is backgrounded; respects iOS background app refresh limits
- Failed uploads are queued and retried on next foreground or background refresh

### 7. Push Notifications
- Push to all members when a new photo is added
- Push to all members when a milestone is created

---

## Post-MVP (Out of Scope)

- In-app camera (use native iOS camera + Photos library instead)
- Reactions and comments
- Video support
- Multiple albums per family
- Photo download / export
- Face recognition / tagging
- Admin controls (remove members, delete others' photos)
- Android app
- Web app

---

## Auth Notes

Apple's App Store guidelines require Sign in with Apple whenever any third-party social login is offered. Since Google Sign-In is offered, Sign in with Apple is mandatory and treated as the primary auth option.

---

## Error Handling

- Auth token validation failures → 401, client redirects to login
- R2 presigned URL expiry → client retries with a fresh URL
- Failed photo registration (after R2 upload) → client shows retry option, orphaned R2 objects cleaned up by a nightly job
- Invite token expired or max uses reached → API returns 410 Gone, app shows "this invite has expired" message
- Auto-sync upload failure → queued locally, retried on next foreground launch or background refresh; user sees a subtle badge on the upload indicator
