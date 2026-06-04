import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PhotoTile } from './PhotoTile';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const TILE_MIN_HEIGHT = 72;
const TILE_MAX_HEIGHT = 220;
const COL_GAP = 4;

export interface MasonryColumn {
  photo: TimelinePhoto;
  tileHeight: number;
}

export interface MasonryBlockData {
  left: MasonryColumn[];
  right: MasonryColumn[];
}

function computeTileHeight(photo: TimelinePhoto, colWidth: number): number {
  if (photo.width && photo.height && photo.width > 0) {
    const natural = colWidth * (photo.height / photo.width);
    return Math.min(Math.max(natural, TILE_MIN_HEIGHT), TILE_MAX_HEIGHT);
  }
  return colWidth;
}

export function distributeMasonry(photos: TimelinePhoto[], colWidth: number): MasonryBlockData {
  const left: MasonryColumn[] = [];
  const right: MasonryColumn[] = [];
  let leftH = 0;
  let rightH = 0;

  for (const photo of photos) {
    const tileHeight = computeTileHeight(photo, colWidth);
    if (leftH <= rightH) {
      left.push({ photo, tileHeight });
      leftH += tileHeight + COL_GAP;
    } else {
      right.push({ photo, tileHeight });
      rightH += tileHeight + COL_GAP;
    }
  }

  return { left, right };
}

interface MasonryBlockProps {
  block: MasonryBlockData;
  columnWidth: number;
}

export function MasonryBlock({ block, columnWidth }: MasonryBlockProps) {
  return (
    <View style={styles.row} testID="masonry-block">
      <View style={[styles.col, { gap: COL_GAP }]}>
        {block.left.map((item) => (
          <PhotoTile
            key={item.photo.id}
            photo={item.photo}
            tileWidth={columnWidth}
            tileHeight={item.tileHeight}
          />
        ))}
      </View>
      <View style={[styles.col, { gap: COL_GAP }]}>
        {block.right.map((item) => (
          <PhotoTile
            key={item.photo.id}
            photo={item.photo}
            tileWidth={columnWidth}
            tileHeight={item.tileHeight}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: COL_GAP,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  col: {
    flex: 1,
    flexDirection: 'column',
  },
});
