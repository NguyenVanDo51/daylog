import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fonts, shadows } from '@/constants/theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  shadow?: boolean;
}

export function Avatar({ uri, name, size = 36, ring = false, shadow = false }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 2, borderColor: colors.white } : {};
  const shadowStyle = shadow ? shadows.sticker : {};

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, circle, ringStyle, shadowStyle]} />;
  }
  return (
    <View style={[styles.fallback, circle, ringStyle, shadowStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image:    { backgroundColor: colors.yellow },
  fallback: { backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.ink, fontFamily: fonts.bold },
});
