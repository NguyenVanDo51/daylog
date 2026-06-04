import React, { useRef, useState } from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, shadows, typography, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { ReactionPicker } from './ReactionPicker';
import { ReactionBadge } from './ReactionBadge';
import { useReactions, useReact } from '@/hooks/useReactions';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  index?: number;
  photoId?: string;
  onPress?: () => void;
  style?: ViewStyle;
  showReactions?: boolean;
}

export function PhotoCell({ uri, caption, size, index = 0, photoId, onPress, style, showReactions }: PhotoCellProps) {
  const ref = useRef<View>(null);
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;
  const [pickerVisible, setPickerVisible] = useState(false);
  const { data: reactionData = [] } = useReactions(showReactions ? (photoId ?? '') : '');
  const { add } = useReact(photoId ?? '');

  function handlePress() {
    tap();
    if (photoId) {
      ref.current?.measureInWindow((x, y, w, h) => {
        router.push({ pathname: `/photo/${photoId}`, params: { srcX: x, srcY: y, srcW: w, srcH: h } });
      });
      return;
    }
    onPress?.();
  }

  return (
    <View>
      <TouchableOpacity
        ref={ref as any}
        onPress={handlePress}
        onLongPress={() => { if (showReactions) setPickerVisible(true); }}
        delayLongPress={350}
        style={[
          { width: size, height: size,
            borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
          styles.container,
          style,
        ]}
        activeOpacity={0.9}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        {showReactions && <ReactionBadge reactions={reactionData} />}
      </TouchableOpacity>
      {showReactions && (
        <ReactionPicker
          visible={pickerVisible}
          onSelect={(emoji) => add.mutate(emoji)}
          onDismiss={() => setPickerVisible(false)}
        />
      )}
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:     { width: '100%', height: '100%' },
  caption:   { ...typography.handAccent, color: colors.inkSoft, fontSize: 14, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs },
});
