import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface EmptyStateProps {
  emoji: string;
  message: string;
}

export function EmptyState({ emoji, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  emoji:     { fontSize: 48, marginBottom: spacing.lg },
  message:   { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
