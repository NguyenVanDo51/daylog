import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radii, spacing } from '@/constants/theme';

export function SkeletonCard({ height = 72 }: { height?: number }) {
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.card, { height }, animStyle]} />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.borderSoft, borderRadius: radii.md, marginVertical: spacing.xs },
});
