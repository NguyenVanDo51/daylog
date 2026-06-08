import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { WarningCircle } from 'phosphor-react-native';
import { colors, radii, shadows } from '@/constants/theme';

interface PendingPhotoCellProps {
  localUri: string;
  status: 'uploading' | 'done' | 'error';
  size: number;
  index?: number;
}

export function PendingPhotoCell({ localUri, status, size, index = 0 }: PendingPhotoCellProps) {
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;

  const opacity = useRef(new Animated.Value(0.5)).current;
  const shimmerOpacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (status === 'uploading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacityAnim, { toValue: 0.65, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerOpacityAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else if (status === 'done') {
      shimmerOpacityAnim.stopAnimation();
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      shimmerOpacityAnim.stopAnimation();
    }
  }, [status]);

  return (
    <View
      testID="pending-cell-container"
      style={[
        { width: size, height: size, borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl },
        styles.container,
      ]}
    >
      <Animated.Image
        source={{ uri: localUri }}
        style={[styles.image, { opacity }]}
        resizeMode="cover"
      />
      {status === 'uploading' && (
        <Animated.View
          testID="shimmer-overlay"
          style={[StyleSheet.absoluteFill, styles.shimmer, { opacity: shimmerOpacityAnim }]}
        />
      )}
      {status === 'error' && (
        <View testID="error-badge" style={styles.errorBadge}>
          <WarningCircle size={16} color={colors.white} weight="fill" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:      { width: '100%', height: '100%' },
  shimmer:    { backgroundColor: colors.white },
  errorBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(220,50,50,0.9)', borderRadius: 10, padding: 2 },
});
