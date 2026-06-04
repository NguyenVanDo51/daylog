import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, shadows, typography } from '@/constants/theme';
import { ReactionCount } from '@/hooks/useReactions';

interface Props {
  reactions: ReactionCount[];
}

export function ReactionBadge({ reactions }: Props) {
  if (!reactions.length) return null;
  const total = reactions.reduce((s, r) => s + r.count, 0);
  const top2 = [...reactions]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((r) => r.emoji)
    .join('');
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{top2} {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', bottom: spacing.xs, right: spacing.xs,
    backgroundColor: colors.cream, borderRadius: 12,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    ...shadows.sticker,
  },
  text: { ...typography.caption, color: colors.ink, fontSize: 11 },
});
