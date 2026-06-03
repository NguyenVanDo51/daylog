import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

export function QuietHeader({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.content}>{children}</View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.cream, paddingHorizontal: spacing['2xl'], paddingBottom: spacing.lg },
  content: {},
  divider: { height: 1, backgroundColor: colors.borderSoft, marginTop: spacing.lg },
});
