import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayIcon, PauseIcon } from 'phosphor-react-native';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { colors, fonts, spacing } from '@/constants/theme';

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

  const [displayedTime, setDisplayedTime] = useState('');
  const [displayedCaption, setDisplayedCaption] = useState('');

  useEffect(() => {
    let timeIdx = 0;
    const timeInterval = setInterval(() => {
      timeIdx++;
      setDisplayedTime(timeStr.slice(0, timeIdx));
      if (timeIdx >= timeStr.length) clearInterval(timeInterval);
    }, 70);
    return () => clearInterval(timeInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!caption) return;
    let capInterval: ReturnType<typeof setInterval>;
    const capDelay = setTimeout(() => {
      let capIdx = 0;
      capInterval = setInterval(() => {
        capIdx++;
        setDisplayedCaption(caption.slice(0, capIdx));
        if (capIdx >= caption.length) clearInterval(capInterval);
      }, 35);
    }, timeStr.length * 70 + 100);
    return () => {
      clearTimeout(capDelay);
      clearInterval(capInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <View style={styles.upperCenter} pointerEvents="none">
        <View style={styles.timeRow} testID="vlog-time">
          {isPaused
            ? <PauseIcon size={16} color="#ffcc44" weight="fill" />
            : <PlayIcon size={16} color="#ffcc44" weight="fill" />}
          <Text style={styles.time} testID="vlog-time-text">{displayedTime}</Text>
        </View>
        {caption
          ? <Text style={styles.caption} testID="vlog-caption">{displayedCaption}</Text>
          : null}
      </View>

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
  upperCenter: {
    position: 'absolute',
    top: '38%' as any, // RN supports % strings for absolute position (SDK 56+)
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
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
    fontSize: 18,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.95)',
    fontStyle: 'italic',
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
