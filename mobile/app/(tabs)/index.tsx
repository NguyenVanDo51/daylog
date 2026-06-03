import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useAlbum } from '@/hooks/useAlbum';
import { useMembers } from '@/hooks/useMembers';
import { useTimeline } from '@/hooks/useTimeline';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnAge, greetingForHour } from '@/lib/format';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const albumName = useAlbumStore((s) => s.albumName);
  const childBirthdate = useAlbumStore((s) => s.childBirthdate);
  const { data: album } = useAlbum();
  const { data: members } = useMembers();
  const { data: timeline } = useTimeline();

  const firstName = user?.display_name?.split(' ')[0] ?? '';
  const birthdate = childBirthdate ?? album?.child_birthdate ?? null;
  const ageLabel = formatVnAge(birthdate);
  const photoCount = timeline?.pages.reduce((s, p) => s + p.items.filter((i: any) => i.type === 'photo').length, 0) ?? 0;

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
      </JoyfulHeader>

      <TimelineFeed childBirthdate={birthdate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  greeting:  { ...typography.handAccent, color: colors.pink, fontSize: 18, marginBottom: 4 },
  albumName: { ...typography.heading, color: colors.ink, marginBottom: spacing.sm },
  badges:    { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm },
  avatarRow: { flexDirection: 'row', gap: -8, marginTop: spacing.sm },
});
