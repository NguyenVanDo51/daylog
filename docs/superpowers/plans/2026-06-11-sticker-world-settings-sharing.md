# Sticker World — Settings + Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining lower-traffic surfaces — the Settings hub (list + Profile + Language), the menu sheets (Album menu + Settings sheet), and the sharing sheets (Members + Invite + QR scanner) — to Sticker World. After this plan, every user-visible screen in the app reads from theme tokens and uses sticker components.

**Architecture:**
- The Settings hub keeps its existing route layout (`(tabs)/settings/{index,profile,language}.tsx`). Each screen swaps `<Card tier="quiet">` for `<StickerCard>`, replaces inline icon dots with colored square sticker icons, and routes through the new sticker buttons / chips.
- The five sheet components keep `SheetModal` as the container but rebuild their contents with sticker rows, sticker buttons, and `displayCute` titles.
- `MemberList` becomes a tiltless StickerCard list (no rotation — these are dense data rows).
- The hex-literal guard expands to cover all 9 migrated files.

**Tech Stack:** Expo 56, expo-router, expo-camera, expo-clipboard, expo-image-picker, expo-secure-store, `@lodev09/react-native-true-sheet`, Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` — sections "Settings" (line 633), "Profile" (line 641), "Language" (line 648), "Members Sheet" (line 654), "Invite Sheet" (line 661), "Album Menu / QR / Settings Sheets" (line 669).

**Depends on:** Plans 1-4 landed. Foundation + capture flow + onboarding + browse experience all live on `main`.

---

## File Structure

```
mobile/
├── app/
│   └── (tabs)/
│       └── settings/
│           ├── index.tsx                         ← REWRITTEN (Task 1)
│           ├── profile.tsx                       ← REWRITTEN (Task 2)
│           └── language.tsx                      ← REWRITTEN (Task 2)
├── src/
│   ├── components/
│   │   ├── tabs/
│   │   │   └── SettingsSheet.tsx                 ← REWRITTEN (Task 3)
│   │   ├── family/
│   │   │   ├── AlbumMenuSheet.tsx                ← REWRITTEN (Task 3)
│   │   │   ├── MembersSheet.tsx                  ← REWRITTEN (Task 4)
│   │   │   ├── MemberList.tsx                    ← REWRITTEN (Task 4)
│   │   │   ├── InviteSheet.tsx                   ← REWRITTEN (Task 5)
│   │   │   └── QRSheet.tsx                       ← REWRITTEN (Task 5)
│   │   └── ui/
│   │       └── SheetModal.tsx                    ← MODIFIED (Task 3 — uses theme.radii)
│   ├── locales/
│   │   ├── vi.ts                                 ← MODIFIED (Tasks 1, 4, 5)
│   │   └── en.ts                                 ← MODIFIED
│   └── __tests__/
│       └── hex-literal-guard.test.ts             ← MODIFIED in every task
```

---

## Task 1: Settings list — `(tabs)/settings/index.tsx`

Spec line 633. The Settings list rebuilds with: butter sticker back button, displayCute heading, profile `<StickerCard tilt="subtle" flip>` containing an `<Avatar>`, section rows wrapped in `<StickerCard>` with colored 22px square sticker icons cycling through `accent1 → accent2 → accent3 → accent4`, danger sign-out `<StickerButton variant="danger">`, and the version string in caption typography.

**Files:**
- Rewrite: `mobile/app/(tabs)/settings/index.tsx`
- Modify: `mobile/src/locales/vi.ts` (no new keys needed — uses existing `settings.*`)
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 1.1: Rewrite `settings/index.tsx`

Replace the entire contents with:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import { CaretLeft, ArrowSquareOut, CaretRight, Bell, Globe, DownloadSimple, Trash, ShieldCheck, FileText, User } from 'phosphor-react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { PRIVACY_URL, TERMS_URL } from '@/constants/urls';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';
import { theme, spacing, typography } from '@/constants/theme';
import { t, getCurrentLanguage, AppLanguage } from '@/lib/i18n';

type IconBgKey = 'accent1' | 'accent2' | 'accent3' | 'accent4';

function RowIcon({ icon, bg }: { icon: React.ReactNode; bg: IconBgKey }) {
  return (
    <View style={[styles.rowIcon, { backgroundColor: theme.colors[bg] }]}>{icon}</View>
  );
}

export default function SettingsTab() {
  const { user, clearAuth } = useAuthStore();
  const { clearAlbum } = useAlbumStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState<AppLanguage>('device');

  useEffect(() => {
    hasPushPermission().then(setNotifEnabled).catch(() => {});
    getCurrentLanguage().then(setCurrentLang);
  }, []);

  async function toggleNotifications(val: boolean) {
    if (!val) { setNotifEnabled(false); return; }
    setNotifLoading(true);
    try {
      const granted = await registerPushToken();
      setNotifEnabled(granted);
      if (!granted) Alert.alert(t('common.error'), t('settings.notif_denied'));
    } catch {
      Alert.alert(t('common.error'), t('settings.notif_error'));
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleSignOut() {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    clearAuth();
    clearAlbum();
    router.replace('/(auth)');
  }

  function handleDownloadData() {
    Alert.alert(t('settings.download_data'), t('settings.download_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'OK', onPress: async () => {
          try {
            await api.get('/users/me/export');
            Alert.alert('', t('settings.download_sent'));
          } catch {
            Alert.alert(t('common.error'));
          }
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert('', t('settings.delete_confirm1'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.delete_continue'), style: 'destructive', onPress: () => {
          Alert.prompt(t('settings.delete_account'), t('settings.delete_confirm2'), async (input) => {
            if (input?.trim().toLowerCase() !== user?.email?.toLowerCase()) return;
            try {
              await api.delete('/users/me');
              await SecureStore.deleteItemAsync('auth_token');
              await SecureStore.deleteItemAsync('auth_user');
              clearAuth();
              clearAlbum();
              router.replace('/(auth)');
            } catch {
              Alert.alert(t('common.error'));
            }
          }, 'plain-text');
        },
      },
    ]);
  }

  const langLabel = { device: t('language.device'), vi: t('language.vi'), en: t('language.en') }[currentLang];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} testID="settings-back">
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <Text style={styles.heading}>{t('settings.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        {user && (
          <TouchableOpacity onPress={() => router.push('/settings/profile')}>
            <StickerCard tilt="subtle" flip style={styles.profileCard}>
              <Avatar src={user.avatar_url} size={48} bgColor="primary" />
              <View style={styles.profileInfo}>
                <Text style={styles.name}>{user.display_name}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
              <CaretRight size={18} color={theme.colors.textMuted} />
            </StickerCard>
          </TouchableOpacity>
        )}

        {/* Notifications */}
        <StickerCard style={styles.rowCard}>
          <View style={styles.row}>
            <RowIcon icon={<Bell size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent1" />
            <Text style={styles.rowLabel}>{t('settings.push_label')}</Text>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: theme.colors.primary, false: theme.colors.borderSoft }}
              disabled={notifLoading}
            />
          </View>
        </StickerCard>

        {/* App preferences */}
        <Text style={styles.sectionHeader}>{t('settings.app_section')}</Text>
        <StickerCard style={styles.rowCard}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/language')}>
            <RowIcon icon={<Globe size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent2" />
            <Text style={styles.rowLabel}>{t('settings.language')}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{langLabel}</Text>
              <CaretRight size={16} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        </StickerCard>

        {/* Account */}
        <Text style={styles.sectionHeader}>{t('settings.account_section')}</Text>
        <StickerCard style={styles.rowCard}>
          <TouchableOpacity style={styles.row} onPress={handleDownloadData}>
            <RowIcon icon={<DownloadSimple size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent3" />
            <Text style={styles.rowLabel}>{t('settings.download_data')}</Text>
            <CaretRight size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </StickerCard>
        <StickerCard style={styles.rowCard}>
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
            <RowIcon icon={<Trash size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent4" />
            <Text style={[styles.rowLabel, styles.danger]}>{t('settings.delete_account')}</Text>
            <CaretRight size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </StickerCard>

        {/* Legal */}
        <Text style={styles.sectionHeader}>{t('settings.legal_section')}</Text>
        <StickerCard style={styles.rowCard}>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)} testID="settings-privacy">
            <RowIcon icon={<ShieldCheck size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent1" />
            <Text style={styles.rowLabel}>{t('settings.privacy_policy')}</Text>
            <ArrowSquareOut size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </StickerCard>
        <StickerCard style={styles.rowCard}>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(TERMS_URL)} testID="settings-terms">
            <RowIcon icon={<FileText size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent2" />
            <Text style={styles.rowLabel}>{t('settings.terms')}</Text>
            <ArrowSquareOut size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </StickerCard>

        <StickerButton
          label={t('settings.signout')}
          variant="danger"
          fullWidth
          onPress={handleSignOut}
          testID="settings-signout"
        />
        <Text style={styles.version}>{t('settings.version', { v: '0.1.0' })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: theme.colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn:       { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  heading:       { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  content:       { padding: spacing['2xl'], gap: spacing.md, paddingBottom: spacing['4xl'] },
  profileCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.md },
  profileInfo:   { flex: 1 },
  name:          { ...typography.title, color: theme.colors.textPrimary },
  email:         { ...typography.bodySmall, color: theme.colors.textSecondary },
  rowCard:       { padding: 0 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, justifyContent: 'space-between' },
  rowIcon:       { width: 28, height: 28, borderRadius: theme.radii.sm, borderWidth: theme.border.thin, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  rowRight:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowLabel:      { ...typography.body, color: theme.colors.textPrimary, flex: 1, marginLeft: spacing.sm },
  rowValue:      { ...typography.bodySmall, color: theme.colors.textSecondary },
  sectionHeader: { ...typography.caption, color: theme.colors.textMuted, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  danger:        { color: theme.colors.error },
  version:       { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
```

**Notes:**
- `QuietHeader` is dropped — replaced by a manual header row with a butter StickerCard back button.
- `Card tier="quiet"` becomes `<StickerCard>` (no more "quiet" tier; the sticker shadow IS the visual treatment).
- Each row gets a colored 22-28px square icon container (`RowIcon`) cycling through accents. The icons use Phosphor's "bold" weight for that sticker-y read.
- Sign-out becomes a danger StickerButton.

### Step 1.2: Add to theme-clean files

In `mobile/src/__tests__/hex-literal-guard.test.ts`, append `'app/(tabs)/settings/index.tsx'` to `THEME_CLEAN_APP_FILES`.

### Step 1.3: Verify

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (17 specs).
- [ ] `npx jest app/\(tabs\)/__tests__/settings.test.tsx` — run; if existing assertions on `QuietHeader` / `Card` break, update minimally.
- [ ] `npx tsc --noEmit` — clean (TS5101 OK).
- [ ] `npx jest --silent` — baseline.

### Step 1.4: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/\(tabs\)/settings/index.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(settings): migrate Settings list to Sticker World

Drops Card/QuietHeader for StickerCard + butter back icon. Profile
card becomes a tilted StickerCard with Avatar. Each settings row is
its own StickerCard with a colored 28px sticker icon container
cycling through accent1-4. Sign-out becomes a danger StickerButton.
Background uses theme.colors.background. settings/index.tsx joins
THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Profile editor + Language picker

Both sub-screens of Settings get the sticker treatment. Profile editor: large pink Avatar with camera overlay, sticker card input. Language picker: list of language StickerCards with a yellow `<StickerChip>` checkmark on the active one.

**Files:**
- Rewrite: `mobile/app/(tabs)/settings/profile.tsx`
- Rewrite: `mobile/app/(tabs)/settings/language.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 2.1: Rewrite `profile.tsx`

Replace the entire contents with:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function ProfileScreen() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.display_name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = name !== user?.display_name || pendingKey !== null;

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const { data } = await api.post('/users/me/avatar-presign');
      const { upload_url, key } = data;
      const blob = await (await fetch(asset.uri)).blob();
      await fetch(upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      setPendingKey(key);
      setAvatarUri(asset.uri);
    } catch {
      Alert.alert(t('common.error'), t('settings.avatar_upload_error'));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!isDirty) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== user?.display_name) body.display_name = name;
      if (pendingKey) body.avatar_url = pendingKey;
      const { data } = await api.patch('/users/me', body);
      updateUser({ display_name: data.display_name, avatar_url: data.avatar_url });
      await SecureStore.setItemAsync('auth_user', JSON.stringify({ ...user, display_name: data.display_name, avatar_url: data.avatar_url }));
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('settings.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <Text style={styles.heading}>{t('settings.edit_profile')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading}>
            <Avatar src={avatarUri} size={96} bgColor="primary" withCameraOverlay />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <StickerCard style={styles.section}>
          <Text style={styles.label}>{t('settings.display_name_ph')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('settings.display_name_ph')}
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
          />
        </StickerCard>

        <StickerButton
          label={t('settings.save')}
          variant="primary"
          fullWidth
          loading={saving}
          disabled={!isDirty || uploading}
          onPress={save}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: theme.colors.background },
  header:           { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn:          { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  heading:          { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  content:          { padding: spacing['2xl'], gap: spacing.lg, alignItems: 'stretch' },
  avatarWrap:       { alignItems: 'center', marginBottom: spacing.md },
  uploadingOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overlays.scrim,
    borderRadius: 48,
  },
  section:          { gap: spacing.sm, padding: spacing.md },
  label:            { ...typography.caption, color: theme.colors.textMuted },
  input:            { ...typography.body, color: theme.colors.textPrimary, paddingVertical: spacing.sm },
});
```

**Notes:**
- The old `cameraOverlay` (a separate dark circle drawn behind a Camera icon) is dropped because `Avatar` already supports `withCameraOverlay`. The `uploadingOverlay` is a transient scrim shown only during upload.
- Save button uses the new `StickerButton` with `loading={saving}` (the spinner replaces the label).

### Step 2.2: Rewrite `language.tsx`

Replace the entire contents with:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import { router } from 'expo-router';
import { theme, spacing, typography } from '@/constants/theme';
import { t, setLanguage, getCurrentLanguage, AppLanguage } from '@/lib/i18n';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

const OPTIONS: { value: AppLanguage; labelKey: string; flag: string }[] = [
  { value: 'device', labelKey: 'language.device', flag: '📱' },
  { value: 'vi',     labelKey: 'language.vi',     flag: '🇻🇳' },
  { value: 'en',     labelKey: 'language.en',     flag: '🇬🇧' },
];

export default function LanguageScreen() {
  const [current, setCurrent] = useState<AppLanguage>('device');

  useEffect(() => { getCurrentLanguage().then(setCurrent); }, []);

  async function select(lang: AppLanguage) {
    await setLanguage(lang);
    setCurrent(lang);
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <Text style={styles.heading}>{t('language.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <TouchableOpacity key={opt.value} onPress={() => select(opt.value)}>
              <StickerCard style={styles.row}>
                <Text style={styles.flag}>{opt.flag}</Text>
                <Text style={styles.rowLabel}>{t(opt.labelKey)}</Text>
                {active && <StickerChip label="✓" variant="yellow" />}
              </StickerCard>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn:   { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  heading:   { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  content:   { padding: spacing['2xl'], gap: spacing.md },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  flag:      { fontSize: 22 },
  rowLabel:  { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
});
```

### Step 2.3: Add to theme-clean files

Append both to `THEME_CLEAN_APP_FILES`:

```ts
'app/(tabs)/settings/profile.tsx',
'app/(tabs)/settings/language.tsx',
```

### Step 2.4: Verify + commit

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (19 specs).
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest --silent` baseline.

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/\(tabs\)/settings/profile.tsx mobile/app/\(tabs\)/settings/language.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(settings): migrate Profile editor + Language picker

Profile editor: pink Avatar with built-in withCameraOverlay; display
name input wrapped in StickerCard; save button is a primary
StickerButton. Language picker: each option is a StickerCard with a
flag emoji + label + yellow check StickerChip when active. Both
screens use butter StickerCard back buttons and displayCute headings.
Both files join THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Menu sheets — Album menu + Settings sheet

The two menu sheets (one shown from album detail, one from home) both render a list of options. Each menu item becomes a row with a colored icon container and a sticker shadow.

**Files:**
- Rewrite: `mobile/src/components/family/AlbumMenuSheet.tsx`
- Rewrite: `mobile/src/components/tabs/SettingsSheet.tsx`
- Modify: `mobile/src/components/ui/SheetModal.tsx` (use `theme.radii.lg` instead of literal `24`)
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 3.1: Update `SheetModal.tsx` to use theme radii

Replace `cornerRadius={24}` with `cornerRadius={theme.radii.lg}`. Add the `theme` import. The file should now look like:

```tsx
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { theme, spacing } from '@/constants/theme';

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'auto' | 'large';
}

export function SheetModal({ visible, onClose, children, size = 'auto' }: SheetModalProps) {
  const ref = useRef<TrueSheet>(null);
  const presented = useRef(false);

  useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present().catch(() => {});
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss().catch(() => {});
    }
  }, [visible]);

  return (
    <TrueSheet
      ref={ref}
      detents={[size === 'large' ? 0.92 : 'auto']}
      cornerRadius={theme.radii.lg}
      backgroundColor={theme.colors.background}
      onDidDismiss={() => {
        presented.current = false;
        onClose();
      }}
    >
      <View style={styles.content}>
        {children}
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing['2xl'], gap: spacing.md },
});
```

### Step 3.2: Rewrite `AlbumMenuSheet.tsx`

Replace the entire contents with:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersThree, UserPlus, PencilSimple, Archive, Trash, SignOut } from 'phosphor-react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { useAlbumStore } from '@/stores/albumStore';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface AlbumMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onLeave: () => void;
}

type IconBgKey = 'accent1' | 'accent2' | 'accent3' | 'accent4';

export function AlbumMenuSheet({
  visible, onClose, onOpenMembers, onOpenInvite,
  onRename, onArchive, onDelete, onLeave,
}: AlbumMenuSheetProps) {
  const isPrivate  = useAlbumStore((s) => s.isPrivate);
  const myRole     = useAlbumStore((s) => s.myRole);
  const archivedAt = useAlbumStore((s) => s.archivedAt);
  const isArchived = archivedAt !== null;
  const isAdmin    = myRole === 'admin';

  return (
    <SheetModal visible={visible} onClose={onClose}>
      {isAdmin && !isArchived && (
        <MenuItem
          icon={<PencilSimple size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent1"
          label={t('album_menu.rename')}
          onPress={onRename}
        />
      )}
      <MenuItem
        icon={<UsersThree size={14} color={theme.colors.textPrimary} weight="bold" />}
        bg="accent2"
        label={t('album_menu.members')}
        onPress={onOpenMembers}
      />
      {isAdmin && !isPrivate && !isArchived && (
        <MenuItem
          icon={<UserPlus size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent3"
          label={t('album_menu.invite')}
          onPress={onOpenInvite}
        />
      )}
      {!isAdmin && (
        <MenuItem
          icon={<SignOut size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent4"
          label={t('album_menu.leave_album')}
          onPress={onLeave}
        />
      )}
      {isAdmin && !isArchived && (
        <MenuItem
          icon={<Archive size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent4"
          label={t('album_menu.archive')}
          onPress={onArchive}
        />
      )}
      {isAdmin && (
        <MenuItem
          icon={<Trash size={14} color={theme.colors.textOnPrimary} weight="bold" />}
          bg="accent1"
          label={t('album_menu.delete_album')}
          onPress={onDelete}
          danger
        />
      )}
    </SheetModal>
  );
}

function MenuItem({ icon, bg, label, onPress, danger }: {
  icon: React.ReactNode;
  bg: IconBgKey;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <StickerCard style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: danger ? theme.colors.error : theme.colors[bg] }]}>
          {icon}
        </View>
        <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconWrap:    { width: 28, height: 28, borderRadius: theme.radii.sm, borderWidth: theme.border.thin, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  label:       { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
  dangerLabel: { color: theme.colors.error },
});
```

### Step 3.3: Rewrite `SettingsSheet.tsx`

Replace the entire contents with:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Gear, SignOut } from 'phosphor-react-native';
import { router } from 'expo-router';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { useAuthStore } from '@/stores/authStore';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SettingsSheet({ visible, onClose }: Props) {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleSettings() {
    onClose();
    router.push('/(tabs)/settings');
  }

  function handleLogout() {
    onClose();
    clearAuth();
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <TouchableOpacity onPress={handleSettings} testID="menu-settings" activeOpacity={0.7}>
        <StickerCard style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent3 }]}>
            <Gear size={14} color={theme.colors.textPrimary} weight="bold" />
          </View>
          <Text style={styles.label}>{t('settings.title')}</Text>
        </StickerCard>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleLogout} testID="menu-logout" activeOpacity={0.7}>
        <StickerCard style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.error }]}>
            <SignOut size={14} color={theme.colors.textOnPrimary} weight="bold" />
          </View>
          <Text style={[styles.label, styles.danger]}>{t('settings.signout')}</Text>
        </StickerCard>
      </TouchableOpacity>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconWrap: { width: 28, height: 28, borderRadius: theme.radii.sm, borderWidth: theme.border.thin, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  label:    { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
  danger:   { color: theme.colors.error },
});
```

### Step 3.4: Add to theme-clean files

Append all three to `THEME_CLEAN_FILES` (note: these are under `src/`):

```ts
const THEME_CLEAN_FILES = [
  // ...existing...
  'src/components/family/AlbumMenuSheet.tsx',
  'src/components/tabs/SettingsSheet.tsx',
  'src/components/ui/SheetModal.tsx',
];
```

### Step 3.5: Verify + commit

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (22 specs).
- [ ] `npx jest src/components/family/AlbumMenuSheet.test.tsx` — run. If assertions on the old `MenuItem` row shape break, update minimally.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest --silent` baseline.

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/components/family/AlbumMenuSheet.tsx mobile/src/components/tabs/SettingsSheet.tsx mobile/src/components/ui/SheetModal.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(sheets): migrate menu sheets to Sticker World

AlbumMenuSheet and SettingsSheet each menu item becomes a StickerCard
row with a colored sticker icon container. Delete and Sign-out items
use error-colored icon container with cream icon. SheetModal now
reads corner radius from theme.radii.lg. All three files join the
theme-clean lists.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Members sheet + Member list

The members sheet shows the album's roster. Title becomes displayCute; rows become sticker cards.

**Files:**
- Rewrite: `mobile/src/components/family/MembersSheet.tsx`
- Rewrite: `mobile/src/components/family/MemberList.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 4.1: Rewrite `MembersSheet.tsx`

Replace the entire contents with:

```tsx
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { MemberList } from '@/components/family/MemberList';
import { useMembers } from '@/hooks/useMembers';
import { theme, typography, spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface MembersSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function MembersSheet({ visible, onClose }: MembersSheetProps) {
  const { data: members = [] } = useMembers();
  return (
    <SheetModal visible={visible} onClose={onClose} size="large">
      <Text style={styles.heading}>{t('album_menu.members_title')}</Text>
      <MemberList members={members} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
});
```

### Step 4.2: Rewrite `MemberList.tsx`

Replace the entire contents with:

```tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import type { Member } from '@/hooks/useMembers';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnDate, formatVnMonth } from '@/lib/format';

const ACCENT_KEYS = ['accent1', 'accent2', 'accent3', 'accent4'] as const;

export function MemberList({ members }: { members: Member[] }) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      scrollEnabled={false}
      contentContainerStyle={{ gap: spacing.sm }}
      renderItem={({ item, index }) => (
        <StickerCard style={styles.row}>
          <Avatar src={item.avatar_url} size={40} bgColor={ACCENT_KEYS[index % ACCENT_KEYS.length]} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.joined}>
              {t('family.joined_on', { date: `${formatVnDate(new Date(item.joined_at))} ${formatVnMonth(new Date(item.joined_at))}` })}
            </Text>
          </View>
          <StickerChip
            label={item.role === 'admin' ? t('family.role_admin') : t('family.role_member')}
            variant={item.role === 'admin' ? 'yellow' : 'mint'}
          />
        </StickerCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  info:   { flex: 1 },
  name:   { ...typography.title, color: theme.colors.textPrimary },
  joined: { ...typography.bodySmall, color: theme.colors.textMuted },
});
```

**Notes:**
- The `Badge` component is replaced by `StickerChip` (variants `yellow` for admin, `mint` for member).
- Avatar background colors cycle through accents by index instead of using the same yellow for everyone.

### Step 4.3: Add to theme-clean files

Append to `THEME_CLEAN_FILES`:

```ts
'src/components/family/MembersSheet.tsx',
'src/components/family/MemberList.tsx',
```

### Step 4.4: Verify + commit

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (24 specs).
- [ ] `npx jest src/components/family/MembersSheet.test.tsx src/components/family/MemberList.test.tsx` — confirm any test updates needed are minimal (likely the `Badge` assertion needs to become a `StickerChip` assertion). Update only the failing assertions.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest --silent` baseline.

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/components/family/MembersSheet.tsx mobile/src/components/family/MemberList.tsx mobile/src/__tests__/hex-literal-guard.test.ts
# If MemberList.test.tsx / MembersSheet.test.tsx needed updates:
# git add mobile/src/components/family/MemberList.test.tsx mobile/src/components/family/MembersSheet.test.tsx
git commit -m "$(cat <<'EOF'
refactor(members): migrate Members sheet + MemberList to Sticker World

Members sheet title uses displayCute typography. Each member row is a
StickerCard with Avatar (background cycles through accent1-4 by
index), name + joined date, and a StickerChip role badge (yellow for
admin, mint for member). Drops the legacy Badge usage. Both files
join THEME_CLEAN_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Invite sheet + QR sheet

The two link-related sheets share the same sticker treatment.

**Files:**
- Rewrite: `mobile/src/components/family/InviteSheet.tsx`
- Rewrite: `mobile/src/components/family/QRSheet.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 5.1: Rewrite `InviteSheet.tsx`

Replace the entire contents with:

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteSheet({ visible, onClose }: InviteSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible || !albumId) return;
    setLink(null);
    setQrCode(null);
    setCopied(false);
    setLoading(true);
    api.post(`/albums/${albumId}/invites`)
      .then(({ data }) => {
        setLink(`familyguy://join/${data.token}`);
        setQrCode(data.qr_code ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, albumId]);

  async function handleCopyLink() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    success();
    setCopied(true);
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={styles.heading}>{t('family.invite_title')}</Text>

      <StickerCard style={styles.linkCard}>
        <Text style={styles.linkLabel}>{t('invite.link_label')}</Text>
        <Text style={styles.linkValue} numberOfLines={1}>{loading ? '...' : (link ?? '—')}</Text>
      </StickerCard>

      {qrCode && (
        <StickerCard style={styles.qrCard}>
          <Image source={{ uri: qrCode }} style={styles.qr} />
        </StickerCard>
      )}

      <Text style={styles.expires}>{t('invite.expires')}</Text>

      <View style={styles.buttons}>
        <StickerButton
          label={copied ? t('invite.copied') : t('family.copy_link')}
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!link}
          onPress={handleCopyLink}
        />
        <StickerButton
          label={t('common.done')}
          variant="surface"
          fullWidth
          onPress={onClose}
        />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading:   { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  linkCard:  { padding: spacing.md, gap: spacing.xs },
  linkLabel: { ...typography.caption, color: theme.colors.textMuted },
  linkValue: { ...typography.body, color: theme.colors.textSecondary, fontFamily: theme.fonts.medium },
  qrCard:    { alignSelf: 'center', padding: spacing.sm },
  qr:        { width: 180, height: 180 },
  expires:   { ...typography.body, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  buttons:   { gap: spacing.md, marginTop: spacing.lg },
});
```

### Step 5.2: Rewrite `QRSheet.tsx`

Replace the entire contents with:

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { useQueryClient } from '@tanstack/react-query';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface QRSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function QRSheet({ visible, onClose }: QRSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const qc = useQueryClient();
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!visible) setScanned(false);
  }, [visible]);

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const token = data.includes('://') ? data.split('/').pop() : data;
    try {
      await api.post(`/invites/${token}/join`);
      qc.invalidateQueries({ queryKey: ['members', albumId] });
      success();
      Alert.alert(t('qr.joined_title'), t('qr.joined_body'));
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.error ?? e.message);
      setScanned(false);
    }
  }

  return (
    <SheetModal visible={visible} onClose={onClose} size="large">
      {!permission ? null : !permission.granted ? (
        <>
          <Text style={styles.heading}>{t('qr.perm_title')}</Text>
          <Text style={styles.body}>{t('qr.perm_body')}</Text>
          <View style={styles.buttons}>
            <StickerButton label={t('qr.perm_grant')} variant="primary" fullWidth onPress={requestPermission} />
            <StickerButton label={t('common.cancel')} variant="surface" fullWidth onPress={onClose} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.heading}>{t('qr.sheet_title')}</Text>
          {visible && (
            <StickerCard style={styles.scannerCard}>
              <CameraView
                style={styles.scanner}
                onBarcodeScanned={handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            </StickerCard>
          )}
          <Text style={styles.validity}>{t('qr.valid_for')}</Text>
          <StickerButton label={t('common.cancel')} variant="surface" fullWidth onPress={onClose} />
        </>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading:     { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  body:        { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  scannerCard: { flex: 1, padding: 0, overflow: 'hidden' },
  scanner:     { flex: 1 },
  validity:    { ...typography.body, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  buttons:     { gap: spacing.md, marginTop: spacing.lg },
});
```

**Notes:**
- The legacy `<View style={styles.handle} />` (the gray drag pill at top) is dropped — TrueSheet provides its own handle on iOS/Android.
- Camera permission flow stays identical; only chrome upgraded.

### Step 5.3: Add to theme-clean files

Append both to `THEME_CLEAN_FILES`:

```ts
'src/components/family/InviteSheet.tsx',
'src/components/family/QRSheet.tsx',
```

### Step 5.4: Verify + commit

- [ ] `npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (26 specs).
- [ ] `npx jest src/components/family/InviteSheet.test.tsx src/components/family/QRSheet.test.tsx` — run; update only the test assertions that explicitly target removed elements (e.g., the eyebrow text, the manual handle View).
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest --silent` baseline.

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/components/family/InviteSheet.tsx mobile/src/components/family/QRSheet.tsx mobile/src/__tests__/hex-literal-guard.test.ts
# Add test files only if they were modified to track removed eyebrows / handles.
git commit -m "$(cat <<'EOF'
refactor(sheets): migrate Invite + QR sheets to Sticker World

Invite sheet: displayCute heading, StickerCard wrapping link row and
QR image, primary StickerButton for copy + surface StickerButton for
done. QR sheet: same displayCute heading, StickerCard around the
CameraView scanner frame, primary/surface StickerButtons for the
permission and cancel actions. Both files join THEME_CLEAN_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Settings list (spec 633): ✓ Task 1.
- Profile editor (spec 641): ✓ Task 2.
- Language picker (spec 648): ✓ Task 2.
- Members sheet (spec 654): ✓ Task 4.
- Invite sheet (spec 661): ✓ Task 5.
- Album menu / QR / Settings sheets (spec 669): ✓ Task 3 (Album menu + Settings sheet) + Task 5 (QR).

**What this plan does NOT do:**
- Add an ink-bordered top edge to the sheet container per spec line 656 ("ink-bordered top edges (2px) and rounded top corners"). `TrueSheet` is a native iOS/Android sheet — adding ink borders to its top edge requires native modifications or a wrapper View overlay that would fight TrueSheet's native chrome. Defer as a polish follow-up.
- Add explicit drag handles inside the sheets (TrueSheet provides its own).

**Token usage summary:**
- New components used: `StickerCard`, `StickerChip`, `StickerButton`, `Avatar`, `Mascot` (already exist from Plan 1).
- Theme tokens consumed: `theme.colors.{background,textPrimary,textSecondary,textMuted,textOnPrimary,primary,error,border,borderSoft,accent1..4}`, `theme.overlays.scrim`, `theme.border.{thin,medium}`, `theme.radii.{sm,lg}`, `theme.fonts.medium`, `theme.typography.{displayCute,title,body,bodySmall,caption}`.

No new theme tokens are added by this plan.

After Plan 5, `THEME_CLEAN_FILES` covers 12 src components and `THEME_CLEAN_APP_FILES` covers 8 app files (totals: 20 theme-clean files). Every user-visible screen + supporting sheet is locked against future hex-literal regressions.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-sticker-world-settings-sharing.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review.

**2. Inline Execution** — Batch with checkpoints.

**Which approach?**
