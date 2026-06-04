import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/constants/theme';
import type { TimelineMilestone } from '@/hooks/useTimeline';

interface MilestoneRowProps {
  milestone: TimelineMilestone;
}

export function MilestoneRow({ milestone }: MilestoneRowProps) {
  return (
    <TouchableOpacity
      testID="milestone-row"
      style={styles.row}
      onPress={() => router.push(`/milestone/${milestone.id}`)}
      activeOpacity={0.85}
    >
      <Text style={styles.icon}>🎯</Text>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>{milestone.title}</Text>
        <Text style={styles.sub}>Cột mốc</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.mint,
  },
  icon: { fontSize: 22 },
  meta: { flex: 1 },
  title: { ...typography.body, color: colors.ink, marginBottom: 2 },
  sub: { ...typography.bodySmall, color: colors.inkMuted },
});
