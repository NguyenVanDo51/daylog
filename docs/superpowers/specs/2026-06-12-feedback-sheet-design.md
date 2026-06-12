# Feedback Sheet — Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Summary

Replace the "Đăng xuất" row in the top-right `SettingsSheet` with a "Góp ý" row that opens a feedback modal. The modal asks the user to rate Daylog on a 5-emoji scale (Rất tệ → Rất tốt) and optionally leave a freeform message (bug report, suggestion, praise). Submissions are persisted to a new `feedback` table via `POST /feedback`. Logout remains accessible from the bottom of the full Settings screen (`(tabs)/settings/index.tsx`).

---

## Backend

### Table: `feedback`

New Drizzle migration:

| column        | type                        | notes                                  |
|---------------|-----------------------------|----------------------------------------|
| `id`          | `uuid` PK default `gen_random_uuid()` |                              |
| `user_id`     | `uuid` not null, FK `users(id)` on delete cascade |                  |
| `rating`      | `integer` not null          | check constraint: `BETWEEN 1 AND 5`    |
| `message`     | `text` nullable             | length capped client-side at 2000 chars |
| `app_version` | `text` nullable             |                                        |
| `platform`    | `text` nullable             | `'ios' \| 'android' \| 'web'`          |
| `created_at`  | `timestamptz` not null default `now()` | |

Index: `(user_id, created_at desc)` for future "my submissions" lookups; not required by MVP UI but cheap to add now.

### Route: `POST /feedback`

File: `backend/src/routes/feedback.ts`, mounted in `backend/src/app.ts`.

- **Auth:** `requireAuth` (same middleware used by other routes).
- **Body (zod):**
  ```ts
  z.object({
    rating: z.number().int().min(1).max(5),
    message: z.string().trim().max(2000).optional(),
    app_version: z.string().max(64).optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
  })
  ```
  Empty/whitespace-only `message` is normalised to `null` before insert.
- **Action:** Insert one row with `user_id = req.user.id` and the validated fields.
- **Response:** `204 No Content` (empty body — client doesn't need the row back).
- **Errors:**
  - `400` on validation failure (standard zod error shape used elsewhere in the codebase).
  - `401` when unauthenticated (from `requireAuth`).

No rate limiting in MVP. If abuse appears later, add a simple per-user-per-day cap.

---

## Mobile

### `SettingsSheet.tsx` changes (`mobile/src/components/tabs/SettingsSheet.tsx`)

- Remove the "Đăng xuất" `TouchableOpacity` (lines 39–46) and the `handleLogout` function (lines 24–27). Drop the `useAuthStore` import and the `SignOut` icon import.
- Add a new row below "Cài đặt":
  - Icon: `ChatCircleDots` from `phosphor-react-native`, bg `theme.colors.accent4`.
  - Label: `t('settings.feedback')`.
  - `testID="menu-feedback"`.
- Tapping the row closes the settings sheet and opens the feedback sheet. The sheet's open state lives in the parent — `mobile/src/components/tabs/AlbumsPage.tsx` (renders `SettingsSheet` at line 172). Wiring:
  - `AlbumsPage` already has `menuVisible`. Add a sibling `feedbackVisible` state and render `<FeedbackSheet visible={feedbackVisible} onClose={() => setFeedbackVisible(false)} />` next to `<SettingsSheet ... />`.
  - `SettingsSheet` gains an `onOpenFeedback: () => void` prop. The "Góp ý" handler calls `onClose()` then `onOpenFeedback()`. The settings-sheet close animation overlaps the feedback-sheet open animation — that's fine, the two `SheetModal`s stack independently.

### New component: `FeedbackSheet.tsx`

File: `mobile/src/components/tabs/FeedbackSheet.tsx`. Mirrors `SettingsSheet` style (uses `SheetModal` + `StickerCard` + theme tokens).

**Props**
```ts
interface Props {
  visible: boolean;
  onClose: () => void;
}
```

**State**
- `rating: 1 | 2 | 3 | 4 | 5 | null` (null = not selected)
- `message: string`
- `submitting: boolean`
- `error: string | null`

Reset all four to initial values whenever `visible` flips from `false` → `true` (via `useEffect`). Do not reset when closing — let the close-animation finish on the previous state.

**Layout (top to bottom)**
1. Title: `t('feedback.title')` — "Bạn thấy Daylog thế nào?", `typography.title`, centered.
2. Emoji row: five `TouchableOpacity` buttons in a horizontal row with `space-around`. Each shows an emoji (😡 😟 😐 🙂 🤩 for ratings 1–5). Selected emoji gets a `StickerCard`-style highlight ring + subtle scale-up (`transform: [{ scale: 1.1 }]`). Unselected emojis are at 70% opacity. `testID="feedback-rating-<n>"`.
3. Selected-label line: `t('feedback.rating.<n>')` shown below the emoji row, centered, `typography.bodySmall`. Empty space (same height) when nothing selected to avoid layout jump.
4. `TextInput` (multiline, 4 rows): placeholder `t('feedback.message_placeholder')`, `maxLength={2000}`, border + radius matching other inputs in the codebase. `testID="feedback-message"`.
5. `StickerButton` "Gửi": `variant="primary"`, `fullWidth`, `disabled={rating === null || submitting}`, `loading={submitting}`, `testID="feedback-submit"`.
6. Inline error text below the button when `error` is set (red, `typography.bodySmall`).

**Submit flow**
- Build payload `{ rating, message: message.trim() || undefined, app_version, platform }`.
- `app_version` from `Constants.expoConfig?.version` (expo-constants).
- `platform` from `Platform.OS` (cast to `'ios' | 'android'`; `web` won't ship but type allows it).
- Call `api.post('/feedback', payload)`.
- On success: show a one-shot `Alert.alert('', t('feedback.success'))` (matches the pattern used by `handleDownloadData` in `settings/index.tsx`), then `onClose()`.
- On failure: set `error` to `t('feedback.error')`. Keep sheet open. Re-enable submit.

### Client helper (optional)

Inline the `api.post('/feedback', ...)` call in `FeedbackSheet`. No dedicated helper unless a second caller appears — YAGNI.

### i18n (vi + en)

Add to `mobile/src/locales/vi.ts` and `mobile/src/locales/en.ts` under the existing sections:

```ts
// settings
feedback: 'Góp ý'        // vi
feedback: 'Send feedback' // en

// new top-level "feedback" namespace
feedback: {
  title: 'Bạn thấy Daylog thế nào?',          // en: 'How is Daylog treating you?'
  rating: {
    1: 'Rất tệ',          // 'Awful'
    2: 'Tệ',              // 'Bad'
    3: 'Bình thường',     // 'Okay'
    4: 'Tốt',             // 'Good'
    5: 'Rất tốt',         // 'Loving it'
  },
  message_placeholder: 'Kể cho mình nghe thêm (lỗi, mong muốn, lời khen)…', // en: 'Tell us more (bugs, wishes, kind words)…'
  submit: 'Gửi',          // 'Send'
  success: 'Cảm ơn bạn đã góp ý!', // 'Thanks for the feedback!'
  error: 'Không gửi được. Thử lại nhé.', // "Couldn't send. Please try again."
}
```

---

## Tests

### Backend — `backend/src/routes/feedback.test.ts`
- `POST /feedback` without auth → `401`.
- `rating` missing / not integer / `< 1` / `> 5` → `400`.
- `message` > 2000 chars → `400`.
- Happy path with rating only → `201`, row inserted with `message = null`, `user_id` matches caller.
- Happy path with rating + message + app_version + platform → `201`, all fields persisted.
- Whitespace-only `message` → stored as `null`.

### Mobile — `mobile/src/components/tabs/__tests__/SettingsSheet.test.tsx`
- Logout row is gone (`queryByTestId('menu-logout')` returns null).
- "Góp ý" row is present and tapping it calls `onOpenFeedback`.
- "Cài đặt" row still navigates to `/(tabs)/settings`.

### Mobile — `mobile/src/components/tabs/__tests__/FeedbackSheet.test.tsx`
- Submit button is disabled when no rating selected.
- Tapping rating 4 then submit → calls `api.post('/feedback', { rating: 4, ... })` (mock api).
- Selected-rating label updates when a different emoji is tapped.
- API success → `onClose` called; alert shown.
- API failure → `onClose` not called; error text rendered.
- Message > 2000 chars is prevented by `maxLength` (no explicit assertion needed; covered by component prop).

### Mobile — `mobile/app/(tabs)/__tests__/settings.test.tsx`
- Existing logout button at the bottom of the full settings screen still works (regression check — should pass unchanged).

---

## Out of scope

- Admin UI for viewing feedback (DB query is enough for now).
- Email/Slack forwarding of submissions.
- Categorisation (bug vs suggestion vs praise) — single freeform field.
- Anonymous feedback — submissions require auth, `user_id` is always set.
- Rate limiting.
- Editing or deleting submitted feedback.
