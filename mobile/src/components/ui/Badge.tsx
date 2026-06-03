import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

type AccentColor = 'pink' | 'yellow' | 'mint' | 'peach' | 'sky';

interface BadgeProps {
  label: string;
  color?: AccentColor;
}

const accent: Record<AccentColor, string> = {
  pink:   colors.pink,
  yellow: colors.yellow,
  mint:   colors.mint,
  peach:  colors.peach,
  sky:    colors.sky,
};

export function Badge({ label, color = 'pink' }: BadgeProps) {
  return (
    <View style={[styles.base, { backgroundColor: accent[color] }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
  },
  text: { ...typography.pill, color: colors.ink },
});
