# Album Management — Design Spec

**Date:** 2026-06-10
**Status:** Approved

## Overview

Add album management actions surfaced through the existing `AlbumMenuSheet` (`...` button on the album detail screen). Admins can rename, archive, or delete an album. Members can leave an album.

---

## Backend

### Database

Add `archived_at` column to the `albums` table:

```sql
ALTER TABLE albums ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
```

- `NULL` = active album
- Non-null = archived (read-only, no undo)
- Archived albums remain visible in the list and detail screen but all write operations are blocked
- `GET /albums` list returns archived albums too; response includes `archived_at` field

### Endpoint changes

#### `GET /albums` and `GET /albums/:id` — add `my_role` and `archived_at` to response

Both list and detail responses gain:
```json
{ "my_role": "admin" | "member", "archived_at": "<iso>" | null }
```
`my_role` is derived by joining `album_members` for the requesting user. Adding both fields to the list response means `albumStore.setAlbum` (called on album row tap) already has role and archive state — no extra fetch needed on the detail screen.

#### Write-protection for archived albums

All endpoints that mutate album content must check `archived_at IS NOT NULL` and return `409 { error: "Album is archived" }` if set. Affected endpoints:
- `POST /photos` (upload)
- `POST /photos/capture`
- `PATCH /photos/:id` (caption edit)
- `POST /reactions`
- `PUT /album-days/:albumId/:date/label` (day label)
- `PATCH /albums/:id` (rename — blocked while archived)
- `POST /invites` (new invites blocked while archived)

#### `POST /albums/:id/archive` (admin only)

- 403 if caller is not an admin member
- 409 if `archived_at` is already set
- Sets `archived_at = NOW()`
- Returns `{ archived_at: "<iso>" }`

#### `DELETE /albums/:id` (admin only)

- 403 if caller is not an admin member
- Fetches all `r2Key` and `thumbnailKey` values for photos in the album
- Bulk-deletes R2 objects
- Deletes the album row (cascade removes `album_members`, `photos`, `album_photos`, `day_labels`, `invites`, `reactions`)
- Returns 204

#### `DELETE /albums/:id/members/me` (any member)

- 404 if the caller is not a member
- Removes the caller's row from `album_members`
- Allowed even if caller is the last admin (album becomes admin-less)
- Returns 204

#### `PATCH /albums/:id` (admin only) — unchanged

Rename uses the existing endpoint with `{ name }`. No changes needed.

---

## Frontend

### `albumStore`

Add `myRole` and `archivedAt` fields. Both are populated from the `GET /albums` list response when the user taps an album row — no extra network call on the detail screen.

```ts
myRole:     'admin' | 'member' | null
archivedAt: string | null   // ISO timestamp or null
setAlbum: (album: { ..., my_role: 'admin' | 'member', archived_at: string | null }) => void
```

### `AlbumMenuSheet`

Becomes role-aware and archive-aware. Add `onRename`, `onArchive`, `onDelete`, `onLeave` callbacks. Reads `myRole` and `archivedAt` from `albumStore`.

**Admin — active album:**
1. Đổi tên (PencilSimple icon)
2. Thành viên (UsersThree icon)
3. Mời thành viên (UserPlus icon) — hidden if `isPrivate`
4. Lưu trữ album (Archive icon)
5. Xóa album (Trash icon, red color)

**Admin — archived album:**
1. Thành viên (UsersThree icon)
2. Xóa album (Trash icon, red color)
_(Rename, Invite, and Archive hidden — album is read-only)_

**Member — active album:**
1. Thành viên (UsersThree icon)
2. Rời album (SignOut icon)

**Member — archived album:**
1. Thành viên (UsersThree icon)
2. Rời album (SignOut icon)

### Read-only banner — `app/albums/[id].tsx`

When `archivedAt` is non-null, show a banner below the header:
> "Album đã lưu trữ — chỉ đọc" (Archive icon + muted text, no action)

Camera/upload FAB is hidden when `archivedAt` is non-null.

### `app/albums/[id].tsx`

Handles all confirmation dialogs and API calls inline (no new screens):

**Rename:**
- Modal with `TextInput` pre-filled with current album name
- On confirm: `PATCH /albums/:id { name }` → update `albumStore.albumName` → invalidate `['albums']`

**Archive:**
- `Alert.alert("Lưu trữ album?", "Album sẽ chuyển sang chế độ chỉ đọc. Thao tác này không thể hoàn tác.", [Huỷ, Lưu trữ])`
- On confirm: `POST /albums/:id/archive` → invalidate `['albums']` → stay on detail screen (now in read-only mode)

**Delete:**
- `Alert.alert("Xóa album?", "Tất cả ảnh sẽ bị xóa vĩnh viễn.", [Huỷ, { text: "Xóa", style: "destructive" }])`
- On confirm: `DELETE /albums/:id` → `router.back()` → invalidate `['albums']`

**Leave:**
- `Alert.alert("Rời album?", "Bạn sẽ không còn quyền xem album này.", [Huỷ, Rời])`
- On confirm: `DELETE /albums/:id/members/me` → `router.back()` → invalidate `['albums']`

### i18n

Add to `vi.ts` and `en.ts`:

```ts
album_menu: {
  // existing keys...
  rename:          'Đổi tên',
  archive:         'Lưu trữ album',
  delete_album:    'Xóa album',
  leave_album:     'Rời album',
  rename_title:    'Đổi tên album',
  archive_confirm: 'Album sẽ chuyển sang chế độ chỉ đọc. Thao tác này không thể hoàn tác.',
  archived_banner: 'Album đã lưu trữ — chỉ đọc',
  delete_confirm:  'Xóa album này? Tất cả ảnh sẽ bị xóa vĩnh viễn.',
  leave_confirm:   'Rời album này? Bạn sẽ không còn quyền xem album này.',
}
```

---

## Error handling

- Archive/delete/leave show `Alert.alert(t('common.error'), ...)` on API failure
- Rename shows inline error or toast on failure
- 403 responses fall through to the global error handler (existing behavior)

## Testing

- Backend: unit tests for each new endpoint (archive, delete, leave) covering 200/204, 403, 404, 409 cases
- Frontend: `AlbumMenuSheet` tests verify admin vs member item rendering based on `myRole`
- No E2E tests required for this feature
