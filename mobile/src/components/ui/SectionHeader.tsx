import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{title.toUpperCase()}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm },
  text: { ...typography.label, color: colors.textSecondary, marginRight: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
});
