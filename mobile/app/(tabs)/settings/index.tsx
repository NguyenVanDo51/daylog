import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import { ArrowSquareOut, CaretRight, Bell, Globe, DownloadSimple, Trash, ShieldCheck, FileText } from 'phosphor-react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { PRIVACY_URL, TERMS_URL } from '@/constants/urls';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    hasPushPermission().then(setNotifEnabled).catch(() => {});
    getCurrentLanguage().then(setCurrentLang);
    api.get('/users/me')
      .then((res) => setRemindersEnabled(res.data.reminders_enabled ?? true))
      .catch(() => {});
  }, []);

  async function toggleReminders(val: boolean) {
    setRemindersEnabled(val);
    try {
      await api.patch('/users/me', { reminders_enabled: val });
    } catch {
      setRemindersEnabled(!val);
    }
  }

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
      <ScreenHeader
        onBack={() => router.back()}
        backTestID="settings-back"
        title={t('settings.title')}
      />

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
              testID="settings-push-toggle"
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: theme.colors.primary, false: theme.colors.borderSoft }}
              disabled={notifLoading}
            />
          </View>
        </StickerCard>

        {notifEnabled && (
          <StickerCard style={styles.rowCard}>
            <View style={styles.row}>
              <RowIcon icon={<Bell size={14} color={theme.colors.textPrimary} weight="bold" />} bg="accent2" />
              <View style={styles.rowLabelGroup}>
                <Text style={styles.rowLabelTitle}>{t('settings.reminders_label')}</Text>
                <Text style={styles.rowLabelHint}>{t('settings.reminders_hint')}</Text>
              </View>
              <Switch
                testID="settings-reminders-toggle"
                value={remindersEnabled}
                onValueChange={toggleReminders}
                trackColor={{ true: theme.colors.primary, false: theme.colors.borderSoft }}
              />
            </View>
          </StickerCard>
        )}

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
  rowLabelGroup: { flex: 1, marginLeft: spacing.sm },
  rowLabelTitle: { ...typography.body, color: theme.colors.textPrimary },
  rowLabelHint:  { ...typography.bodySmall, color: theme.colors.textSecondary, marginTop: 2 },
  rowValue:      { ...typography.bodySmall, color: theme.colors.textSecondary },
  sectionHeader: { ...typography.caption, color: theme.colors.textMuted, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  danger:        { color: theme.colors.error },
  version:       { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
