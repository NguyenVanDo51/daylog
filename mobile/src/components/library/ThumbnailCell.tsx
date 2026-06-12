import React from 'react';
import { TouchableOpacity, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PlayIcon } from 'phosphor-react-native';
import { StickerCard } from '@/components/ui/StickerCard';
import { theme, spacing } from '@/constants/theme';
import type { LibraryPhoto } from '@/hooks/useAlbumPhotos';

export const COLS = 2;
const COL_GAP = spacing.sm;
const SIDE_PADDING = spacing['2xl'];
const THUMB_RATIO = 1.2; // height / width — matches DayCell's tall variant

export function getColWidth(screenW: number): number {
  return (screenW - SIDE_PADDING * 2 - COL_GAP) / COLS;
}

interface Props {
  photo: LibraryPhoto;
  index: number;
  onPress: () => void;
}

export function ThumbnailCell({ photo, index, onPress }: Props) {
  const { width } = useWindowDimensions();
  const colWidth = getColWidth(width);
  const thumbHeight = colWidth * THUMB_RATIO;
  const uri = photo.thumb_url ?? photo.photo_url;

  return (
    <TouchableOpacity
      testID={`library-thumb-${photo.id}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={{ width: colWidth }}
    >
      <StickerCard tilt="default" flip={index % 2 === 1} style={styles.card}>
        <View style={[styles.thumbWrap, { height: thumbHeight }]}>
          <ExpoImage
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
          {photo.media_type === 'video' && (
            <View style={styles.videoBadge}>
              <PlayIcon size={14} color={theme.colors.surface} weight="fill" />
            </View>
          )}
        </View>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.xs, overflow: 'hidden' },
  thumbWrap: {
    width: '100%',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  videoBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.overlays.scrimDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
