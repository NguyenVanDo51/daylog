# Policy Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Privacy Policy and Terms of Service pages to the web (`getdaylog.com`) and link them from the mobile app for App Store submission.

**Architecture:** Web pages are standalone Next.js routes at `/privacy` and `/terms` sharing a `PolicyLayout` wrapper (Nav + content + Footer). Mobile links open these URLs in the system browser via `expo-linking`; URLs are centralised in a constants file. Settings screen gains a "Pháp lý" section; sign-in screen privacy text becomes tappable.

**Tech Stack:** Next.js 16 + Tailwind v4 (web), Expo Router + React Native + expo-linking + phosphor-react-native (mobile), i18n-js (mobile localisation), Jest + @testing-library/react-native (mobile tests).

---

## File Map

**Create:**
- `web/components/PolicyLayout.tsx` — shared Nav + centred prose container + Footer wrapper
- `web/app/privacy/page.tsx` — Chính sách bảo mật page
- `web/app/terms/page.tsx` — Điều khoản sử dụng page
- `mobile/src/constants/urls.ts` — `PRIVACY_URL` and `TERMS_URL` constants

**Modify:**
- `web/components/Footer.tsx` — add Privacy and Terms anchor links
- `mobile/src/locales/vi.ts` — add `settings.legal_section`, `settings.privacy_policy`, `settings.terms`
- `mobile/src/locales/en.ts` — same keys in English
- `mobile/app/(tabs)/settings.tsx` — add Pháp lý section with two tappable rows
- `mobile/app/(auth)/index.tsx` — make privacy text a `TouchableOpacity`
- `mobile/app/(tabs)/__tests__/settings.test.tsx` — add 3 tests for legal section

---

### Task 1: PolicyLayout component

**Files:**
- Create: `web/components/PolicyLayout.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

export function PolicyLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-ink mb-10">{title}</h1>
        <div className="space-y-8 text-sm text-ink-soft leading-relaxed">{children}</div>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/PolicyLayout.tsx
git commit -m "feat(web): add PolicyLayout component for policy pages"
```

---

### Task 2: Privacy Policy page

**Files:**
- Create: `web/app/privacy/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/PolicyLayout'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — Daylog',
  description: 'Chính sách bảo mật của ứng dụng Daylog.',
  alternates: { canonical: 'https://getdaylog.com/privacy' },
}

export default function PrivacyPage() {
  return (
    <PolicyLayout title="Chính sách bảo mật">
      <p className="text-xs text-ink-muted">Cập nhật lần cuối: 10 tháng 6, 2026</p>

      <section>
        <h2 className="font-bold text-ink mb-2">1. Giới thiệu</h2>
        <p>
          Daylog ("chúng tôi") xây dựng ứng dụng nhật ký ảnh gia đình dành riêng cho bạn. Chính sách
          này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin của bạn khi sử dụng
          ứng dụng Daylog.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">2. Thông tin chúng tôi thu thập</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Tài khoản:</strong> tên hiển thị và địa chỉ email từ Apple ID hoặc tài khoản
            Google khi bạn đăng nhập.
          </li>
          <li>
            <strong>Ảnh và video:</strong> các tệp bạn chủ động tải lên ứng dụng.
          </li>
          <li>
            <strong>Dữ liệu sử dụng:</strong> nhật ký lỗi ẩn danh (qua Sentry) để cải thiện ứng dụng.
          </li>
          <li>
            <strong>Mã thông báo đẩy:</strong> nếu bạn bật thông báo, thiết bị của bạn sẽ gửi token
            để nhận thông báo.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">3. Mục đích sử dụng</h2>
        <p>Chúng tôi sử dụng thông tin của bạn để:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Cung cấp và duy trì dịch vụ nhật ký ảnh gia đình.</li>
          <li>Cho phép bạn chia sẻ ảnh với các thành viên trong nhóm gia đình.</li>
          <li>Gửi thông báo đẩy khi có ảnh mới (nếu bạn cho phép).</li>
          <li>Phát hiện và sửa lỗi ứng dụng.</li>
        </ul>
        <p className="mt-2">
          Chúng tôi <strong>không</strong> bán, cho thuê hay chia sẻ thông tin của bạn với bên thứ ba
          vì mục đích quảng cáo.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">4. Bên thứ ba</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Cloudflare R2:</strong> lưu trữ ảnh và video của bạn trên hạ tầng đám mây an toàn.
          </li>
          <li>
            <strong>Sentry:</strong> nhận nhật ký lỗi ẩn danh để chúng tôi có thể khắc phục sự cố.
          </li>
          <li>
            <strong>Apple / Google:</strong> xác thực danh tính khi bạn đăng nhập.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">5. Bảo mật dữ liệu</h2>
        <p>
          Dữ liệu truyền tải được mã hóa bằng HTTPS. Quyền truy cập vào ảnh và video được kiểm soát
          bởi token xác thực — chỉ bạn và các thành viên gia đình bạn mời mới có thể xem.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">6. Quyền của bạn</h2>
        <p>Bạn có quyền:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Xóa tài khoản và toàn bộ dữ liệu bất kỳ lúc nào.</li>
          <li>Tắt thông báo đẩy trong phần Cài đặt của ứng dụng.</li>
          <li>Liên hệ chúng tôi để yêu cầu xuất hoặc xóa dữ liệu.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">7. Trẻ em</h2>
        <p>
          Ứng dụng không dành cho trẻ em dưới 13 tuổi. Chúng tôi không cố ý thu thập thông tin cá
          nhân từ trẻ em. Nội dung ảnh về trẻ em được tải lên bởi phụ huynh/người giám hộ và được lưu
          trữ riêng tư trong nhóm gia đình.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">8. Liên hệ</h2>
        <p>
          Mọi câu hỏi về chính sách bảo mật, vui lòng liên hệ:{' '}
          <a href="mailto:hello@getdaylog.com" className="text-accent-pink underline">
            hello@getdaylog.com
          </a>
        </p>
      </section>
    </PolicyLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/privacy/page.tsx
git commit -m "feat(web): add Privacy Policy page at /privacy"
```

---

### Task 3: Terms of Service page

**Files:**
- Create: `web/app/terms/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/PolicyLayout'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng — Daylog',
  description: 'Điều khoản sử dụng ứng dụng Daylog.',
  alternates: { canonical: 'https://getdaylog.com/terms' },
}

export default function TermsPage() {
  return (
    <PolicyLayout title="Điều khoản sử dụng">
      <p className="text-xs text-ink-muted">Cập nhật lần cuối: 10 tháng 6, 2026</p>

      <section>
        <h2 className="font-bold text-ink mb-2">1. Chấp nhận điều khoản</h2>
        <p>
          Bằng việc tạo tài khoản hoặc sử dụng ứng dụng Daylog, bạn đồng ý tuân theo các điều khoản
          này. Nếu bạn không đồng ý, vui lòng không sử dụng ứng dụng.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">2. Mô tả dịch vụ</h2>
        <p>
          Daylog là ứng dụng nhật ký ảnh và video gia đình cho phép bạn lưu giữ, tổ chức và chia sẻ
          khoảnh khắc trong nhóm gia đình riêng tư.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">3. Tài khoản người dùng</h2>
        <p>
          Bạn chịu trách nhiệm bảo mật tài khoản của mình. Thông báo cho chúng tôi ngay nếu phát
          hiện truy cập trái phép vào tài khoản.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">4. Nội dung của bạn</h2>
        <p>
          Bạn giữ toàn quyền sở hữu đối với ảnh, video và ghi chú bạn tải lên. Bằng việc sử dụng
          dịch vụ, bạn cấp cho Daylog quyền lưu trữ và phân phối nội dung đó trong phạm vi nhóm gia
          đình của bạn để cung cấp dịch vụ.
        </p>
        <p className="mt-2">
          Daylog không tuyên bố quyền sở hữu và không sử dụng nội dung của bạn ngoài mục đích cung
          cấp dịch vụ.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">5. Hành vi bị cấm</h2>
        <p>Bạn cam kết không:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Tải lên nội dung vi phạm pháp luật hoặc quyền của người khác.</li>
          <li>Chia sẻ thông tin đăng nhập với người không được mời vào nhóm.</li>
          <li>Cố gắng truy cập trái phép vào dữ liệu người dùng khác.</li>
          <li>Sử dụng ứng dụng theo cách gây hại cho hạ tầng dịch vụ.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">6. Chấm dứt tài khoản</h2>
        <p>
          Bạn có thể xóa tài khoản bất kỳ lúc nào. Chúng tôi có quyền tạm ngừng hoặc xóa tài khoản
          vi phạm các điều khoản này. Khi tài khoản bị xóa, dữ liệu của bạn sẽ bị xóa khỏi máy chủ
          trong vòng 30 ngày.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">7. Giới hạn trách nhiệm</h2>
        <p>
          Daylog cung cấp dịch vụ "như hiện tại". Chúng tôi không chịu trách nhiệm về mất mát dữ liệu
          do sự cố kỹ thuật ngoài tầm kiểm soát. Chúng tôi khuyến khích bạn giữ bản sao dữ liệu quan
          trọng.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">8. Thay đổi điều khoản</h2>
        <p>
          Chúng tôi có thể cập nhật các điều khoản này. Bạn sẽ được thông báo qua ứng dụng khi có
          thay đổi quan trọng. Việc tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận điều
          khoản mới.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-ink mb-2">9. Liên hệ</h2>
        <p>
          Mọi thắc mắc về điều khoản sử dụng, vui lòng liên hệ:{' '}
          <a href="mailto:hello@getdaylog.com" className="text-accent-pink underline">
            hello@getdaylog.com
          </a>
        </p>
      </section>
    </PolicyLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/terms/page.tsx
git commit -m "feat(web): add Terms of Service page at /terms"
```

---

### Task 4: Update Footer with policy links

**Files:**
- Modify: `web/components/Footer.tsx`

- [ ] **Step 1: Replace Footer content**

Replace the entire file with:

```tsx
export function Footer() {
  return (
    <footer className="border-t border-border-soft px-6 py-7 flex flex-wrap justify-between items-center gap-3 text-xs text-ink-muted">
      <span>© 2026 Daylog</span>
      <div className="flex gap-4">
        <a href="/privacy" className="hover:text-ink transition-colors">Chính sách bảo mật</a>
        <a href="/terms" className="hover:text-ink transition-colors">Điều khoản sử dụng</a>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/Footer.tsx
git commit -m "feat(web): add Privacy Policy and Terms links to footer"
```

---

### Task 5: Mobile URL constants

**Files:**
- Create: `mobile/src/constants/urls.ts`

- [ ] **Step 1: Create constants file**

```ts
export const PRIVACY_URL = 'https://getdaylog.com/privacy';
export const TERMS_URL   = 'https://getdaylog.com/terms';
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/constants/urls.ts
git commit -m "feat(mobile): add PRIVACY_URL and TERMS_URL constants"
```

---

### Task 6: Mobile i18n keys

**Files:**
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Add keys to vi.ts**

In `mobile/src/locales/vi.ts`, replace the `settings` block with:

```ts
settings: {
  title:         'Cài đặt',
  push_label:    'Thông báo đẩy',
  signout:       'Đăng xuất',
  version:       'Phiên bản {{v}}',
  legal_section: 'Pháp lý',
  privacy_policy:'Chính sách bảo mật',
  terms:         'Điều khoản sử dụng',
},
```

- [ ] **Step 2: Add keys to en.ts**

In `mobile/src/locales/en.ts`, replace the `settings` inline block with:

```ts
settings: { title: 'Settings', push_label: 'Push notifications', signout: 'Sign out', version: 'Version {{v}}', legal_section: 'Legal', privacy_policy: 'Privacy Policy', terms: 'Terms of Service' },
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat(mobile): add i18n keys for legal section in settings"
```

---

### Task 7: Settings screen — legal section

**Files:**
- Modify: `mobile/app/(tabs)/settings.tsx`
- Modify: `mobile/app/(tabs)/__tests__/settings.test.tsx`

- [ ] **Step 1: Write failing tests**

In `mobile/app/(tabs)/__tests__/settings.test.tsx`, add the `expo-linking` mock at the top of the file alongside the other `jest.mock(...)` calls:

```ts
jest.mock('expo-linking', () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));
```

Add this import below the existing imports block:

```ts
import * as Linking from 'expo-linking';
const mockOpenURL = (Linking as any).openURL as jest.Mock;
```

Add `mockOpenURL.mockClear()` inside the existing `beforeEach`:

```ts
beforeEach(() => {
  jest.clearAllMocks();
  mockOpenURL.mockClear();
  // ... rest of existing beforeEach
});
```

Add these three tests inside the existing `describe('SettingsTab', ...)` block:

```ts
it('renders the legal section header', async () => {
  const { getByText } = render(<Screen />);
  await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
  expect(getByText('Pháp lý')).toBeTruthy();
});

it('pressing Chính sách bảo mật opens the privacy URL', async () => {
  const { getByTestId } = render(<Screen />);
  await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
  fireEvent.press(getByTestId('settings-privacy'));
  expect(mockOpenURL).toHaveBeenCalledWith('https://getdaylog.com/privacy');
});

it('pressing Điều khoản sử dụng opens the terms URL', async () => {
  const { getByTestId } = render(<Screen />);
  await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
  fireEvent.press(getByTestId('settings-terms'));
  expect(mockOpenURL).toHaveBeenCalledWith('https://getdaylog.com/terms');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npm test -- --testPathPattern="settings.test" --no-coverage
```

Expected: 3 new tests fail with `Unable to find an element with testId: settings-privacy`

- [ ] **Step 3: Implement the legal section**

In `mobile/app/(tabs)/settings.tsx`, add these three imports at the top:

```ts
import * as Linking from 'expo-linking';
import { ArrowSquareOut } from 'phosphor-react-native';
import { PRIVACY_URL, TERMS_URL } from '@/constants/urls';
```

Inside `<ScrollView contentContainerStyle={styles.content}>`, add this JSX **between** the notifications Card and the sign-out Button:

```tsx
<Card tier="quiet" style={styles.section}>
  <Text style={styles.sectionHeader}>{t('settings.legal_section')}</Text>
  <TouchableOpacity
    style={styles.row}
    onPress={() => Linking.openURL(PRIVACY_URL)}
    testID="settings-privacy"
  >
    <Text style={styles.rowLabel}>{t('settings.privacy_policy')}</Text>
    <ArrowSquareOut size={18} color={colors.inkMuted} />
  </TouchableOpacity>
  <View style={styles.divider} />
  <TouchableOpacity
    style={styles.row}
    onPress={() => Linking.openURL(TERMS_URL)}
    testID="settings-terms"
  >
    <Text style={styles.rowLabel}>{t('settings.terms')}</Text>
    <ArrowSquareOut size={18} color={colors.inkMuted} />
  </TouchableOpacity>
</Card>
```

Add these two styles inside the existing `StyleSheet.create({...})`:

```ts
sectionHeader: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.xs },
divider:       { height: 1, backgroundColor: colors.borderSoft },
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npm test -- --testPathPattern="settings.test" --no-coverage
```

Expected: all tests pass (3 new tests green, all existing tests still green)

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/settings.tsx mobile/app/(tabs)/__tests__/settings.test.tsx
git commit -m "feat(mobile): add legal section to settings screen"
```

---

### Task 8: Sign-in tappable privacy link

**Files:**
- Modify: `mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Update imports**

In `mobile/app/(auth)/index.tsx`, find the existing React Native import:

```ts
import { View, Text, StyleSheet, Alert } from 'react-native';
```

Replace with:

```ts
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import { PRIVACY_URL } from '@/constants/urls';
```

- [ ] **Step 2: Make privacy text tappable**

Find this JSX in the `return` block:

```tsx
<Text style={styles.privacy}>{t('signin.privacy')}</Text>
```

Replace with:

```tsx
<TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
  <Text style={styles.privacy}>{t('signin.privacy')}</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(auth)/index.tsx
git commit -m "feat(mobile): make privacy policy text tappable on sign-in screen"
```

---

## App Store checklist

- [ ] Deploy `web/` to `getdaylog.com`
- [ ] Verify `https://getdaylog.com/privacy` returns HTTP 200
- [ ] Verify `https://getdaylog.com/terms` returns HTTP 200
- [ ] Enter `https://getdaylog.com/privacy` in App Store Connect → App Information → Privacy Policy URL
