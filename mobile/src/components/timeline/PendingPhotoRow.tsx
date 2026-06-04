import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { PendingPhotoCell } from './PendingPhotoCell';
import { spacing } from '@/constants/theme';
import type { PendingPhoto } from '@/stores/pendingUploadStore';

interface PendingPhotoRowProps {
  photos: PendingPhoto[];
  rowIndex: number;
}

export function PendingPhotoRow({ photos, rowIndex }: PendingPhotoRowProps) {
  const { width } = useWindowDimensions();
  const count = Math.min(photos.length, 2);
  const gap = spacing.xs;
  const cellSize = (width - spacing['2xl'] * 2 - gap * (count - 1)) / count;

  return (
    <View style={styles.row}>
      {photos.slice(0, 2).map((p, i) => (
        <PendingPhotoCell
          key={p.id}
          localUri={p.localUri}
          status={p.status}
          size={cellSize}
          index={rowIndex * 2 + i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
});
