import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { colors, spacing } from '@/constants/theme';
import { MediaCaption } from '@/components/ui/MediaCaption';

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

  const [displayedCaption, setDisplayedCaption] = useState('');

  useEffect(() => {
    if (!caption) return;
    let capInterval: ReturnType<typeof setInterval>;
    const words = caption.split(' ');
    const capAvailableMs = Math.max(50, 1000);
    const capIntervalMs = Math.max(10, Math.floor(capAvailableMs / words.length));
    let wordIdx = 0;
    capInterval = setInterval(() => {
      wordIdx++;
      setDisplayedCaption(words.slice(0, wordIdx).join(' '));
      if (wordIdx >= words.length) clearInterval(capInterval);
    }, capIntervalMs);
    return () => clearInterval(capInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <MediaCaption
        time={timeStr}
        caption={displayedCaption || undefined}
        showPlayIcon
        isPaused={isPaused}
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
});
