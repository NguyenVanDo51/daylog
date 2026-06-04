# Login Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay layout login hiện tại (logo + tagline căn giữa) thành split layout: top warm gradient với thông điệp cảm xúc, bottom cream với nút đăng nhập giữ nguyên.

**Architecture:** Chỉ thay đổi phần render của `app/(auth)/index.tsx`. Thêm `LinearGradient` từ `expo-linear-gradient` (đã có trong package.json). Auth logic, button components, store calls không đổi. Thêm 2 i18n keys mới: `signin.headline` và `signin.sub_copy`.

**Tech Stack:** React Native, expo-linear-gradient (đã cài), i18n-js

---

### Task 1: Thêm i18n keys

**Files:**
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Thêm keys vào vi.ts**

Tìm đoạn `signin:` trong `mobile/src/locales/vi.ts` và thêm 2 keys mới:

```ts
  signin: {
    tagline:    'lưu giữ từng khoảnh khắc bé yêu',
    headline:   'Mỗi ngày bé lớn thêm một chút',
    sub_copy:   'Đừng để những khoảnh khắc đó chỉ nằm trong ký ức',
    apple:      'Đăng nhập với Apple',
    google:     'Đăng nhập với Google',
    privacy:    'Bằng việc đăng nhập, bạn đồng ý với Chính sách bảo mật.',
    failed:     'Đăng nhập thất bại',
  },
```

- [ ] **Step 2: Thêm keys vào en.ts**

Tìm đoạn `signin:` trong `mobile/src/locales/en.ts` và thêm 2 keys mới:

```ts
  signin:  {
    tagline:  'capture every tiny moment',
    headline: 'Every day, your baby grows a little more',
    sub_copy: "Don't let those moments live only in memory",
    apple: 'Sign in with Apple',
    google: 'Sign in with Google',
    privacy: 'By signing in, you agree to our Privacy Policy.',
    failed: 'Sign in failed'
  },
```

- [ ] **Step 3: Chạy i18n test để verify**

```bash
cd mobile && npx jest src/lib/__tests__/i18n.test.ts --no-coverage
```

Expected: PASS (hoặc test không cover key mới — không sao, tiếp tục)

- [ ] **Step 4: Commit**

```bash
git add mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat(mobile): add signin headline and sub_copy i18n keys"
```

---

### Task 2: Implement split layout

**Files:**
- Modify: `mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Thêm LinearGradient import**

Thêm import ở đầu file `mobile/app/(auth)/index.tsx`:

```ts
import { LinearGradient } from 'expo-linear-gradient';
```

- [ ] **Step 2: Thay phần return trong SignInScreen**

Thay toàn bộ `return (...)` hiện tại (từ dòng `return (` đến `);`) bằng:

```tsx
  return (
    <View style={styles.container}>
      <FloatingDot x="10%" y={100} size={18} color={colors.yellow} delay={0} />
      <FloatingDot x="85%" y={140} size={14} color={colors.pink}   delay={300} />
      <FloatingDot x="15%" y={300} size={12} color={colors.mint}   delay={600} />
      <FloatingDot x="80%" y={360} size={16} color={colors.peach}  delay={900} />
      <FloatingDot x="50%" y={70}  size={10} color={colors.sky}    delay={1200} />
      <FloatingDot x="35%" y={520} size={14} color={colors.yellow} delay={1500} />

      <LinearGradient
        colors={['#FF9A9E', '#FECFEF', '#FFE8C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.logo}>👶</Text>
        <Text style={styles.headline}>{t('signin.headline')}</Text>
        <Text style={styles.subCopy}>{t('signin.sub_copy')}</Text>
      </LinearGradient>

      <View style={styles.bottom}>
        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={22}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <Button label={t('signin.google')} onPress={handleGoogle} variant="ghost" fullWidth loading={loading === 'google'} />
        </View>
        <Text style={styles.privacy}>{t('signin.privacy')}</Text>
      </View>
    </View>
  );
```

- [ ] **Step 3: Thay phần StyleSheet.create**

Thay toàn bộ `const styles = StyleSheet.create({...})` bằng:

```ts
const styles = StyleSheet.create({
  container: { flex: 1 },
  dot:       { position: 'absolute', borderRadius: 9999, opacity: 0.7, borderWidth: 2, borderColor: colors.ink, ...shadows.sticker },
  hero:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  logo:      { fontSize: 72, marginBottom: spacing.lg },
  headline:  { ...typography.heading, fontSize: 24, textAlign: 'center', marginBottom: spacing.sm },
  subCopy:   { ...typography.body, color: colors.inkMuted, textAlign: 'center', fontSize: 13 },
  bottom:    { backgroundColor: colors.cream, paddingHorizontal: spacing['3xl'], paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] },
  buttons:   { gap: spacing.md },
  appleBtn:  { height: 52, width: '100%', marginBottom: spacing.xs },
  privacy:   { ...typography.caption, color: colors.inkMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
```

- [ ] **Step 4: Chạy tests**

```bash
cd mobile && npx jest app/\(auth\)/__tests__/index.test.tsx --no-coverage
```

Expected: tất cả pass — auth logic không thay đổi.

- [ ] **Step 5: Thêm assertion cho headline vào test**

Mở `mobile/app/(auth)/__tests__/index.test.tsx`, tìm test `'renders Apple and Google sign-in buttons'` và thêm assertion cho headline:

```ts
it('renders Apple and Google sign-in buttons', () => {
  const { getByText, UNSAFE_getAllByType } = render(<SignIn />);
  expect(getByText('Sign in with Google')).toBeTruthy();
  expect(
    UNSAFE_getAllByType('AppleAuthenticationButton' as never).length,
  ).toBeGreaterThan(0);
  // Headline rendered (en locale)
  expect(getByText('Every day, your baby grows a little more')).toBeTruthy();
});
```

- [ ] **Step 6: Chạy lại tests**

```bash
cd mobile && npx jest app/\(auth\)/__tests__/index.test.tsx --no-coverage
```

Expected: PASS including new assertion.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/\(auth\)/index.tsx mobile/app/\(auth\)/__tests__/index.test.tsx
git commit -m "feat(mobile/auth): warm split login layout with emotional headline"
```
