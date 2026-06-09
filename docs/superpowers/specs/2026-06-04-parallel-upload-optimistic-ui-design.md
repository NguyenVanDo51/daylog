# Parallel Upload + Optimistic Placeholder UI

**Date:** 2026-06-04  
**Updated:** 2026-06-09  
**Status:** Partially implemented — parallel upload ✅, optimistic placeholder ❌ not integrated

> **Note:** `PendingPhotoCell` component exists but is not rendered in the timeline. Timeline does not show optimistic placeholders; it only shows confirmed photos from the server after upload completes.

## Mục tiêu

Cải thiện trải nghiệm upload ảnh theo hai hướng:

1. **Parallel upload** — thay vòng `for` tuần tự bằng concurrency pool 3 slot, mỗi slot chạy pipeline đầy đủ độc lập.
2. **Optimistic placeholder** — ngay khi user nhấn upload, hiện placeholder (thumbnail local, shimmer) trên timeline. Từng ảnh xong thì fade in. Cuối cùng invalidate query để load ảnh thật từ server.

---

## Architecture

### Concurrency Pool

File mới: `mobile/src/lib/concurrency.ts`

```ts
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]>
```

- Không dùng thư viện ngoài
- Dùng `Promise.allSettled` bên trong — lỗi một slot không dừng các slot còn lại
- Slot nào xong thì kéo task tiếp vào ngay (không batch cứng)

### Pending Upload Store

File mới: `mobile/src/stores/pendingUploadStore.ts` (Zustand)

```ts
interface PendingPhoto {
  id: string;        // uuid tạo local
  localUri: string;  // URI ảnh trên thiết bị — dùng làm source hiển thị
  status: 'uploading' | 'done' | 'error';
}
```

Actions: `addPending(photos)`, `markDone(id)`, `markError(id)`, `clearAll()`

Tách khỏi `uploadStore` hiện tại để không ảnh hưởng logic Storage Freedom.

### Upload Flow

`useUpload.ts` — thay `for` loop bằng:

```
uploadImages(assets):
  1. addPending(assets) → store ngay, timeline render placeholder
  2. runWithConcurrency(assets.map(a => () => uploadOne(a)), 3)
     uploadOne(asset):
       presign → compressToWebP → PUT R2 → register API
       thành công → markDone(id)
       thất bại  → markError(id), ghi lại failedCount
  3. invalidateQueries(['timeline'])
  4. clearAll() sau delay ngắn (400ms) để transition seamless
  5. nếu failedCount > 0 → toast: "X ảnh thành công, Y ảnh thất bại"
```

### Timeline — Optimistic Placeholder

`TimelineFeed.tsx` đọc `pendingUploadStore`, render `PendingPhotoCell` ở **trên cùng** — trước row tháng mới nhất.

File mới: `mobile/src/components/timeline/PendingPhotoCell.tsx`

- Source ảnh: `localUri` (render ngay không cần mạng)
- `status === 'uploading'`: opacity mờ (0.5) + shimmer overlay (Animated loop)
- `status === 'done'`: Animated fade in opacity 0.5 → 1, duration 300ms
- `status === 'error'`: opacity mờ + icon lỗi nhỏ góc trên phải

---

## Data Flow

```
User nhấn Upload
  → addPending(N photos) vào store
  → TimelineFeed render N PendingPhotoCell (shimmer)

runWithConcurrency (3 slot song song):
  slot 1 xong → markDone → fade in
  slot 2 xong → markDone → fade in
  slot 3 lỗi  → markError → icon lỗi
  slot 4 kéo vào...

Tất cả xong:
  → invalidateQueries → timeline load ảnh thật
  → delay 400ms → clearAll() → placeholder biến mất
  → nếu có lỗi → toast tổng kết
```

---

## Files thay đổi

| File | Loại | Thay đổi |
|------|------|----------|
| `src/lib/concurrency.ts` | Tạo mới | `runWithConcurrency` |
| `src/stores/pendingUploadStore.ts` | Tạo mới | Zustand store cho pending photos |
| `src/hooks/useUpload.ts` | Sửa | Parallel upload, tích hợp pendingStore |
| `src/components/timeline/TimelineFeed.tsx` | Sửa | Render PendingPhotoCell ở đầu |
| `src/components/timeline/PendingPhotoCell.tsx` | Tạo mới | Shimmer + fade-in animation |

---

## Quyết định thiết kế

- **Concurrency limit = 3**: cân bằng tốc độ và bộ nhớ/băng thông trên thiết bị yếu
- **clearAll sau 400ms**: đủ thời gian để query invalidation hoàn tất, tránh nhấp nháy
- **Không retry tự động**: giữ đơn giản, user có thể upload lại nếu cần
- **localUri làm source**: render ngay không chờ server, trải nghiệm tức thì

---

## Không nằm trong scope

- Retry tự động khi lỗi
- Giới hạn số ảnh được chọn
- Upload queue persistent (resume sau khi tắt app)
