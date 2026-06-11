import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { theme, spacing } from '@/constants/theme';
import { MediaCaption } from '@/components/ui/MediaCaption';

const CHAR_STAGGER_MS = 20;
const CHAR_FADE_MS = 40;

function TypingChar({
  children,
  startMs,
  elapsed,
}: {
  children: string;
  startMs: number;
  elapsed: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = (elapsed.value - startMs) / CHAR_FADE_MS;
    return { opacity: t < 0 ? 0 : t > 1 ? 1 : t };
  });
  return <Animated.Text style={style}>{children}</Animated.Text>;
}

export function VlogOverlay({
  photo,
  currentIndex,
  total,
  bottomInset = 0,
  isPaused = false,
}: {
  photo: DayPhoto;
  currentIndex: number;
  total: number;
  bottomInset?: number;
  isPaused?: boolean;
}) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const caption = photo.caption?.trim() ?? '';
  const chars = caption ? Array.from(caption) : [];
  const totalMs = chars.length > 0 ? (chars.length - 1) * CHAR_STAGGER_MS + CHAR_FADE_MS : 0;

  const elapsed = useSharedValue(0);
  const [done, setDone] = useState(chars.length === 0);

  useEffect(() => {
    if (chars.length === 0 || done) return;

    if (isPaused) {
      cancelAnimation(elapsed);
      return;
    }

    const remaining = Math.max(0, totalMs - elapsed.value);
    if (remaining === 0) {
      setDone(true);
      return;
    }

    elapsed.value = withTiming(totalMs, { duration: remaining, easing: Easing.linear });
    const doneTimer = setTimeout(() => setDone(true), remaining);
    return () => clearTimeout(doneTimer);
  }, [isPaused, done, totalMs, chars.length, elapsed]);

  let captionNode: React.ReactNode | undefined;
  if (chars.length > 0) {
    captionNode = done
      ? caption
      : chars.map((c, i) => (
        <TypingChar key={i} startMs={i * CHAR_STAGGER_MS} elapsed={elapsed}>{c}</TypingChar>
      ));
  }

  return (
    <>

      <MediaCaption
        time={timeStr}
        caption={captionNode}
      />

      <LinearGradient
        colors={['transparent', theme.overlays.scrimSoft, theme.overlays.scrimDeep]}
        style={[styles.container, { paddingBottom: spacing.xl + bottomInset }]}
        pointerEvents="none"
      >
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              testID={i === currentIndex ? 'story-dot-active' : 'story-dot'}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  captionPosition: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    zIndex: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2.5,
    backgroundColor: theme.overlays.surfaceOnDark,
  },
  dotActive: {
    width: 18,
    height: 4,
    borderRadius: 3,
    backgroundColor: theme.colors.surface,
  },
});
