# Family Guy — Mobile App

## Trải nghiệm người dùng

Ứng dụng giúp người dùng lưu trữ ảnh và video trực tiếp trên cloud, không lo đầy bộ nhớ máy.

### Chụp và quay trực tiếp trong app

- Người dùng có thể chụp ảnh hoặc quay video ngắn ngay trong ứng dụng.
- Ảnh và video được tải lên cloud ngay sau khi chụp.
- Người dùng premium được lưu ở chất lượng gốc (không nén).

### Upload ảnh từ máy

- Người dùng chọn ảnh hoặc video từ thư viện máy và upload lên app.
- Sau khi upload thành công, app gợi ý xoá bản gốc trên máy để giải phóng bộ nhớ, ví dụ:

  > Đã lưu 20 ảnh lên cloud. Xoá chúng khỏi máy để giải phóng 200 MB?

- Người dùng có thể xác nhận xoá hoặc bỏ qua.

### Lưu cá nhân hoặc chia sẻ album nhóm

- Mỗi ảnh có thể lưu riêng tư (chỉ mình xem) hoặc đưa vào album nhóm gia đình.
- Ví dụ: mẹ chụp ảnh con và lưu vào album chung với bố để cả hai cùng xem và bình luận.

## Kiểm thử E2E (Maestro)

### Cài đặt (một lần)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Cấu hình token

1. Đăng nhập vào app trên simulator, lấy token từ `SecureStore` bằng Expo dev menu → debugger console:
   ```js
   await SecureStore.getItemAsync('auth_token')
   ```
2. Copy file mẫu và điền token:
   ```bash
   cp mobile/.env.e2e.example mobile/.env.e2e
   # Mở .env.e2e và thay thế phần REPLACE_ME bằng token thực
   ```

### Build app với token E2E

```bash
cd mobile
source .env.e2e
npx expo run:ios
```

### Chạy tests

```bash
# Tất cả flows (chạy theo thứ tự)
maestro test e2e/flows/

# Một flow cụ thể
maestro test e2e/flows/01-day-grid.yaml

# Xem hierarchy hiện tại khi debug
maestro hierarchy
```
