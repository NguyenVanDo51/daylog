import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface ModalScreenHeaderProps {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function ModalScreenHeader({ title, left, right }: ModalScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {left}
      <Text style={styles.title}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing['2xl'],
    paddingTop: spacing['4xl'],
  },
  title: { ...typography.title, color: colors.textPrimary },
});
