import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  tier?: 'joyful' | 'quiet';
  style?: ViewStyle;
}

export function Card({ children, tier = 'joyful', style }: CardProps) {
  const tierStyle = tier === 'joyful' ? styles.joyful : styles.quiet;
  return <View style={[styles.base, tierStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base:   { backgroundColor: colors.white, padding: spacing.lg },
  joyful: { borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink, ...shadows.sticker },
  quiet:  { borderRadius: radii.sm, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card },
});
