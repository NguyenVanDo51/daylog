import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const authToken = useAuthStore((s) => s.token);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState<{ album_name: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get(`/invites/${token}`)
      .then(({ data }) => setInvite(data))
      .catch(() => Alert.alert('Invalid invite', 'This invite link is invalid or expired.'));
  }, [token]);

  if (!authToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Join Album 🎉</Text>
        <Text style={styles.body}>You need to sign in before joining.</Text>
        <Button label="Sign In" onPress={() => router.replace('/(auth)')} fullWidth />
      </View>
    );
  }

  if (!invite) return <LoadingSpinner />;

  async function handleJoin() {
    setJoining(true);
    try {
      await api.post(`/invites/${token}/join`);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.heading}>You're invited!</Text>
      <Text style={styles.body}>Join <Text style={{ fontWeight: '700' }}>{invite.album_name}</Text> to view and share family photos.</Text>
      <Button label="Join Album" onPress={handleJoin} fullWidth loading={joining} />
      <Button label="Cancel" onPress={() => router.back()} variant="ghost" fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] },
  emoji:     { fontSize: 72, marginBottom: spacing.lg },
  heading:   { ...typography.heading, color: colors.ink, marginBottom: spacing.sm },
  body:      { ...typography.bodySmall, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing['3xl'] },
});
