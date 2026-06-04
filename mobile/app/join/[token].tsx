import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const authToken = useAuthStore((s) => s.token);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState<{ album_name: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get(`/invites/${token}`)
      .then(({ data }) => setInvite(data))
      .catch(() => Alert.alert(t('common.error'), 'Link mời không hợp lệ hoặc đã hết hạn.'));
  }, [token]);

  if (!authToken) {
    return (
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.welcome}>{t('join.invited_msg')}</Text>
        <Button label={t('signin.apple')} onPress={() => router.replace('/(auth)')} fullWidth />
      </View>
    );
  }

  if (!invite) return null;

  async function handleJoin() {
    setJoining(true);
    try {
      await api.post(`/invites/${token}/join`);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.error ?? e.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.welcome}>{t('join.invited_msg')}</Text>
        <Text style={styles.album}>{invite.album_name}</Text>
        <Button label={t('join.cta')} onPress={handleJoin} fullWidth loading={joining} />
        <Button label={t('common.cancel')} onPress={() => router.back()} variant="ghost" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md },
  emoji:     { fontSize: 72 },
  welcome:   { ...typography.handLarge, color: colors.pink, textAlign: 'center' },
  album:     { ...typography.display, color: colors.ink, textAlign: 'center' },
});
