# Delete Photo & Edit Note — Design Spec

**Date:** 2026-06-08  
**Status:** Approved

## Summary

Allow users to delete photos/videos they uploaded and edit their captions (notes), including setting a note to empty. Entry point is the story viewer; a new "Quản lý ngày" screen shows all photos for the day with inline note editing and per-photo delete controls.

---

## Backend API

### `DELETE /photos/:id`

- **Auth:** `requireAuth` + `photos.uploaded_by === req.user.id` (ownership, not just membership)
- **Actions:**
  - Delete DB row (cascades to `album_photos`, `reactions`)
  - Delete R2 objects: `r2Key` + `thumbnailKey` (if present)
  - If photo is referenced by `albums.cover_photo_id` → set `cover_photo_id = null`
- **Response:** `204 No Content`
- **Errors:** `403` if not owner, `404` if not found

### `PATCH /photos/:id`

- **Auth:** `requireAuth` + `photos.uploaded_by === req.user.id`
- **Body:** `{ caption: string | null }` — empty string `""` is normalised to `null`
- **Actions:** Update `photos.caption` only
- **Response:** `200` with full photo object (snake_case via `toSnakePhoto`)
- **Errors:** `403` if not owner, `404` if not found

### `GET /albums/:albumId/days/:date/photos` (existing)

- Add `uploaded_by: string` to the response so the mobile can determine ownership per item.

---

## Mobile

### Story Viewer (`/story/[albumId]/[date].tsx`)

- Add a `create-outline` (pencil) icon to `topActions`, to the left of the download icon.
- Always visible (manage screen handles per-item ownership).
- Tap → `router.push(`/story/${albumId}/${date}/manage`)`

### New Screen: `/story/[albumId]/[date]/manage.tsx`

- **Header:** "Quản lý ngày DD/MM" + back button
- **Body:** `FlatList` of all photos/videos for the day
- **Each list item:**
  - Thumbnail ~72×72px using `${API_URL}/photos/${id}/thumb`
  - `TextInput` for note (placeholder "Thêm ghi chú...", multiline, `maxLength=200`, allow empty)
  - Delete icon button (trash) — **only visible if `photo.uploaded_by === currentUserId`**
  - Note field is **read-only** if `photo.uploaded_by !== currentUserId`
- **Note auto-save:** fires `PATCH` `onBlur`, only if value changed from the original
- **Delete flow:** `Alert.alert` confirm → optimistic removal from local list → API call → on error: roll back list + show error toast
- **Empty state after last delete:** `router.back()` immediately after successful delete

### New Hooks

**`useDeletePhoto(albumId, date)`**
- `useMutation` wrapping `DELETE /photos/:id`
- On success: invalidate `['day-photos', albumId, date]` + `['album-days', albumId]`

**`useUpdateCaption(albumId, date)`**
- `useMutation` wrapping `PATCH /photos/:id`
- On success: invalidate `['day-photos', albumId, date]`

### `DayPhoto` interface

Add `uploaded_by: string` to the existing interface in `useDayPhotos.ts`.

---

## i18n (`vi.ts`)

```ts
manage: {
  title:                'Quản lý ngày {{date}}',
  note_ph:              'Thêm ghi chú...',
  delete_confirm_title: 'Xoá ảnh?',
  delete_confirm_body:  'Ảnh sẽ bị xoá vĩnh viễn.',
  delete:               'Xoá',
  cancel:               'Huỷ',
  save_error:           'Không thể lưu ghi chú',
  delete_error:         'Không thể xoá ảnh',
},
```

---

## Data Flow & Cache

| Action | Optimistic? | Invalidates |
|--------|-------------|-------------|
| Delete photo | Yes (remove from local list, roll back on error) | `['day-photos', albumId, date]`, `['album-days', albumId]` |
| Update caption | No | `['day-photos', albumId, date]` |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Delete last photo in day | `router.back()` after successful delete |
| Return to story viewer after manage | `useDayPhotos` re-fetches (invalidated), renders updated list |
| Photo is album cover | Backend sets `albums.cover_photo_id = null` on delete |
| Video items | Same flow as photos (thumbnail + delete + edit note) |
| API error on delete | Roll back optimistic removal, show `Alert` with error message |
| API error on caption save | Show inline error, keep TextInput value |

---

## Authorization Summary

- Only the uploader (`uploaded_by === currentUserId`) can delete or edit note.
- Album membership is required to view the manage screen (inherited from story viewer entry point).
- Backend enforces ownership independently of the mobile check.
