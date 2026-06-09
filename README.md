# Daylog

Nhật ký video gia đình — quay dọc, lưu mãi, chỉ dành cho bạn.

## Positioning

Ứng dụng lưu giữ khoảnh khắc dành cho **gia đình có con nhỏ**. Khác với Setlog (creator-focused, video ngang), Daylog tập trung vào:

- **Portrait video** — quay dọc tự nhiên như cách bố mẹ thường quay con
- **Lưu trữ lâu dài** — ảnh/video chất lượng cao, không lo mất
- **Giao diện tiếng Việt** — tối ưu cho người dùng Việt Nam
- **Private** — chỉ dành cho gia đình, không phải mạng xã hội

## Pricing Model

| | Free | Premium |
|--|------|---------|
| Ảnh | Nén (compressed) | Chất lượng gốc |
| Video | Giới hạn thời lượng | Full, portrait, chất lượng cao |
| Storage | Free tier | Tính phí theo GB |

- Free tier: ảnh nén, video giới hạn
- Premium (v2): ảnh/video chất lượng cao, tính phí theo GB

## MVP Constraints

- Video hiện giới hạn 2 giây — sẽ khảo sát người dùng để điều chỉnh giới hạn free vs paid
- High-quality storage dự kiến ra mắt ở v2

## Quy trình cập nhật app

| Loại thay đổi | Làm gì | Version |
|---|---|---|
| Fix bug, UI, logic, đổi base URL | `eas update` — OTA, tự push tới user | Không đổi (`1.0.0` → `1.0.0`) |
| Tính năng mới, không breaking | Build mới lên store | `1.0.0` → `1.1.0`, `MIN_APP_VERSION` giữ nguyên `1.0.0` |
| Breaking API / bắt buộc update | Build mới lên store + đổi `MIN_APP_VERSION` trên backend | `1.0.0` → `2.0.0`, set `MIN_APP_VERSION=2.0.0` |
| Thêm native permission hoặc Expo plugin | Build mới lên store (OTA không đủ) | `1.0.0` → `1.1.0` |

**Ví dụ cụ thể từ `1.0.0`:**

```
OTA: sửa lỗi hiển thị ảnh
  → eas update
  → app.json version vẫn 1.0.0
  → user tự nhận bundle mới lần mở app tiếp theo

Store release (không breaking): thêm tính năng react, filter ảnh
  → app.json: version "1.1.0", buildNumber "2" / versionCode 2
  → eas build + submit lên store
  → MIN_APP_VERSION backend giữ "1.0.0" (user cũ vẫn dùng được)

Store release (breaking): đổi backend URL hoặc API breaking change
  → app.json: version "2.0.0", buildNumber "3" / versionCode 3
  → eas build + submit lên store
  → set MIN_APP_VERSION=2.0.0 trên backend → user cũ bị chặn, thấy màn hình bắt update
```

**Quy tắc tăng version (`MAJOR.MINOR.PATCH`):**

| Phần | Khi nào tăng | Ví dụ |
|---|---|---|
| `MAJOR` | Breaking change — user cũ không dùng được, phải set `MIN_APP_VERSION` | `1.x.x` → `2.0.0` |
| `MINOR` | Tính năng mới lên store, user cũ vẫn dùng được | `1.0.x` → `1.1.0` |
| `PATCH` | Không dùng — fix nhỏ dùng OTA, không cần store release | — |

> OTA (`eas update`) không đổi version. `PATCH` chỉ dùng nếu bắt buộc hotfix qua store.

Sau mỗi store release: tăng `version` và `ios.buildNumber` / `android.versionCode` trong `app.json`.

## Links

- Landing page: getdaylog.com
- Bundle ID: com.daylog.app
