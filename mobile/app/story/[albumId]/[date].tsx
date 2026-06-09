import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CaretLeftIcon, PencilSimpleIcon, ArrowCircleDownIcon, TrashIcon } from 'phosphor-react-native';
import { useDayPhotos } from '@/hooks/useDayPhotos';
import { useAlbumDays } from '@/hooks/useAlbumDays';
import { useStoryExport } from '@/hooks/useStoryExport';
import { colors, fonts, spacing, typography } from '@/constants/theme';
import { PhotoItem, VideoItem, VlogOverlay } from './_components';

export default function StoryScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();

  const { data: photos, isLoading } = useDayPhotos(albumId, date);
  const { data: days } = useAlbumDays(albumId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);

  const { exporting, exportStory } = useStoryExport(photos ?? [], date);

  const goNext = useCallback(() => {
    if (!photos) return;
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(0);
    }
    setIsPaused(false);
    setPhotoProgress(0);
  }, [photos, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setIsPaused(false);
      setPhotoProgress(0);
    }
  }, [currentIndex]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  const goToDay = useCallback(
    (targetDate: string) => {
      router.replace(`/story/${albumId}/${targetDate}` as any);
    },
    [albumId],
  );

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .runOnJS(true)
    .onEnd((e) => {
      if (!days || !date) return;
      const currentDayIdx = days.findIndex((d) => d.date === date);
      if (e.translationX < -60 && currentDayIdx > 0) {
        goToDay(days[currentDayIdx - 1].date);
      } else if (e.translationX > 60 && currentDayIdx < days.length - 1) {
        goToDay(days[currentDayIdx + 1].date);
      }
    });

  const parts = (date ?? '').split('-');
  const dateChip = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : '';
  const dateLabel = parts.length === 3 ? `${parts[2]} / ${parts[1]}` : '';

  useEffect(() => {
    if (photos && photos.length === 0) {
      router.back();
    }
  }, [photos]);

  if (isLoading || !photos || photos.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  const current = photos[Math.min(currentIndex, photos.length - 1)];

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        <StatusBar hidden />

        {current.media_type === 'video' ? (
          <VideoItem
            photo={current}
            onEnd={goNext}
            isPaused={isPaused}
            onProgress={setPhotoProgress}
          />
        ) : (
          <PhotoItem
            photo={current}
            onEnd={goNext}
            isPaused={isPaused}
            onProgress={setPhotoProgress}
          />
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} testID="story-back" style={styles.circleBtn}>
            <CaretLeftIcon size={18} color={colors.white} />
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
                <PencilSimpleIcon size={16} color={colors.white} />
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
                  : <ArrowCircleDownIcon size={16} color={colors.white} />}
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
                <TrashIcon size={16} color={colors.error} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>Xoá ảnh</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.tapAreas}>
          <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
          <TouchableOpacity style={styles.tapCenter} onPress={togglePause} testID="story-pause-btn" />
          <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
        </View>

        {isPaused && (
          <View style={styles.pauseIcon} testID="story-pause-icon" pointerEvents="none">
            <Text style={styles.pauseIconText}>⏸</Text>
          </View>
        )}

        <View style={styles.progressLine} pointerEvents="none" testID="story-progress-line">
          <View
            style={[
              styles.progressFill,
              isPaused ? styles.progressFillPaused : styles.progressFillPlaying,
              { width: `${photoProgress * 100}%` },
            ]}
          />
        </View>

        <VlogOverlay
          photo={current}
          dayLabel={dateLabel}
          currentIndex={currentIndex}
          total={photos.length}
          bottomInset={insets.bottom}
          isPaused={isPaused}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm
  },
  circleBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center'
  },
  dateChip: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 7,
    paddingVertical: 3, paddingHorizontal: 8, ...typography.caption,
    color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, letterSpacing: 0.5,
    textAlign: 'center'
  },
  menuDots: { color: colors.white, fontSize: 12, letterSpacing: 1, lineHeight: 14 },
  tapAreas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft: { flex: 3 },
  tapCenter: { flex: 4 },
  tapRight: { flex: 3 },
  pauseIcon: {
    position: 'absolute',
    top: '50%', left: '50%',
    width: 52, height: 52,
    marginTop: -26, marginLeft: -26,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 15,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  pauseIconText: { fontSize: 20, color: colors.white },
  progressLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 20,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressFillPlaying: { backgroundColor: 'rgba(255,255,255,0.75)' },
  progressFillPaused: { backgroundColor: 'rgba(255,200,68,0.85)' },
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  menuDropdown: {
    position: 'absolute', top: 48, right: spacing.lg,
    backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 12,
    overflow: 'hidden', minWidth: 160,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  menuItemDanger: { borderBottomWidth: 0 },
  menuItemText: { ...typography.body, color: colors.white, fontSize: 13 },
});
