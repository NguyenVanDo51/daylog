import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface HeaderGradientProps {
  children: React.ReactNode;
}

export function HeaderGradient({ children }: HeaderGradientProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[colors.cream, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
});
