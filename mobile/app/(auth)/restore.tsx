import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function RestoreScreen() {
  const { restore_token, days_remaining } = useLocalSearchParams<{ restore_token: string; days_remaining: string }>();
  const { setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    if (!restore_token) return;
    setLoading(true);
    try {
      const { data } = await api.post('/users/me/restore', { restore_token });
      await SecureStore.setItemAsync('auth_token', data.token);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(data.user));
      const albums = await api.get('/albums');
      if (albums.data?.length > 0) setAlbum(albums.data[0]);
      setAuth(data.token, data.user);
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('common.error'), 'Không thể khôi phục tài khoản.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmDeletion() {
    router.replace('/(auth)');
  }

  const days = parseInt(days_remaining ?? '7', 10);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('restore.title')}</Text>
      <Text style={styles.body}>{t('restore.body', { days })}</Text>
      <Button label={loading ? '...' : t('restore.cta')} onPress={handleRestore} variant="primary" fullWidth disabled={loading} />
      <Button label={t('restore.confirm_del')} onPress={handleConfirmDeletion} variant="ghost" tier="quiet" fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: spacing['2xl'], justifyContent: 'center', gap: spacing.lg },
  title:     { ...typography.heading, color: colors.ink, textAlign: 'center' },
  body:      { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.md },
});
