# Family Album Mobile App — Design Spec

**Date:** 2026-06-03
**Status:** Approved

---

## Overview

A shared family photo album iOS app built with Expo (React Native). Parents and family members manually upload high-quality photos of their kids, organized in a chronological timeline with milestone markers and notes. Auto-sync is excluded from MVP.

---

## Platform & Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK (managed workflow, production build) |
| Language | TypeScript |
| Navigation | Expo Router (file-based routing) |
| State | Zustand (lightweight, no boilerplate) |
| Server state | TanStack Query (caching, pagination, background refetch) |
| HTTP client | Axios with JWT interceptor |
| Auth | `expo-apple-authentication` + `@react-native-google-signin/google-signin` |
| Image picker | `expo-image-picker` |
| Image compression | `react-native-compressor` (WebP at quality 0.85) |
| Storage (tokens) | `expo-secure-store` |
| Push notifications | `expo-notifications` (APNs token registration) |
| QR scanner | `expo-barcode-scanner` (join via QR code) |
| Icons | `@expo/vector-icons` (Ionicons) |

---

## Design System — Soft & Dreamy

### Color Tokens

```ts
colors = {
  primary:       '#7C5CBF',  // deep lavender — CTAs, active tabs
  primaryLight:  '#A78BF0',  // medium lavender — gradients, FAB
  primaryPastel: '#C9B8F5',  // soft lavender — accents, borders
  surface:       '#F0EBFF',  // near-white lavender — cards, fields
  background:    '#F8F4FF',  // screen background
  border:        '#E0D4FF',  // input/card borders
  textPrimary:   '#2D1F4E',  // near-black purple — headlines
  textSecondary: '#7A6AAA',  // muted purple — subtitles, captions
  textMuted:     '#B0A0CC',  // placeholder text
  white:         '#FFFFFF',
  gradientStart: '#7C5CBF',
  gradientEnd:   '#A78BF0',
}
```

### Typography

System font: **SF Pro** (iOS default via `-apple-system`).

| Token | Size | Weight | Usage |
|---|---|---|---|
| `heading` | 22px | 800 | Screen titles |
| `title` | 18px | 700 | Card titles, album name |
| `subheading` | 14px | 600 | Section headers |
| `body` | 13px | 400 | Body text, captions |
| `label` | 10px | 700 | Uppercase section labels (letter-spacing 0.8) |
| `caption` | 9px | 500 | Timestamps, metadata |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `xs` | 8px | Photo thumbnails |
| `sm` | 12px | Cards, form fields |
| `md` | 18px | Buttons, bottom sheets |
| `lg` | 28px | Header hero, screen-level cards |
| `full` | 9999px | Pills, badges, FAB |

### Spacing Scale

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48` — used throughout as `xs / sm / md / lg / xl / 2xl / 3xl / 4xl`.

### Shadows

```ts
shadow = {
  card: { shadowColor: '#7C5CBF', shadowOpacity: 0.10, shadowRadius: 12, elevation: 3 },
  fab:  { shadowColor: '#A78BF0', shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
}
```

### Core Components (design system)

All live in `src/components/ui/`:

| Component | Description |
|---|---|
| `Button` | `variant: primary | ghost | danger` · full-width or auto |
| `Card` | White card with `sm` radius and `card` shadow |
| `Badge` | Rounded pill — age label, member count |
| `Avatar` | Circular avatar with initials fallback |
| `TextInput` | Labeled input with lavender focus ring |
| `MilestoneCard` | Left accent border, icon, title, note |
| `PhotoCell` | Thumbnail with optional caption overlay |
| `SectionHeader` | Uppercase label + horizontal rule |
| `HeaderGradient` | Lavender gradient header — shared across screens |
| `EmptyState` | Emoji illustration + message for empty lists |
| `LoadingSpinner` | Lavender spinner |

---

## Navigation

**Pattern:** Expo Router file-based routing with a **5-tab bottom tab bar**.

```
app/
  (auth)/
    index.tsx           ← Sign In screen (redirects if already authed)
  (tabs)/
    _layout.tsx         ← Tab bar definition
    index.tsx           ← Home / Timeline feed
    upload.tsx          ← Upload Photos (tab hides, accessed via FAB)
    milestones.tsx      ← Milestones list
    family.tsx          ← Family members + invite
    settings.tsx        ← Settings (profile, logout, notifications)
  album/
    [id].tsx            ← Album detail (future: multiple albums)
  milestone/
    new.tsx             ← Create milestone sheet
    [id].tsx            ← Milestone detail
  photo/
    [id].tsx            ← Full-screen photo viewer
  invite/
    join.tsx            ← Join album via deep link / QR
```

### Tab Bar

| Tab | Icon | Label |
|---|---|---|
| Home | `home` | Home |
| Timeline | `calendar` | Timeline |
| Upload (center) | FAB `add-circle` | — |
| Moments | `star` | Moments |
| Family | `people` | Family |

The center tab is a **floating action button** (FAB) — larger, elevated, gradient background — that opens the upload flow as a modal sheet. The tab itself has no label.

### Auth Flow

- On cold start: check `expo-secure-store` for JWT token
- If token found → validate silently → navigate to `(tabs)`
- If no token or expired → navigate to `(auth)`
- Deep links (`familyguy://join/:token`) handled by Expo Router — navigates to `invite/join.tsx` regardless of auth state, prompting sign-in first if needed

---

## Screens

### 1. Sign In (`(auth)/index.tsx`)

- Full-screen lavender gradient background with floating bubbles
- App logo (👶 emoji) + app name + tagline
- "Sign in with Apple" button (white, primary) — required
- "Sign in with Google" button (ghost, secondary) — optional
- Privacy policy note at bottom
- On success: stores JWT in `expo-secure-store`, navigates to `(tabs)`

### 2. Timeline / Home (`(tabs)/index.tsx`)

- **Header** — `HeaderGradient` with:
  - Greeting ("Good morning, Sarah ☁️")
  - Album name + ✨ emoji
  - Baby's age badge (derived from `child_birthdate` + today)
  - Family members avatar row (tappable → Family tab)
- **Feed** — `FlatList` with cursor-based pagination
  - `SectionHeader` for each month/year group: "OCTOBER · 14 MONTHS"
  - Photo rows: 2-column grid for 2 photos, 3-column for 3+
  - `MilestoneCard` inline at correct chronological position
  - Tap photo → full-screen viewer (`photo/[id]`)
  - Pull-to-refresh
- **Empty state** — "No photos yet! Tap ➕ to add your first memory 🌸"

### 3. Upload Photos (modal sheet from FAB)

- `expo-image-picker` — multi-select from Photos library
- Selected photos shown as a thumbnail grid (4 per row) with checkmark overlay
- Optional caption text input
- `taken_at` auto-read from EXIF metadata; shown as "📅 Oct 15, 2024 · from photo"
- Progress bar during upload (presign → compress → R2 upload → register)
- On complete: dismiss sheet, refresh timeline feed

**Upload flow:**
1. `POST /photos/presign` → get R2 presigned URL + key
2. Compress image to WebP (quality 0.85) via `react-native-compressor`
3. `PUT` directly to R2 presigned URL
4. `POST /photos` with `{ album_id, r2_key, taken_at, caption }`
5. TanStack Query invalidates timeline cache

### 4. Milestones (`(tabs)/milestones.tsx`)

- List of all milestones sorted by `occurred_at DESC`
- Each item: `MilestoneCard` with icon, title, note preview, date
- Tap → `milestone/[id].tsx` detail (full note, cover photo, date)
- FAB (➕) → `milestone/new.tsx` create sheet

### 5. Add Milestone (`milestone/new.tsx` — modal sheet)

- Title text input (required)
- Date picker (defaults to today)
- Note text area (optional, multiline)
- Cover photo picker — horizontal scroll of album photos; tap to select
- "Save Milestone" button
- On save: `POST /albums/:id/milestones` → dismiss + refresh

### 6. Family (`(tabs)/family.tsx`)

- List of album members with avatar, display name, role badge, join date
- "Invite Family" section:
  - "Copy Invite Link" button → `POST /albums/:id/invites` → copies deep link to clipboard
  - "Show QR Code" button → generates QR via `GET /invites/:token` → shows QR image in a bottom sheet for in-person scanning
- "Scan QR Code" button → opens `expo-barcode-scanner` → reads token → `POST /invites/:token/join`

### 7. Full-Screen Photo Viewer (`photo/[id].tsx`)

- Black background, pinch-to-zoom
- Swipe left/right to navigate adjacent photos
- Caption overlay at bottom (if present)
- Close button (top-left)

### 8. Settings (`(tabs)/settings.tsx`)

- Profile section: avatar, display name, email
- Notifications toggle (APNs permission prompt on first enable)
- Sign out button

---

## State Management

### Zustand stores (`src/stores/`)

| Store | Responsibility |
|---|---|
| `authStore` | JWT token, current user object, sign-in/sign-out actions |
| `albumStore` | Current album ID and metadata |

### TanStack Query (`src/hooks/`)

All server data goes through TanStack Query:

| Hook | Endpoint | Cache key |
|---|---|---|
| `useTimeline(albumId, cursor)` | `GET /albums/:id/timeline` | `['timeline', albumId]` |
| `useMilestones(albumId)` | `GET /albums/:id/milestones` | `['milestones', albumId]` |
| `useMembers(albumId)` | `GET /albums/:id/members` | `['members', albumId]` |
| `useAlbum(albumId)` | `GET /albums/:id` | `['album', albumId]` |

Mutations (`useMutation`) for upload, create milestone, create invite, join.

---

## API Client (`src/lib/api.ts`)

- Axios instance with `baseURL` from `EXPO_PUBLIC_API_URL` env var
- Request interceptor: reads JWT from `authStore`, attaches `Authorization: Bearer <token>`
- Response interceptor: on 401 → clears auth store, navigates to `(auth)`

---

## Push Notifications

- On sign-in: `expo-notifications.getExpoPushTokenAsync()` → `PATCH /users/me` to store APNs token (backend endpoint added in a follow-up task)
- Notification tap handler: navigate to the relevant screen (new photo → timeline, new milestone → milestones tab)

---

## File Structure

```
mobile/
  app/
    (auth)/
      index.tsx
    (tabs)/
      _layout.tsx
      index.tsx
      milestones.tsx
      family.tsx
      settings.tsx
    milestone/
      new.tsx
      [id].tsx
    photo/
      [id].tsx
    invite/
      join.tsx
    _layout.tsx             ← root layout (auth guard, theme provider)
  src/
    components/
      ui/                   ← design system primitives
        Button.tsx
        Card.tsx
        Badge.tsx
        Avatar.tsx
        TextInput.tsx
        MilestoneCard.tsx
        PhotoCell.tsx
        SectionHeader.tsx
        HeaderGradient.tsx
        EmptyState.tsx
        LoadingSpinner.tsx
      timeline/
        TimelineFeed.tsx
        PhotoRow.tsx
        MonthHeader.tsx
      upload/
        UploadSheet.tsx
        PhotoThumbnailGrid.tsx
      family/
        MemberList.tsx
        InviteSheet.tsx
        QRSheet.tsx
    hooks/
      useTimeline.ts
      useMilestones.ts
      useMembers.ts
      useAlbum.ts
      useUpload.ts
    stores/
      authStore.ts
      albumStore.ts
    lib/
      api.ts               ← Axios instance + interceptors
      queryClient.ts       ← TanStack Query client config
      compression.ts       ← react-native-compressor wrapper
      exif.ts              ← EXIF taken_at extraction
    constants/
      theme.ts             ← all design tokens (colors, spacing, radii, shadows, typography)
  assets/
    fonts/                 ← (none — using system SF Pro)
    images/
  app.json                 ← Expo config (bundle ID, icon, splash, deep link scheme)
  .env                     ← EXPO_PUBLIC_API_URL
```

---

## MVP Scope

**Included:**
- Sign in with Apple + Google
- Manual photo upload (pick from library, compress to WebP, upload to R2)
- Timeline feed (photos + milestones, cursor-paginated, age labels)
- Create / view milestones with cover photo
- Family invite (link + QR)
- Join album via deep link or QR scan
- Member list
- Push notifications (receive only)
- Settings (profile, sign out, notifications toggle)

**Excluded (post-MVP):**
- Auto-sync with PHPhotoLibrary
- In-app camera
- Video support
- Comments / reactions
- Multiple albums
- Android support
- Web app

---

## Deep Link Scheme

`familyguy://join/:token` → handled by Expo Router → `invite/join.tsx`

Configured in `app.json`:
```json
{
  "scheme": "familyguy"
}
```
