import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { formatVnDate, formatVnMonth } from '@/lib/format';

const ACCENTS = [colors.pink, colors.yellow, colors.mint, colors.peach, colors.sky] as const;

interface MilestoneCardProps {
  title: string;
  note?: string | null;
  occurredAt: string;
  index?: number;
  onPress?: () => void;
}

export function MilestoneCard({ title, note, occurredAt, index = 0, onPress }: MilestoneCardProps) {
  const d = new Date(occurredAt);
  const date = `${formatVnDate(d)} · ${formatVnMonth(d)} ${d.getFullYear()}`;
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {note && <Text style={styles.note} numberOfLines={2}>{note}</Text>}
        <Text style={styles.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.sticker,
  },
  accent:  { width: 6 },
  content: { flex: 1, padding: spacing.lg, gap: 4 },
  title:   { ...typography.title, color: colors.ink },
  note:    { fontFamily: 'Caveat_500Medium', fontSize: 16, color: colors.inkSoft },
  date:    { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted },
});
