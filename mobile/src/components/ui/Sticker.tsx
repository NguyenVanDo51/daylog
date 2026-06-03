import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '@/constants/theme';

interface StickerProps {
  children?: React.ReactNode;
  rotation?: number;
  style?: ViewStyle;
}

export function Sticker({ children, rotation = 0, style }: StickerProps) {
  return (
    <View style={[styles.base, { transform: [{ rotate: `${rotation}deg` }] }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink, borderRadius: radii.md, ...shadows.sticker },
});
