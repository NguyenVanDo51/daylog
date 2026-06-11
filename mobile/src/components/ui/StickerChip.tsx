import React, { ReactNode } from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';

type ChipVariant = keyof typeof theme.components.stickerChip;
type TiltKey = keyof typeof theme.tilts;

interface StickerChipProps {
  label: string;
  variant?: ChipVariant;
  tilt?: TiltKey;
  flip?: boolean;
  icon?: ReactNode;
  testID?: string;
}

export function StickerChip({
  label,
  variant = 'yellow',
  tilt = 'none',
  flip = false,
  icon,
  testID,
}: StickerChipProps) {
  const v = theme.components.stickerChip[variant];
  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const container: ViewStyle = {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: v.backgroundColor,
    borderColor:     v.borderColor,
    borderWidth:     v.borderWidth,
    borderRadius:    theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical:   theme.spacing.xs,
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
  };

  return (
    <View testID={testID} style={container}>
      {icon}
      <Text style={[theme.typography.pill, { color: v.textColor, marginLeft: icon ? theme.spacing.xs : 0 }]}>
        {label}
      </Text>
    </View>
  );
}
