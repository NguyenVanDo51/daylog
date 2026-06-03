import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { PhotoCell } from '@/components/ui/PhotoCell';
import { spacing } from '@/constants/theme';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PhotoRowProps {
  photos: TimelinePhoto[];
  rowIndex?: number;
}

export function PhotoRow({ photos, rowIndex = 0 }: PhotoRowProps) {
  const { width } = useWindowDimensions();
  const gap = spacing.xs;
  const count = Math.min(photos.length, 2);
  const cellSize = (width - spacing['2xl'] * 2 - gap * (count - 1)) / count;

  return (
    <View style={styles.row}>
      {photos.slice(0, count).map((p, i) => (
        <PhotoCell
          key={p.id}
          uri={`${API_URL}/photos/${p.id}/thumb`}
          caption={p.caption}
          size={cellSize}
          index={rowIndex * 2 + i}
          onPress={() => router.push(`/photo/${p.id}`)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
});
