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

| Loại thay đổi | Làm gì |
|---|---|
| Fix bug, UI, logic, đổi base URL | `eas update` — OTA, tự push tới user |
| Breaking API / cần user bắt buộc update | Build mới lên store + tăng `version` trong `app.json` + đổi `MIN_APP_VERSION` trên backend |
| Thêm native permission hoặc Expo plugin | Build mới lên store (OTA không đủ) |

Sau mỗi store release: tăng `version` (VD `1.1.0`) và `ios.buildNumber` / `android.versionCode` trong `app.json`.

## Links

- Landing page: getdaylog.com
- Bundle ID: com.daylog.app
