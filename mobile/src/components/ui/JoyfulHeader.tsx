import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface JoyfulHeaderProps {
  children: React.ReactNode;
}

export function JoyfulHeader({ children }: JoyfulHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <DotMotif />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

function DotMotif() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.dot, { backgroundColor: colors.yellow, top: 24, left: '14%', width: 10, height: 10 }]} />
      <View style={[styles.dot, { backgroundColor: colors.pink,   top: 36, left: '88%', width: 8,  height: 8 }]} />
      <View style={[styles.dot, { backgroundColor: colors.mint,   top: 96, left: '6%',  width: 8,  height: 8 }]} />
      <View style={[styles.dot, { backgroundColor: colors.peach,  top: 88, left: '92%', width: 10, height: 10 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.cream, paddingHorizontal: spacing['2xl'], paddingBottom: spacing['2xl'] },
  content: { position: 'relative' },
  dot:     { position: 'absolute', borderRadius: 9999, opacity: 0.5 },
});
