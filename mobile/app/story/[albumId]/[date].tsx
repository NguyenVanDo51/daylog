import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  useWindowDimensions, ActivityIndicator, Alert,
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
import { useStoryExport } from '@/hooks/useStoryExport';
import { colors, spacing, typography } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const PHOTO_DURATION_MS = 3000;

function PhotoItem({ photo, onEnd }: { photo: DayPhoto; onEnd: () => void }) {
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      const frac = Math.min((Date.now() - start) / PHOTO_DURATION_MS, 1);
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
  const [menuOpen, setMenuOpen] = useState(false);

  const { exporting, exportStory } = useStoryExport(photos ?? [], date);

  const goNext = useCallback(() => {
    if (!photos) return;
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(0);
    }
  }, [photos, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
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
  const dateChip  = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : '';

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
          <PhotoItem photo={current} onEnd={goNext} />
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} testID="story-back" style={styles.circleBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.dateChip} testID="story-date-chip">{dateChip}</Text>
          <TouchableOpacity onPress={() => setMenuOpen(true)} testID="story-menu-btn" style={styles.circleBtn}>
            <Text style={styles.menuDots}>•••</Text>
          </TouchableOpacity>
        </View>

        {menuOpen && (
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
            testID="story-menu-backdrop"
          >
            <View style={styles.menuDropdown} testID="story-menu-dropdown">
              <TouchableOpacity
                style={styles.menuItem}
                testID="story-menu-edit"
                onPress={() => {
                  setMenuOpen(false);
                  router.push(`/story/${albumId}/${date}/manage` as any);
                }}
              >
                <Ionicons name="create-outline" size={16} color={colors.white} />
                <Text style={styles.menuItemText}>Sửa ghi chú</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                testID="story-menu-export"
                onPress={() => {
                  setMenuOpen(false);
                  exportStory();
                }}
                disabled={exporting}
              >
                {exporting
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Ionicons name="arrow-down-circle-outline" size={16} color={colors.white} />}
                <Text style={styles.menuItemText}>Lưu về máy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDanger]}
                testID="story-menu-delete"
                onPress={() => {
                  setMenuOpen(false);
                  Alert.alert('Xoá ảnh', 'Tính năng này sẽ có sớm.');
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                <Text style={[styles.menuItemText, { color: '#ff6b6b' }]}>Xoá ảnh</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

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
  container:  { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  topBar:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  circleBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)',
                alignItems: 'center', justifyContent: 'center' },
  dateChip:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 7,
                paddingVertical: 3, paddingHorizontal: 8, ...typography.caption,
                color: 'rgba(255,255,255,0.75)', fontFamily: 'Courier New', letterSpacing: 0.5 },
  menuDots:   { color: colors.white, fontSize: 12, letterSpacing: 1, lineHeight: 14 },
  tapAreas:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft:    { flex: 1 },
  tapRight:   { flex: 1 },
  menuBackdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  menuDropdown:   { position: 'absolute', top: 48, right: spacing.lg,
                    backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 12,
                    overflow: 'hidden', minWidth: 160,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuItem:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                    paddingVertical: 12, paddingHorizontal: spacing.lg,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemDanger: { borderBottomWidth: 0 },
  menuItemText:   { ...typography.body, color: colors.white, fontSize: 13 },
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
