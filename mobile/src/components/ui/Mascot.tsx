import React from 'react';
import { Text, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';

type TiltKey = keyof typeof theme.tilts;

interface MascotProps {
  size?: number;
  tilt?: TiltKey;
  flip?: boolean;
  withShadow?: boolean;
  testID?: string;
}

export function Mascot({
  size = 32,
  tilt = 'none',
  flip = false,
  withShadow = true,
  testID,
}: MascotProps) {
  if (theme.mascot.emoji == null) return null;

  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const style: TextStyle = {
    fontSize: size,
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
    ...(withShadow && {
      textShadowColor: theme.colors.border,
      textShadowOffset: { width: Math.max(1, size / 20), height: Math.max(1, size / 20) },
      textShadowRadius: 0,
    }),
  };

  return <Text testID={testID} style={style}>{theme.mascot.emoji}</Text>;
}
