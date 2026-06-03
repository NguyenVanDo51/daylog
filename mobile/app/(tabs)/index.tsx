import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useAlbum } from '@/hooks/useAlbum';
import { useMembers } from '@/hooks/useMembers';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { colors, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';

function getAgeLabel(birthdate: string | null): string {
  if (!birthdate) return '';
  const birth = new Date(birthdate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (months < 24) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const albumName = useAlbumStore((s) => s.albumName);
  const childBirthdate = useAlbumStore((s) => s.childBirthdate);
  const { data: album } = useAlbum();
  const { data: members } = useMembers();

  const firstName = user?.display_name?.split(' ')[0] ?? '';
  const ageLabel = getAgeLabel(childBirthdate ?? album?.child_birthdate ?? null);

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.greeting}>{getGreeting()}, {firstName} ☁️</Text>
        <Text style={styles.albumName}>{albumName ?? "Our Album"} ✨</Text>
        {ageLabel ? <Badge label={ageLabel} /> : null}

        {members && members.length > 0 && (
          <TouchableOpacity style={styles.avatarRow} onPress={() => router.push('/(tabs)/family')}>
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} uri={m.avatar_url} name={m.display_name} size={28} />
            ))}
          </TouchableOpacity>
        )}
      </HeaderGradient>

      <TimelineFeed childBirthdate={childBirthdate ?? album?.child_birthdate ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },
  greeting:   { ...typography.body, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  albumName:  { ...typography.title, color: colors.white, marginBottom: spacing.sm },
  avatarRow:  { flexDirection: 'row', gap: -8, marginTop: spacing.sm },
});
