import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { spacing, typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.text}>{title.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  text: { ...typography.handAccent, fontSize: 20, marginTop: spacing['2xl'], marginBottom: spacing.sm },
});
