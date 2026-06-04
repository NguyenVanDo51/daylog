import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useAlbum } from '@/hooks/useAlbum';
import { useMembers } from '@/hooks/useMembers';
import { useTimeline } from '@/hooks/useTimeline';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { StorageBadge } from '@/components/ui/StorageBadge';
import { StorageFreedomModal } from '@/components/ui/StorageFreedomModal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnAge, greetingForHour } from '@/lib/format';
import { useCaptureStore, getCooldownRemaining } from '@/stores/captureStore';

export default function HomeScreen() {
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const user = useAuthStore((s) => s.user);
  const albumName = useAlbumStore((s) => s.albumName);
  const childBirthdate = useAlbumStore((s) => s.childBirthdate);
  const { data: album } = useAlbum();
  const { data: members } = useMembers();
  const { data: timeline } = useTimeline();

  const { lastCaptureAt } = useCaptureStore();
  const cooldownRemaining = getCooldownRemaining(lastCaptureAt);
  const canCapture = cooldownRemaining === 0;

  const firstName = user?.display_name?.split(' ')[0] ?? '';
  const birthdate = childBirthdate ?? album?.child_birthdate ?? null;
  const ageLabel = formatVnAge(birthdate);
  const photoCount = timeline?.pages.reduce((s, p) => s + p.items.filter((i: any) => i.type === 'photo').length, 0) ?? 0;

  function handleCameraPress() {
    if (!canCapture) {
      const mins = Math.ceil(cooldownRemaining / 60000);
      Alert.alert(
        t('capture.cooldown_title'),
        t('capture.cooldown_body', { minutes: mins }),
        [
          { text: t('capture.cancel'), style: 'cancel' },
          {
            text: t('capture.cooldown_fallback'),
            onPress: () => {},
          },
        ]
      );
      return;
    }
    router.push('/capture');
  }

  return (
    <View style={styles.container}>
      <JoyfulHeader>
        <Text style={styles.greeting}>{greetingForHour(new Date().getHours())}, {firstName} ✦</Text>
        <Text style={styles.albumName}>{albumName ?? t('home.album_default')}</Text>

        <View style={styles.badges}>
          {ageLabel ? <Badge label={ageLabel} color="yellow" /> : null}
          {members && members.length > 0 ? <Badge label={t('home.badge_members', { count: members.length })} color="mint" /> : null}
          {photoCount > 0 ? <Badge label={t('home.badge_photos', { count: photoCount })} color="peach" /> : null}
        </View>

        {members && members.length > 0 && (
          <TouchableOpacity style={styles.avatarRow} onPress={() => router.push('/(tabs)/family')}>
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} uri={m.avatar_url} name={m.display_name} size={28} ring shadow />
            ))}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cameraBtn} onPress={handleCameraPress}>
          <Ionicons name="camera-outline" size={22} color={canCapture ? colors.ink : colors.inkMuted} />
        </TouchableOpacity>
      </JoyfulHeader>

      <StorageBadge onPress={() => setStorageModalVisible(true)} />

      <TimelineFeed />

      <StorageFreedomModal
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  greeting:  { ...typography.handAccent, color: colors.pink, fontSize: 18, marginBottom: 4 },
  albumName: { ...typography.heading, color: colors.ink, marginBottom: spacing.sm },
  badges:    { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm },
  avatarRow: { flexDirection: 'row', gap: -8, marginTop: spacing.sm },
  cameraBtn: { position: 'absolute', right: 0, top: 0, padding: spacing.xs },
});
