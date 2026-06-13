import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { Mascot } from './Mascot';

type ColorKey = keyof typeof theme.colors;
// Exclude `swatch` (the readonly array) so bgColor can only resolve to a string.
type ColorBgKey = Exclude<ColorKey, 'swatch'>;

interface AvatarProps {
  size?: number;
  src?: string | null;
  bgColor?: ColorBgKey;
  withCameraOverlay?: boolean;
  testID?: string;
}

export function Avatar({
  size = 40,
  src = null,
  bgColor = 'primary',
  withCameraOverlay = false,
  testID,
}: AvatarProps) {
  const radius = size / 2;

  const container: ViewStyle = {
    width:           size,
    height:          size,
    borderRadius:    radius,
    backgroundColor: theme.colors[bgColor] as string,
    borderWidth:     theme.border.medium,
    borderColor:     theme.colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  };
  const overlay: ViewStyle = {
    position:        'absolute',
    bottom:          -2,
    right:           -2,
    width:           Math.max(20, size * 0.32),
    height:          Math.max(20, size * 0.32),
    borderRadius:    Math.max(10, size * 0.16),
    backgroundColor: theme.colors.accent1,
    borderWidth:     theme.border.thin,
    borderColor:     theme.colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  };

  return (
    <View testID={testID} style={container}>
      {src ? (
        <Image
          testID={`${testID}-image`}
          source={{ uri: src }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <Mascot size={size * 0.9} withShadow={false} />
      )}
      {withCameraOverlay && (
        <View testID={`${testID}-camera-overlay`} style={overlay} />
      )}
    </View>
  );
}
