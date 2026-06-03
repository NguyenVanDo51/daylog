import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { formatVnDate, formatVnMonth } from '@/lib/format';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: milestones } = useMilestones();
  const milestone = milestones?.find((m) => m.id === id);

  if (!milestone) return null;

  const d = new Date(milestone.occurred_at);
  const coverUri = milestone.cover_photo_id
    ? `${API_URL}/photos/${milestone.cover_photo_id}/full`
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.coverWrap}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.emoji}>🌟</Text>
          </View>
        )}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{milestone.title}</Text>
        <Text style={styles.date}>{`${formatVnDate(d)} · ${formatVnMonth(d)} ${d.getFullYear()}`}</Text>
        {milestone.note && <Text style={styles.note}>{milestone.note}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.cream },
  coverWrap:     { height: 260, padding: spacing.lg, paddingTop: 60 },
  cover:         {
    flex: 1,
    borderTopLeftRadius: radii.sticker[0], borderTopRightRadius: radii.sticker[1],
    borderBottomRightRadius: radii.sticker[2], borderBottomLeftRadius: radii.sticker[3],
    borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker,
  },
  coverFallback: { backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  emoji:         { fontSize: 64 },
  back:          {
    position: 'absolute', top: 50, left: spacing.lg,
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.ink, ...shadows.sticker,
  },
  body:  { padding: spacing['2xl'], gap: spacing.sm },
  title: { ...typography.display, color: colors.ink },
  date:  { ...typography.handAccent, color: colors.pink },
  note:  { ...typography.body, color: colors.ink, lineHeight: 22 },
});
