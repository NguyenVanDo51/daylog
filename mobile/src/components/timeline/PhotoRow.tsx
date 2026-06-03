import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { PhotoCell } from '@/components/ui/PhotoCell';
import { spacing } from '@/constants/theme';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PhotoRowProps {
  photos: TimelinePhoto[];
}

export function PhotoRow({ photos }: PhotoRowProps) {
  const { width } = useWindowDimensions();
  const count = photos.length >= 3 ? 3 : 2;
  const gap = spacing.xs;
  const cellSize = (width - spacing['2xl'] * 2 - gap * (count - 1)) / count;

  return (
    <View style={styles.row}>
      {photos.slice(0, count).map((p) => (
        <PhotoCell
          key={p.id}
          uri={`${API_URL}/photos/${p.id}/thumb`}
          caption={p.caption}
          size={cellSize}
          onPress={() => router.push(`/photo/${p.id}`)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
});
