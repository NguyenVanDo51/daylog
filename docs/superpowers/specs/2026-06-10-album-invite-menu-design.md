# Album Detail Invite Menu — Design Spec

**Date:** 2026-06-10

## Overview

Add a three-option menu to the album detail screen header that surfaces the already-built invite, QR scan, and member list features. All members (not just admins) can access all three options.

## Components

### 1. Header change — `mobile/app/albums/[id].tsx`

Replace the right-side spacer with a `DotsThree` icon button. Tapping sets `menuOpen = true`. The back button and centered album title are unchanged.

### 2. New: `AlbumMenuSheet`

**File:** `mobile/src/components/family/AlbumMenuSheet.tsx`

A bottom sheet with three tappable rows:

| Icon | Label (Tiếng Việt) | Action |
|---|---|---|
| `UsersThree` | Thành viên | Close menu → open MembersSheet |
| `UserPlus` | Mời thành viên | Close menu → open InviteSheet |
| `QrCode` | Quét mã QR | Close menu → open QRSheet |

**Props:** `albumId: string`, `visible: boolean`, `onClose: () => void`, `onOpenMembers: () => void`, `onOpenInvite: () => void`, `onOpenQR: () => void`

### 3. New: `MembersSheet`

**File:** `mobile/src/components/family/MembersSheet.tsx`

Thin wrapper that renders `MemberList` inside a bottom sheet. Same structural pattern as `InviteSheet`.

**Props:** `albumId: string`, `visible: boolean`, `onClose: () => void`

### 4. State in `AlbumScreen`

Four boolean flags:

```ts
const [menuOpen, setMenuOpen] = useState(false);
const [inviteOpen, setInviteOpen] = useState(false);
const [qrOpen, setQrOpen] = useState(false);
const [membersOpen, setMembersOpen] = useState(false);
```

`AlbumMenuSheet` callbacks each call `setMenuOpen(false)` then set the relevant open flag to `true`. All four sheets are rendered at the bottom of the screen tree with their respective `visible` and `onClose` props.

## Existing components used (no changes needed)

- `InviteSheet` — `mobile/src/components/family/InviteSheet.tsx`
- `QRSheet` — `mobile/src/components/family/QRSheet.tsx`
- `MemberList` — `mobile/src/components/family/MemberList.tsx`
- `useMembers` hook — `mobile/src/hooks/useMembers.ts`

## Out of scope

- Role-based access control (all members see all three options)
- Admin-only actions (remove member, revoke invite)
- Deep link handling changes
