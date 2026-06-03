import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface MonthHeaderProps { label: string }

export function MonthHeader({ label }: MonthHeaderProps) {
  return <Text style={styles.text}>~ {label} ~</Text>;
}

const styles = StyleSheet.create({
  text: { ...typography.handAccent, fontSize: 20, color: colors.pink, marginTop: spacing['2xl'], marginBottom: spacing.sm, textAlign: 'left' },
});
