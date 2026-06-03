import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { registerPushToken } from '@/lib/notifications';
import { colors, spacing, typography } from '@/constants/theme';

export default function SettingsTab() {
  const { user, clearAuth } = useAuthStore();
  const { clearAlbum } = useAlbumStore();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  async function toggleNotifications(val: boolean) {
    if (!val) { setNotifEnabled(false); return; }
    setNotifLoading(true);
    try {
      await registerPushToken();
      setNotifEnabled(true);
    } catch {
      Alert.alert('Permission denied', 'Enable notifications in Settings.');
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleSignOut() {
    await SecureStore.deleteItemAsync('auth_token');
    clearAuth();
    clearAlbum();
    router.replace('/(auth)');
  }

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.heading}>Settings ⚙️</Text>
      </HeaderGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <Card style={styles.profileCard}>
            <Avatar uri={user.avatar_url} name={user.display_name} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.display_name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </Card>
        )}

        <Card style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: colors.primary }}
              disabled={notifLoading}
            />
          </View>
        </Card>

        <Button label="Sign Out" onPress={handleSignOut} variant="danger" fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  heading:     { ...typography.heading, color: colors.white },
  content:     { padding: spacing['2xl'], gap: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileInfo: { flex: 1 },
  name:        { ...typography.title, color: colors.textPrimary },
  email:       { ...typography.body, color: colors.textSecondary },
  section:     { gap: spacing.md },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel:    { ...typography.subheading, color: colors.textPrimary },
});
