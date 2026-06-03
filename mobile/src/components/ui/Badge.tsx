import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'surface';
}

export function Badge({ label, variant = 'primary' }: BadgeProps) {
  return (
    <View style={[styles.base, variant === 'surface' && styles.surface]}>
      <Text style={[styles.text, variant === 'surface' && styles.surfaceText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base:        { backgroundColor: colors.pink, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  surface:     { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  text:        { fontSize: 10, fontWeight: '700', color: colors.white, letterSpacing: 0.3 },
  surfaceText: { color: colors.inkSoft },
});
