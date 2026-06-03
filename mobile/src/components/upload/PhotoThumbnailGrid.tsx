import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import type { UploadAsset } from '@/hooks/useUpload';

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
      {assets.map((a) => (
        <TouchableOpacity key={a.uri} onPress={() => onToggle(a.uri)} activeOpacity={0.8}>
          <Image source={{ uri: a.uri }} style={{ width: cellSize, height: cellSize, borderRadius: radii.xs }} />
          {selected.has(a.uri) && (
            <View style={styles.check}>
              <Ionicons name="checkmark-circle" size={20} color={colors.pink} />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  check: { position: 'absolute', top: 4, right: 4 },
});
