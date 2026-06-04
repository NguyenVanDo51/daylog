# Engagement Loop — Design Spec

**Date:** 2026-06-04
**Status:** Approved

---

## Overview

Thiết kế vòng lặp engagement để người dùng có động lực mở app thường xuyên và chủ động lưu ảnh con. Hai cơ chế chính: reaction system tạo feedback loop giữa bố và mẹ, storage freedom tạo lý do thực tế để mở app.

**Core insight:** Mẹ sẽ không chủ động upload nếu không có feedback. Bố xem ảnh nhưng mẹ không biết → không có reward → mẹ lười upload. Reactions đóng vòng lặp này.

```
Mẹ upload ──► Bố xem + react ──► Notify mẹ ──► Mẹ upload tiếp
     ▲                                                   │
     └───────────────────────────────────────────────────┘
```

---

## Tính năng 1: Reaction System

### Interaction

- **Trigger:** Long-press hoặc double-tap vào ảnh trong timeline
- **Picker:** 4 emoji xuất hiện dạng popover: ❤️ 😂 😍 🥹
- **Tap để chọn** → reaction được ghi nhận, picker đóng lại
- **Tap lại emoji đã chọn** → bỏ reaction

### Hiển thị

- Reaction icon + số lượng hiển thị ở góc dưới phải của ảnh trong timeline
- Nếu có nhiều loại reaction: hiển thị 2 emoji phổ biến nhất + tổng số
- Ví dụ: `❤️ 😍 3`

### Push Notifications

| Sự kiện | Người nhận | Nội dung |
|---|---|---|
| Bố react vào ảnh | Mẹ (người upload) | *"Bố đã gửi ❤️ cho ảnh của [tên bé]"* |
| Mẹ react vào ảnh | Bố (người react nhận về uploader) | *"Mẹ đã gửi 😍 cho ảnh bé vừa xem"* |
| Bất kỳ member react | Uploader | *"[Tên] đã react ảnh của bé"* |

Không gửi notification cho chính người đã react.

### Data Model

```sql
reactions
  id          UUID PK
  photo_id    UUID → photos
  user_id     UUID → users
  emoji       VARCHAR(8)   -- '❤️', '😂', '😍', '🥹'
  created_at  TIMESTAMPTZ

UNIQUE (photo_id, user_id)  -- 1 reaction per user per photo
```

### API

```
POST   /photos/:id/reactions   { emoji }   → upsert reaction
DELETE /photos/:id/reactions               → remove reaction
GET    /photos/:id/reactions               → list reactions (count by emoji)
```

---

## Tính năng 2: Storage Freedom

### Trigger (passive)

Sau khi ảnh được upload thành công lên app, hiển thị **badge thụ động** — không notification, không popup tự động:

- Badge số trên tab Upload hoặc banner nhỏ trên home screen
- Nội dung: *"47 ảnh đã lưu an toàn — Giải phóng 1.8GB"*
- Chỉ hiện khi có ≥ 1 ảnh đã sync mà chưa xoá local

### Flow xoá

1. User tap badge/banner
2. Hiện modal danh sách ảnh đã sync an toàn (thumbnail + tổng dung lượng)
3. Nút: **"Xoá [X] ảnh khỏi điện thoại"**
4. Confirm tap → xoá local asset qua `react-native-cameraroll` hoặc `expo-media-library`
5. Hiện toast: *"Đã giải phóng 1.8GB trên điện thoại của bạn"* ← satisfying moment, 1 lần duy nhất
6. Badge biến mất

### Nguyên tắc

- App **không tự xoá** ảnh local — chỉ khi user chủ động confirm
- **Không gửi notification** về số ảnh đã lưu/đã xoá — tránh spam
- Badge chỉ hiện sau khi ảnh đã verify sync thành công (response 200 từ API + thumbnail generated)

### Tracking

Thêm field vào bảng `photos`:

```sql
local_deleted   BOOLEAN DEFAULT FALSE
local_deleted_at TIMESTAMPTZ
```

---

## Out of Scope (Waitlist)

Các tính năng dưới đây đã được note vào backlog, không build trong sprint này:

- Upload streak (chuỗi ngày liên tiếp)
- Weekly digest notification cho bố
- Milestone auto-prompt ("Bé sắp tròn 3 tháng")
- Auto-sync UX/onboarding flow
