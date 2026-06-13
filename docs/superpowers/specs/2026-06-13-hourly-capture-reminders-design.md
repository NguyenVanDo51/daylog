# Capture Reminders (Hourly Push) — Design

**Date:** 2026-06-13
**Status:** Approved
**Owner:** andy

## Goal

Push thân mật, đánh vào cảm xúc, nhắc users ghi lại khoảnh khắc trong ngày. Mỗi user nhận **7 ping/ngày** vào local time **9 / 11 / 13 / 15 / 17 / 19 / 21**, message chọn random từ bank ~10 message theo ngôn ngữ user.

## Scope

**In:**
- Backend cron đẩy push qua existing `services/push.ts` / `expo-server-sdk`.
- Persistent user prefs: `timezone`, `language`, `reminders_enabled`.
- Settings UI: toggle bật/tắt reminders.
- Message banks `vi` + `en` (10 cặp `{title, body}` mỗi cái).

**Out:**
- A/B test message / smart timing per-user / receipt polling cleanup.
- Engagement filter (đã xác nhận: KHÔNG skip dù user đã chụp hôm nay).
- Push receipt → token-health cleanup (làm sau).
- Streak / weekly digest / milestone (vẫn defer per backlog memory).

## Data model

### Migration: alter `users`

```sql
ALTER TABLE users
  ADD COLUMN timezone           TEXT    NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN language           TEXT    NOT NULL DEFAULT 'vi',
  ADD COLUMN reminders_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN last_reminder_sent_at    TIMESTAMPTZ,
  ADD COLUMN last_reminder_message_ids INTEGER[] NOT NULL DEFAULT '{}';
```

- `timezone`: IANA string (`'Asia/Ho_Chi_Minh'`, `'America/Los_Angeles'`…).
- `language`: `'vi' | 'en'`. Open-set string nhưng app chỉ ship 2.
- `reminders_enabled`: settings toggle.
- `last_reminder_sent_at`: idempotency key — cron skip nếu < 90 phút trước.
- `last_reminder_message_ids`: 3 ID gần nhất, để avoid lặp message liền nhau.

### `schema.ts` updates

Cập nhật `users` table thêm các field tương ứng (drizzle).

## Backend

### Message banks

File mới: `backend/src/services/reminderMessages.ts`

```ts
export interface ReminderMessage { id: number; title: string; body: string; }
export const MESSAGES: Record<'vi' | 'en', ReminderMessage[]> = {
  vi: [ /* 10 cặp đã duyệt */ ],
  en: [ /* 10 cặp dịch tương đương */ ],
};
export function pickMessage(lang: string, exclude: number[]): ReminderMessage { /* random pick avoiding exclude */ }
```

10 message tiếng Việt (đã duyệt — IDs 1–10):

```
1. "Hôm nay đẹp ghê" / "Có khoảnh khắc nào đáng giữ không?"
2. "Đôi khi chỉ cần 2 giây" / "Bấm máy thử xem nào"
3. "5 năm nữa nhìn lại…" / "Bạn sẽ mừng vì có hôm nay"
4. "Còn thở là còn thương" / "Lưu lại một khoảnh khắc nho nhỏ?"
5. "Bình thường thôi nhưng…" / "Ngày mai sẽ thành kỷ niệm"
6. "Có gì hay ho?" / "Kể cho mình nghe bằng một tấm ảnh"
7. "Đời ngắn lắm" / "Đừng để hôm nay trôi qua không dấu vết"
8. "2 giây thôi" / "Quay 1 video ngắn cho 'mình ngày sau' xem"
9. "Bạn đang ở đâu giờ này?" / "Khoe một chút coi"
10. "Một việc nhỏ" / "Giữ lại khoảnh khắc này, mai sẽ thấy quý"
```

Bản EN sẽ được dịch giữ tinh thần intimate, để implementer hoàn thiện.

### Cron job

File mới: `backend/src/services/reminderCron.ts`

- Library: `node-cron` (thêm vào `package.json`).
- Lịch chạy: **mỗi 30 phút** (UTC). Granularity đủ để bắt slot đúng giờ user trong mọi TZ.
- Logic:
  ```
  for each user where push_token IS NOT NULL AND reminders_enabled = true AND deleted_at IS NULL:
    local_now = convertTZ(now_utc, user.timezone)
    if local_now.hour NOT IN [9,11,13,15,17,19,21]: continue
    if user.last_reminder_sent_at AND (now_utc - user.last_reminder_sent_at) < 90 minutes: continue
    msg = pickMessage(user.language, user.last_reminder_message_ids)
    sendPushNotification([user.push_token], msg.title, msg.body, { kind: 'capture-reminder' })
    UPDATE users SET
      last_reminder_sent_at = now_utc,
      last_reminder_message_ids = (array_prepend(msg.id, last_reminder_message_ids))[1:3]
    WHERE id = user.id
  ```
- TZ conversion: dùng `Intl.DateTimeFormat` hoặc `date-fns-tz` (lib có thể đã có; nếu chưa thì thêm `@date-fns/tz` — nhỏ, native ICU).
- Khởi động: import + start trong `backend/src/index.ts` sau khi DB ready.

### Route updates

**`PATCH /users/me`** đã có cho `push_token`. Mở rộng để chấp nhận `timezone`, `language`, `reminders_enabled`:

```ts
{ push_token?, timezone?, language?, reminders_enabled? }
```

Validation:
- `timezone`: chuỗi IANA hợp lệ (try `Intl.DateTimeFormat(undefined, { timeZone: tz })`; throw → 400).
- `language`: `'vi' | 'en'` (whitelist; fallback `vi` nếu nhận giá trị khác).
- `reminders_enabled`: boolean.

## Mobile

### Lifecycle hook

Trong `app/_layout.tsx`, ngay sau `registerPushToken()` thành công:

```ts
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const lang = currentLanguage(); // existing i18n hook returns 'vi' | 'en'
await api.patch('/users/me', { timezone: tz, language: lang });
```

Gọi mỗi lần app start (idempotent, cheap).

### Settings toggle

Trong `app/(tabs)/settings/index.tsx`, thêm 1 row dưới push toggle hiện tại:

```
[ Toggle ]  Nhắc tôi ghi lại khoảnh khắc
            7 nhắc/ngày từ 9h sáng đến 9h tối
```

- ON / OFF → PATCH `/users/me { reminders_enabled }`.
- Default ON (DB default = true; chỉ hiện toggle nếu push permission đã grant).
- Locale: thêm key `settings.reminders_label` + `settings.reminders_hint` vào `vi.ts` + `en.ts`.

## Edge cases

- **User không có push permission**: cron vẫn cố `sendPushNotification`, Expo trả lỗi, `services/push.ts` đã handle invalid token (xoá token). Để bảo vệ, settings UI ẩn toggle khi chưa grant.
- **TZ vô lệ trong DB**: validation ở PATCH chặn từ đầu. Nếu lọt qua, `convertTZ` throw → cron log + skip user đó (không crash toàn job).
- **User di chuyển múi giờ**: mỗi lần mở app sẽ PATCH lại; cron tự lấy giá trị mới nhất.
- **Cron miss tick (server restart)**: bỏ qua slot đó cho user nào chưa được gửi — chấp nhận (worst case mất 1 ping).
- **Multiple servers / horizontal scale**: hiện single instance. Nếu sau này scale, cần distributed lock (Redis / pg_advisory_lock); ngoài scope MVP.
- **Token chết / user uninstall**: `services/push.ts` đã set `pushToken = NULL` khi gặp `DeviceNotRegistered`; cron tự skip lần sau.

## Tests

Backend:
- `reminderMessages.test.ts`: `pickMessage` không trả ID nằm trong `exclude`; rotation qua nhiều lần phủ hết bank.
- `reminderCron.test.ts` (unit, mock `sendPushNotification` + clock):
  - Skip user khi `reminders_enabled = false`.
  - Skip user khi `push_token = null`.
  - Skip user khi `local_now.hour` không phải slot.
  - Skip khi `last_reminder_sent_at` < 90 min.
  - Send + update `last_reminder_sent_at` + prepend message_id (giữ tối đa 3).
  - Hai user khác TZ: cùng cron tick xử lý đúng giờ local của mỗi user.
- `users.test.ts` (route): PATCH chấp nhận và lưu `timezone` / `language` / `reminders_enabled`; trả 400 cho TZ vô lệ.

Mobile:
- `notifications.test.ts`: PATCH gồm `timezone` + `language` sau khi `registerPushToken`.
- `settings.test.tsx`: toggle reminders gọi đúng endpoint + persist UI state.

## Open questions / risks

- **`date-fns-tz` vs `Intl`**: Intl built-in đủ; thêm lib chỉ cần khi cần arithmetic trên zoned datetime. Để implementer chọn.
- **EN message bank**: cần native review trước khi ship. Có thể bắt đầu với MVP EN và polish sau.
- **Settings UI strings**: cần đảm bảo locale có sẵn key `settings.reminders_*` ở cả 2 ngôn ngữ.

## Files affected

- `backend/src/db/schema.ts` — modify
- `backend/src/db/migrations/000X_user_reminder_prefs.sql` — new
- `backend/src/services/reminderMessages.ts` — new
- `backend/src/services/reminderCron.ts` — new
- `backend/src/index.ts` — start cron
- `backend/src/routes/users.ts` — accept new fields in PATCH
- `backend/package.json` — add `node-cron` (+ optional `date-fns-tz`)
- `mobile/app/_layout.tsx` — PATCH timezone + language after register
- `mobile/app/(tabs)/settings/index.tsx` — add reminder toggle row
- `mobile/src/locales/vi.ts` + `en.ts` — settings strings
- Tests: backend (`reminderMessages.test.ts`, `reminderCron.test.ts`, `users.test.ts`), mobile (`notifications.test.ts`, `settings.test.tsx`)
