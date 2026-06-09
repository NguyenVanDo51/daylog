# TODO

## Trước khi OTA update hoạt động

- [ ] Tạo `EXPO_TOKEN` trên [expo.dev](https://expo.dev) → Account Settings → Access Tokens
- [ ] Thêm `EXPO_TOKEN` vào GitHub repo → Settings → Secrets and variables → Actions
- [ ] Link EAS project (`eas init` trong thư mục `mobile/`) để lấy `projectId`
- [ ] Thêm `updates.url` vào `mobile/app.json` (lấy từ EAS dashboard sau khi link project)

## Trước khi submit App Store (iOS)

- [ ] Điền `ios.ascAppId` trong `mobile/eas.json` (App Store Connect App ID)
- [ ] Điền `ios.appleTeamId` trong `mobile/eas.json`
- [ ] Set `EXPO_PUBLIC_APP_STORE_URL` trong EAS secrets (sau khi có App Store ID)

## Trước khi submit Google Play (Android)

- [ ] Tạo service account key cho Google Play và upload lên EAS
