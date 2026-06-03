import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import type { UploadAsset } from '@/hooks/useUpload';
import { tap } from '@/lib/haptics';

interface PhotoThumbnailGridProps {
  assets: UploadAsset[];
  selected: Set<string>;
  onToggle: (uri: string) => void;
}

export function PhotoThumbnailGrid({ assets, selected, onToggle }: PhotoThumbnailGridProps) {
  const { width } = useWindowDimensions();
  const cellSize = (width - spacing['2xl'] * 2 - spacing.xs * 3) / 4;

  return (
    <View style={styles.grid}>
      {assets.map((a, i) => {
        const useAlt = i % 2 === 1;
        const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;
        return (
          <TouchableOpacity key={a.uri} onPress={() => { tap(); onToggle(a.uri); }} activeOpacity={0.85}>
            <Image source={{ uri: a.uri }} style={{
              width: cellSize, height: cellSize,
              borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl,
              borderWidth: 2, borderColor: colors.white, ...shadows.sticker,
            }} />
            {selected.has(a.uri) && (
              <View style={styles.check}>
                <Ionicons name="checkmark" size={14} color={colors.ink} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  check: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.yellow, borderWidth: 1.5, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', ...shadows.sticker,
  },
});
