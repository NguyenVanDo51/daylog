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
- Non-null = archived (soft-deleted, no undo)
- `GET /albums` list query gains `WHERE archived_at IS NULL`

### Endpoint changes

#### `GET /albums` and `GET /albums/:id` — add `my_role` to response

Both list and detail responses gain:
```json
{ "my_role": "admin" | "member" }
```
Derived by joining `album_members` for the requesting user. Adding it to the list response means `albumStore.setAlbum` (called on album row tap) already has the role — no extra fetch needed on the detail screen.

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

Add `myRole: 'admin' | 'member' | null` field. Set it when the album detail screen loads, sourced from `GET /albums/:id` → `my_role`.

```ts
myRole: 'admin' | 'member' | null
setAlbum: (album: { ..., my_role: 'admin' | 'member' }) => void
```

`myRole` is populated from the `my_role` field in the `GET /albums` list response, which is set when the user taps an album row in `AlbumsPage`. No extra network call required on the detail screen.

### `AlbumMenuSheet`

Becomes role-aware. Props stay the same; add `onRename`, `onArchive`, `onDelete`, `onLeave` callbacks.

**Admin view:**
1. Đổi tên (PencilSimple icon)
2. Thành viên (UsersThree icon)
3. Mời thành viên (UserPlus icon) — hidden if `isPrivate`
4. Lưu trữ album (Archive icon)
5. Xóa album (Trash icon, red color)

**Member view:**
1. Thành viên (UsersThree icon)
2. Rời album (SignOut icon)

### `app/albums/[id].tsx`

Handles all confirmation dialogs and API calls inline (no new screens):

**Rename:**
- Modal with `TextInput` pre-filled with current album name
- On confirm: `PATCH /albums/:id { name }` → update `albumStore.albumName` → invalidate `['albums']`

**Archive:**
- `Alert.alert("Lưu trữ album?", "Thao tác này không thể hoàn tác.", [Huỷ, Lưu trữ])`
- On confirm: `POST /albums/:id/archive` → `router.back()` → invalidate `['albums']`

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
  archive_confirm: 'Lưu trữ album này? Thao tác này không thể hoàn tác.',
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
