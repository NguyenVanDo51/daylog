import React from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows, typography, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  index?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function PhotoCell({ uri, caption, size, index = 0, onPress, style }: PhotoCellProps) {
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;
  return (
    <View>
      <TouchableOpacity
        onPress={() => { tap(); onPress?.(); }}
        style={[
          { width: size, height: size,
            borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
          styles.container,
          style,
        ]}
        activeOpacity={0.9}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:     { width: '100%', height: '100%' },
  caption:   {
    ...typography.handAccent, color: colors.inkSoft, fontSize: 14,
    textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs,
  },
});
