# Background Upload UX — Design Spec

**Date:** 2026-06-07  
**Status:** Approved

## Problem

Hiện tại, toàn bộ quá trình upload (presign + nén + PUT lên R2 + POST /photos) chỉ bắt đầu khi user nhấn "Lưu lại". User phải chờ loading trong 3–15 giây tùy file size và mạng. UX kém.

## Goal

Upload bắt đầu ngầm ngay khi user thấy preview. Khi nhấn "Lưu lại", loading chỉ xuất hiện nếu upload chưa xong.

## Design

### Backend — `POST /photos/presign`

Bỏ yêu cầu `album_id`. Field này trở thành optional:
- Nếu `album_id` có → vẫn check membership như cũ
- Nếu không có → skip check (chỉ cần auth)

Membership validation vẫn giữ nguyên ở `POST /photos`. Không có thay đổi security cho việc đọc ảnh — presign URL chỉ dùng để PUT (upload), không phải GET.

### Mobile — Tách `capture()` thành 2 pha

**Phase 1: `startBackgroundUpload(asset)`**

Chạy ngay khi `photo-review` screen mount. Không cần `albumIds`.

Steps:
1. Gọi `POST /photos/presign` (không có `album_id`)
2. Nén ảnh sang WebP (hoặc extract video thumbnail song song với video upload)
3. PUT file lên presigned URL
4. Resolve với `{ r2Key, thumbnailR2Key? }`

Retry: tối đa 3 lần với exponential backoff (1s, 2s, 4s). Nếu cả 3 lần fail thì lưu error.

**Phase 2: `finishCapture(uploadResult, albumIds)`**

Gọi khi user nhấn "Lưu lại":
1. POST `/photos` với `r2_key` + `album_ids` + metadata
2. Invalidate React Query cache

### Mobile — `photo-review.tsx`

- Mount → gọi `startBackgroundUpload(asset)`, lưu Promise vào `uploadPromiseRef`
- Resolved value lưu vào `uploadResultRef` (không cần re-render)
- Nhấn "Lưu lại":
  - `uploadResultRef` đã có → gọi `finishCapture` ngay, không show loading
  - Chưa có (upload đang chạy) → set `capturing = true`, await promise, rồi `finishCapture`
  - Upload đã fail (sau 3 retries) → `Alert.alert('Lỗi', '...')`
- Retake / đóng → bỏ qua kết quả upload (file orphan trên R2 chấp nhận được, có rate limit bảo vệ)

## Edge Cases

| Tình huống | Xử lý |
|---|---|
| Mạng nhanh, upload xong trước khi Lưu | Nhấn Lưu → tức thì, không loading |
| Mạng chậm, chưa xong khi Lưu | Show loading, await upload xong rồi POST /photos |
| Background upload lỗi (transient) | Auto-retry tối đa 3 lần, backoff 1s/2s/4s |
| Background upload lỗi (sau 3 retries) | Alert khi nhấn Lưu |
| User retake trước khi upload xong | Promise bị bỏ qua, file orphan trên R2 |
| Video (file lớn) | Thumbnail + video upload song song trong Phase 1 |

## Files Changed

**Backend:**
- `backend/src/routes/photos.ts` — bỏ `album_id required` ở presign handler

**Mobile:**
- `mobile/src/hooks/useCapture.ts` — tách thành `startBackgroundUpload` + `finishCapture`
- `mobile/app/photo-review.tsx` — trigger background upload on mount, await on save
