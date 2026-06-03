import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface MilestoneCardProps {
  title: string;
  note?: string | null;
  occurredAt: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function MilestoneCard({ title, note, occurredAt, icon = 'star', onPress }: MilestoneCardProps) {
  const date = new Date(occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      <View style={styles.accent} />
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.pink} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {note && <Text style={styles.note} numberOfLines={2}>{note}</Text>}
        <Text style={styles.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:    { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.sm, marginVertical: spacing.xs, overflow: 'hidden' },
  accent:  { width: 3, backgroundColor: colors.pink },
  iconWrap:{ padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: spacing.md, paddingLeft: spacing.xs },
  title:   { ...typography.body, color: colors.ink, marginBottom: 2 },
  note:    { ...typography.bodySmall, color: colors.inkSoft, marginBottom: 2 },
  date:    { ...typography.caption },
});
