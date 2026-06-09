# Force Update & OTA Update Design

**Date:** 2026-06-09
**Status:** Approved

## Overview

Daylog cần cơ chế cập nhật ứng dụng cho hai trường hợp:
1. **Force update** — breaking change (đổi backend URL, API breaking) → chặn app, bắt user cập nhật qua store
2. **OTA update** — thay đổi JS/logic/UI → tải ngầm, hỏi user restart

## Architecture

### Luồng khởi động

```
App khởi động
  → gọi GET /version (không cần auth)
  → so sánh currentVersion với minVersion (semver)
     ├── currentVersion < minVersion → ForceUpdateScreen (chặn cứng)
     └── OK → tiếp tục vào app bình thường

Đồng thời (background):
  → expo-updates kiểm tra OTA mới
     ├── Có update → tải ngầm xong → Alert hỏi restart
     └── Không có → không làm gì
```

### Lấy version hiện tại

Dùng `expo-application` (`Application.nativeApplicationVersion`) — khớp với version trong `app.json` và App Store.

### So sánh version

Dùng thư viện semver — không tự compare string.

## Backend

### Endpoint `GET /version`

Public, không cần auth.

**Response:**
```json
{
  "minVersion": "1.0.0",
  "latestVersion": "1.2.0"
}
```

### Config

Không cần database — dùng env var:

```typescript
// backend/src/routes/version.ts
const VERSION_CONFIG = {
  minVersion: process.env.MIN_APP_VERSION ?? '1.0.0',
  latestVersion: process.env.LATEST_APP_VERSION ?? '1.0.0',
};
```

Khi có breaking change: đổi `MIN_APP_VERSION` trên server và restart — không cần deploy code.

## UI

### ForceUpdateScreen

- Toàn màn hình, vô hiệu hóa back gesture
- Hiển thị thông báo tiếng Việt: "Cần cập nhật ứng dụng"
- Nút "Cập nhật ngay" → `Linking.openURL()` đến App Store (iOS) / Google Play (Android)
- Không có nút đóng / bỏ qua

### OTA Update Alert

Native Alert sau khi bundle mới tải xong:

```
"Có bản cập nhật mới"
"Khởi động lại để áp dụng bản mới nhất?"

[Để sau]   [Khởi động lại]
```

- "Khởi động lại" → `Updates.reloadAsync()`
- "Để sau" → không làm gì, áp dụng lần mở tiếp theo

### Vị trí trong app

Root layout (`app/_layout.tsx`) — chạy trước khi render bất kỳ màn hình nào. Khi version check đang loading, giữ splash screen bằng `expo-splash-screen`.

## Quy trình Release

| Loại thay đổi | Hành động |
|---|---|
| Fix bug, thêm tính năng JS | `eas update` → OTA tự push |
| Breaking API change | Build store mới + đổi `MIN_APP_VERSION` trên backend |
| Đổi base URL backend | `eas update` (OTA đủ) |
| Thêm native permission / Expo plugin | Build store mới |

## Versioning

`app.json` cần bump đúng trước mỗi store release:
- `version` (VD: `"1.1.0"`) — cái backend so sánh với `minVersion`
- `ios.buildNumber` / `android.versionCode` — tăng mỗi lần submit store

## Files Affected

**Backend:**
- `backend/src/routes/version.ts` — route mới
- `backend/src/index.ts` — đăng ký route

**Mobile:**
- `mobile/app/_layout.tsx` — thêm version check + OTA check logic
- `mobile/src/components/ui/ForceUpdateScreen.tsx` — màn hình chặn mới
- `mobile/package.json` — thêm `expo-application`, `semver`
