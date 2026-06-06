import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function SettingsTab() {
  const { user, clearAuth } = useAuthStore();
  const { clearAlbum } = useAlbumStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => { hasPushPermission().then(setNotifEnabled).catch(() => {}); }, []);

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

  return (
    <View style={styles.container}>
      <QuietHeader>
        <Text style={styles.heading}>{t('settings.title')}</Text>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <Card tier="quiet" style={styles.profileCard}>
            <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.display_name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </Card>
        )}

        <Card tier="quiet" style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.push_label')}</Text>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: colors.pink, false: colors.borderSoft }}
              disabled={notifLoading}
            />
          </View>
        </Card>

        <Button label={t('settings.signout')} onPress={handleSignOut} variant="ghost" tier="quiet" fullWidth />
        <Text style={styles.version}>{t('settings.version', { v: '0.1.0' })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.cream },
  heading:     { ...typography.heading, color: colors.ink },
  content:     { padding: spacing['2xl'], gap: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo: { flex: 1 },
  name:        { ...typography.title, color: colors.ink },
  email:       { ...typography.bodySmall, color: colors.inkSoft },
  section:     { gap: spacing.md },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel:    { ...typography.body, color: colors.ink },
  version:     { ...typography.caption, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.lg },
});
