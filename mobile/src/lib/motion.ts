import { Easing } from 'react-native-reanimated';

export const motion = {
  spring:      { damping: 14, stiffness: 180 },
  springTight: { damping: 18, stiffness: 240 },
  springLoose: { damping: 10, stiffness: 140, mass: 1.2 },
  fade:        { duration: 220, easing: Easing.out(Easing.cubic) },
  scaleTap:    { from: 1, to: 0.94 },
  confetti:    { particles: 24, durationMs: 1200 },
} as const;
