import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useAlbumDays } from '@/hooks/useAlbumDays';
import { colors, spacing, typography } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const PHOTO_DURATION_MS = 3000;

function StoryProgress({ total, current, progress }: { total: number; current: number; progress: number }) {
  return (
    <View style={pg.bar} testID="story-progress">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={pg.seg}>
          <View
            style={[
              pg.fill,
              i < current
                ? pg.done
                : i === current
                ? { width: `${progress * 100}%` }
                : pg.empty,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const pg = StyleSheet.create({
  bar:   { flexDirection: 'row', gap: 3, flex: 1 },
  seg:   { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: colors.white, borderRadius: 2 },
  done:  { width: '100%' },
  empty: { width: '0%' },
});

function PhotoItem({ photo, onEnd, onProgress }: { photo: DayPhoto; onEnd: () => void; onProgress: (p: number) => void }) {
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      const frac = Math.min((Date.now() - start) / PHOTO_DURATION_MS, 1);
      onProgress(frac);
      if (frac < 1) requestAnimationFrame(tick);
      else onEnd();
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [photo.id]);

  return (
    <Image
      source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
    />
  );
}

function VideoItem({ photo, onEnd }: { photo: DayPhoto; onEnd: () => void }) {
  const player = useVideoPlayer(`${API_URL}/photos/${photo.id}/full`, (p) => {
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

function VlogOverlay({ photo }: { photo: DayPhoto }) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
      style={vlog.container}
      pointerEvents="none"
    >
      <Text style={vlog.date} testID="vlog-date">{dateStr}</Text>
      <Text style={vlog.time} testID="vlog-time">▶ {timeStr}</Text>
      {photo.caption?.trim() ? <Text style={vlog.caption} testID="vlog-caption">{photo.caption}</Text> : null}
    </LinearGradient>
  );
}

export default function StoryScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();

  const { data: photos, isLoading } = useDayPhotos(albumId, date);
  const { data: days } = useAlbumDays(albumId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoProgress, setPhotoProgress] = useState(0);

  const goNext = useCallback(() => {
    if (!photos) return;
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPhotoProgress(0);
    } else {
      router.back();
    }
  }, [photos, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setPhotoProgress(0);
    }
  }, [currentIndex]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (!days || !date) return;
      const currentDayIdx = days.findIndex((d) => d.date === date);
      if (e.translationX < -60 && currentDayIdx > 0) {
        runOnJS(router.replace as any)(`/story/${albumId}/${days[currentDayIdx - 1].date}`);
      } else if (e.translationX > 60 && currentDayIdx < days.length - 1) {
        runOnJS(router.replace as any)(`/story/${albumId}/${days[currentDayIdx + 1].date}`);
      }
    });

  const parts = (date ?? '').split('-');
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';

  if (isLoading || !photos) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  const current = photos[currentIndex];

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        <StatusBar hidden />

        {current.media_type === 'video' ? (
          <VideoItem photo={current} onEnd={goNext} />
        ) : (
          <PhotoItem photo={current} onEnd={goNext} onProgress={setPhotoProgress} />
        )}

        <View style={[styles.headerOverlay, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.progressRow}>
            <StoryProgress total={photos.length} current={currentIndex} progress={photoProgress} />
            <Text style={styles.dateText}>{dateLabel}</Text>
          </View>
          <View style={styles.topActions}>
            <View style={{ width: 32 }} />
            <TouchableOpacity onPress={() => router.back()} testID="story-close">
              <Ionicons name="close" size={26} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tapAreas}>
          <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
          <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
        </View>

        <VlogOverlay photo={current} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.lg, gap: spacing.sm },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateText:      { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 12, minWidth: 36, textAlign: 'right' },
  topActions:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tapAreas:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft:       { flex: 1 },
  tapRight:      { flex: 1 },
});

const vlog = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl * 2,
    zIndex: 10,
  },
  date: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(255,180,0,0.7)',
    letterSpacing: 0.5,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  time: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: '#ffcc44',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
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
});
