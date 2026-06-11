import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { typography } from '@/constants/theme';

interface OutlinedTextProps extends TextProps {
  size?: number;
}

// White text with a dark halo so it stays readable on any photo, light or
// dark. Used for time / clock / date stamps that overlay camera, capture
// review, and story playback.
export function OutlinedText({ size = 20, style, children, ...rest }: OutlinedTextProps) {
  const base: TextStyle = {
    ...typography.displayCute,
    fontSize: size,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: Math.max(6, Math.round(size * 0.4)),
  };
  return <Text {...rest} style={[base, style]}>{children}</Text>;
}
