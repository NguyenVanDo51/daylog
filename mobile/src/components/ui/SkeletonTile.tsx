import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radii } from '@/constants/theme';

interface SkeletonTileProps {
  size: number;
  alt?: boolean;
}

export function SkeletonTile({ size, alt = false }: SkeletonTileProps) {
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const [tl, tr, br, bl] = alt ? radii.stickerAlt : radii.sticker;
  return (
    <Animated.View
      style={[
        { width: size, height: size, backgroundColor: colors.borderSoft,
          borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
        styles.border,
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  border: { borderWidth: 3, borderColor: colors.white },
});
