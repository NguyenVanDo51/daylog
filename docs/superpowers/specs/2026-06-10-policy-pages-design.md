# Policy Pages — Design Spec
**Date:** 2026-06-10

## Goal

Add Privacy Policy and Terms of Service pages required for App Store submission. Pages live on the web at `getdaylog.com/privacy` and `getdaylog.com/terms`, and are linked from the mobile app via `Linking.openURL`.

## URLs

| Page | URL |
|------|-----|
| Chính sách bảo mật | `https://getdaylog.com/privacy` |
| Điều khoản sử dụng | `https://getdaylog.com/terms` |

---

## Part 1: Web (`web/`)

### New files
- `web/app/privacy/page.tsx` — Chính sách bảo mật
- `web/app/terms/page.tsx` — Điều khoản sử dụng

### Layout
Both pages follow the existing home page pattern: `<Nav />` + prose content + `<Footer />`. Use a shared `PolicyLayout` wrapper component (e.g. `web/components/PolicyLayout.tsx`) with a centered max-width prose container styled with Tailwind.

### Content (Vietnamese)
Both pages contain standard policy content appropriate for a family photo diary app:

**Privacy Policy covers:**
- Loại dữ liệu thu thập (email, ảnh, video, metadata)
- Mục đích sử dụng (lưu trữ, chia sẻ trong gia đình)
- Bên thứ ba (Cloudflare R2, Sentry, Apple/Google Sign-In)
- Quyền người dùng (xoá tài khoản, xuất dữ liệu)
- Liên hệ

**Terms of Service covers:**
- Điều kiện sử dụng
- Quyền sở hữu nội dung (user owns their content)
- Hành vi bị cấm
- Chấm dứt tài khoản
- Giới hạn trách nhiệm

### Footer update
`web/components/Footer.tsx` — add links to Privacy and Terms next to the copyright line.

---

## Part 2: Mobile (`mobile/`)

### Constants
Add `web/constants/urls.ts` (or extend existing constants):
```ts
// mobile/src/constants/urls.ts
export const PRIVACY_URL = 'https://getdaylog.com/privacy';
export const TERMS_URL   = 'https://getdaylog.com/terms';
```

### Settings screen (`app/(tabs)/settings.tsx`)
Add a "Pháp lý" section Card below the notifications row with two tappable rows:
- Chính sách bảo mật → `Linking.openURL(PRIVACY_URL)`
- Điều khoản sử dụng → `Linking.openURL(TERMS_URL)`

Each row: label text on left + `ArrowSquareOut` icon (phosphor) on right.

### Sign-in screen (`app/(auth)/index.tsx`)
Replace static `<Text style={styles.privacy}>` with a `<TouchableOpacity>` that calls `Linking.openURL(PRIVACY_URL)`. The tap target wraps only the existing privacy text.

### i18n (`src/locales/vi.ts` + `en.ts`)
Add keys under `settings`:
```ts
settings: {
  ...existing,
  legal_section: 'Pháp lý',
  privacy_policy: 'Chính sách bảo mật',
  terms:          'Điều khoản sử dụng',
}
```
English equivalents in `en.ts`.

---

## What is NOT in scope
- WebView in-app screens (links open Safari/Chrome instead)
- Notification or consent banners
- Cookie policy
- Account deletion flow

---

## App Store checklist
- [ ] Privacy Policy URL entered in App Store Connect → `https://getdaylog.com/privacy`
- [ ] Policy pages deployed and publicly accessible before submission
