import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayIcon, PauseIcon } from 'phosphor-react-native';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { colors, fonts, spacing } from '@/constants/theme';

export function VlogOverlay({
  photo,
  dayLabel,
  currentIndex,
  total,
  bottomInset = 0,
  isPaused = false,
}: {
  photo: DayPhoto;
  dayLabel: string;
  currentIndex: number;
  total: number;
  bottomInset?: number;
  isPaused?: boolean;
}) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
      style={[styles.container, { paddingBottom: spacing.xl + bottomInset }]}
      pointerEvents="none"
    >
      <Text style={styles.dayHero} testID="story-day-hero">{dayLabel}</Text>
      <View style={styles.timeRow} testID="vlog-time">
        {isPaused
          ? <PauseIcon size={16} color="#ffcc44" weight="fill" />
          : <PlayIcon size={16} color="#ffcc44" weight="fill" />}
        <Text style={styles.time}>{timeStr}</Text>
      </View>
      {photo.caption?.trim() ? <Text style={styles.caption} testID="vlog-caption">{photo.caption}</Text> : null}
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
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl * 2,
    zIndex: 10,
  },
  dayHero: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 3,
    fontFamily: fonts.regular,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  time: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#ffcc44',
    letterSpacing: 1,
    textShadowColor: 'rgba(255,180,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  caption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    fontStyle: 'italic',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  dot: {
    width: 5, height: 5,
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
