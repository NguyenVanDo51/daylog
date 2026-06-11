import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import { CaretLeft, ArrowSquareOut, CaretRight } from 'phosphor-react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { PRIVACY_URL, TERMS_URL } from '@/constants/urls';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';
import { colors, spacing, typography } from '@/constants/theme';
import { t, getCurrentLanguage, AppLanguage } from '@/lib/i18n';

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
      if (!granted) Alert.alert(t('common.error'), 'Vào Cài đặt thiết bị để bật thông báo.');
    } catch {
      Alert.alert(t('common.error'), 'Không thể đăng ký thông báo.');
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
      <QuietHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn} testID="settings-back">
            <CaretLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.heading}>{t('settings.title')}</Text>
          <View style={styles.backBtn} />
        </View>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        {user && (
          <TouchableOpacity onPress={() => router.push('/settings/profile')}>
            <Card tier="quiet" style={styles.profileCard}>
              <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
              <View style={styles.profileInfo}>
                <Text style={styles.name}>{user.display_name}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
              <CaretRight size={18} color={colors.inkMuted} />
            </Card>
          </TouchableOpacity>
        )}

        {/* Notifications */}
        <Card tier="quiet" style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.push_label')}</Text>
            <Switch value={notifEnabled} onValueChange={toggleNotifications}
              trackColor={{ true: colors.pink, false: colors.borderSoft }} disabled={notifLoading} />
          </View>
        </Card>

        {/* App preferences */}
        <Card tier="quiet" style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.app_section')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/language')}>
            <Text style={styles.rowLabel}>{t('settings.language')}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{langLabel}</Text>
              <CaretRight size={16} color={colors.inkMuted} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Account */}
        <Card tier="quiet" style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.account_section')}</Text>
          <TouchableOpacity style={styles.row} onPress={handleDownloadData}>
            <Text style={styles.rowLabel}>{t('settings.download_data')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
            <Text style={[styles.rowLabel, styles.danger]}>{t('settings.delete_account')}</Text>
          </TouchableOpacity>
        </Card>

        {/* Legal */}
        <Card tier="quiet" style={styles.section}>
          <Text style={styles.sectionHeader}>{t('settings.legal_section')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)} testID="settings-privacy">
            <Text style={styles.rowLabel}>{t('settings.privacy_policy')}</Text>
            <ArrowSquareOut size={18} color={colors.inkMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(TERMS_URL)} testID="settings-terms">
            <Text style={styles.rowLabel}>{t('settings.terms')}</Text>
            <ArrowSquareOut size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </Card>

        <Button label={t('settings.signout')} onPress={handleSignOut} variant="ghost" tier="quiet" fullWidth />
        <Text style={styles.version}>{t('settings.version', { v: '0.1.0' })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.cream },
  headerRow:     { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 32 },
  heading:       { ...typography.heading, color: colors.ink, flex: 1, textAlign: 'center' },
  content:       { padding: spacing['2xl'], gap: spacing.md },
  profileCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo:   { flex: 1 },
  name:          { ...typography.title, color: colors.ink },
  email:         { ...typography.bodySmall, color: colors.inkSoft },
  section:       { gap: spacing.md },
  sectionHeader: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.xs },
  row:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowRight:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowLabel:      { ...typography.body, color: colors.ink },
  rowValue:      { ...typography.bodySmall, color: colors.inkSoft },
  danger:        { color: colors.error },
  divider:       { height: 1, backgroundColor: colors.borderSoft },
  version:       { ...typography.caption, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.lg },
});
