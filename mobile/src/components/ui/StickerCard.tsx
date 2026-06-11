import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { theme } from '@/constants/theme';

type TiltKey = keyof typeof theme.tilts;

interface StickerCardProps {
  children: ReactNode;
  tilt?: TiltKey;
  flip?: boolean;
  shadow?: 'normal' | 'heavy';
  surface?: 'default' | 'muted';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StickerCard({
  children,
  tilt = 'none',
  flip = false,
  shadow = 'normal',
  surface = 'default',
  style,
  testID,
}: StickerCardProps) {
  const preset = theme.components.stickerCard;
  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const composed: ViewStyle = {
    backgroundColor: surface === 'muted' ? theme.colors.surfaceMuted : preset.backgroundColor,
    borderWidth:     preset.borderWidth,
    borderColor:     preset.borderColor,
    borderRadius:    preset.borderRadius,
    ...(shadow === 'heavy' ? theme.shadows.stickerHeavy : preset.shadow),
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
  };

  return <View testID={testID} style={[composed, style]}>{children}</View>;
}
