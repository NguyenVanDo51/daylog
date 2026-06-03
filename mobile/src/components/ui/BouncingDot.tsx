import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/constants/theme';

export function BouncingDot({ size = 16, color = colors.pink }: { size?: number; color?: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-8, { duration: 400 }), withTiming(0, { duration: 400 })), -1);
  }, [y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.wrap}>
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, anim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 12 },
});
