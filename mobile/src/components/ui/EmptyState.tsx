import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { colors, spacing, typography } from '@/constants/theme';

interface EmptyStateProps {
  emoji: string;
  message: string;
}

export function EmptyState({ emoji, message }: EmptyStateProps) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1);
  }, [y]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.emoji, float]}>{emoji}</Animated.Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  emoji:     { fontSize: 72, marginBottom: spacing.lg },
  message:   { ...typography.handLarge, color: colors.inkSoft, textAlign: 'center', lineHeight: 34 },
});
