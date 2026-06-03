import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SkeletonTile } from './SkeletonTile';
import { spacing } from '@/constants/theme';

export function SkeletonRow({ rowIndex = 0 }: { rowIndex?: number }) {
  const { width } = useWindowDimensions();
  const cellSize = (width - spacing['2xl'] * 2 - spacing.xs) / 2;
  const altA = rowIndex % 2 === 0;
  return (
    <View style={styles.row}>
      <SkeletonTile size={cellSize} alt={altA} />
      <SkeletonTile size={cellSize} alt={!altA} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
});
