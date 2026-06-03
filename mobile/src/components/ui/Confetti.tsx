import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { motion } from '@/lib/motion';

const PALETTE = [colors.pink, colors.yellow, colors.mint, colors.peach, colors.sky];

function Particle({ index, originX, originY }: { index: number; originX: number; originY: number }) {
  const angle = (Math.PI * 2 * index) / motion.confetti.particles + Math.random() * 0.4;
  const distance = 100 + Math.random() * 120;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance - 60;
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: motion.confetti.durationMs, easing: Easing.out(Easing.quad) });
  }, [t]);

  const anim = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: dx * t.value },
      { translateY: dy * t.value + 200 * t.value * t.value },
      { rotate: `${360 * t.value}deg` },
    ],
  }));

  const color = PALETTE[index % PALETTE.length];

  return <Animated.View pointerEvents="none" style={[styles.particle, { left: originX, top: originY, backgroundColor: color }, anim]} />;
}

interface ConfettiProps {
  visible: boolean;
  originX?: number;
  originY?: number;
}

export function Confetti({ visible, originX, originY }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  if (!visible) return null;
  const ox = originX ?? width / 2;
  const oy = originY ?? height / 2;
  return (
    <>
      {Array.from({ length: motion.confetti.particles }).map((_, i) => (
        <Particle key={i} index={i} originX={ox} originY={oy} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', width: 10, height: 10, borderRadius: 2 },
});
