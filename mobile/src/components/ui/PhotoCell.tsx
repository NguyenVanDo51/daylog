import React from 'react';
import { TouchableOpacity, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii } from '@/constants/theme';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function PhotoCell({ uri, caption, size, onPress, style }: PhotoCellProps) {
  return (
    <TouchableOpacity onPress={onPress} style={[{ width: size, height: size }, styles.container, style]} activeOpacity={0.9}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.xs, overflow: 'hidden', backgroundColor: colors.surface },
  image:     { width: '100%', height: '100%' },
  caption: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', color: colors.white,
    fontSize: 9, padding: 4,
  },
});
