# Multi-Album Support — Design Spec

**Date:** 2026-06-06
**Status:** Approved

---

## Overview

Cho phép người dùng tạo và quản lý nhiều album. Mỗi user có đúng 1 album riêng tư ("Ảnh của tôi") được tạo tự động khi đăng ký. Tất cả album khác là shared và có thể mời thêm thành viên. Màn home chuyển thành danh sách album.

---

## Database

**Thay đổi duy nhất trên schema:**

```sql
ALTER TABLE albums ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
```

- `is_private = true`: album cá nhân, chỉ creator xem được, không thể invite
- `is_private = false`: album chung, có thể mời người khác (hành vi hiện tại)

**Migration backfill:** Với mỗi user hiện có, insert 1 album private nếu chưa có:

```sql
INSERT INTO albums (id, name, created_by, is_private, created_at)
SELECT uuid_generate_v4(), 'Ảnh của tôi', u.id, true, now()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM albums a WHERE a.created_by = u.id AND a.is_private = true
);

-- Thêm creator là admin member cho các album vừa tạo
INSERT INTO album_members (id, album_id, user_id, role, joined_at)
SELECT uuid_generate_v4(), a.id, a.created_by, 'admin', now()
FROM albums a
WHERE a.is_private = true
  AND NOT EXISTS (
    SELECT 1 FROM album_members m WHERE m.album_id = a.id AND m.user_id = a.created_by
  );
```

---

## Backend

### Signup flow (auth.ts)

Sau khi tạo user mới (`POST /auth/apple`, `POST /auth/google`), thêm bước:
1. Insert album `{ name: 'Ảnh của tôi', is_private: true, created_by: userId }`
2. Insert `album_members` với role `admin` cho album trên

Thực hiện trong cùng transaction với tạo user.

### `POST /albums`

- Body nhận thêm field `is_private?: boolean` (default `false`)
- Nếu `is_private = true`: kiểm tra user chưa có album private → nếu đã có thì trả 400
- Logic tạo album + thêm creator vào `album_members` giữ nguyên

### `POST /albums/:albumId/invites`

- Thêm kiểm tra: nếu `album.is_private = true` → trả 403 `{ error: 'Cannot invite to a private album' }`

### `GET /albums`

- Trả về thêm field `is_private` trong mỗi album object
- Không thay đổi query (đã join qua `album_members`)

### Các route khác

Không thay đổi — `is_private` chỉ ảnh hưởng đến invite và creation logic.

---

## Mobile

### Màn home — Album list

Tab `(tabs)/index.tsx` được thay bằng màn danh sách album:

- Fetch `GET /albums` khi mount
- Hiển thị album private "Ảnh của tôi" luôn đầu danh sách, badge "Cá nhân"
- Các album shared bên dưới, hiển thị: tên, ảnh bìa, số thành viên
- Nút "+" góc trên phải → sheet tạo album mới (chỉ nhập tên, luôn tạo shared)
- Tap album → navigate đến `albums/[id]` (timeline của album đó)

### Route album timeline

Tạo route mới `mobile/app/albums/[id].tsx`:
- Layout giống `(tabs)/timeline.tsx` hiện tại
- Header có tên album + nút back về album list
- Cập nhật `albumStore` với album đang xem khi enter route này
- Upload/capture vẫn dùng `albumStore.albumId` — không cần thay đổi logic upload

### Settings tab

- Khi đang xem shared album: hiển thị nút mời như hiện tại
- Khi đang xem private album: ẩn nút mời, ẩn danh sách thành viên

### albumStore

Không thay đổi interface — vẫn lưu `{ id, name, isPrivate? }` của album đang active.
Thêm field `isPrivate` để settings tab dùng ẩn/hiện nút invite.

---

## Routing changes

| Trước | Sau |
|---|---|
| `(tabs)/index.tsx` — timeline feed | `(tabs)/index.tsx` — album list |
| `(tabs)/timeline.tsx` — (đang là file .ts redirect) | Xoá, replace bằng `albums/[id].tsx` |
| `albumStore` hardcoded 1 album | `albumStore` set khi user chọn album |

---

## Out of scope

- Xoá album
- Đổi tên / cài đặt album
- Sắp xếp thứ tự album
- Album cover photo picker từ album list
