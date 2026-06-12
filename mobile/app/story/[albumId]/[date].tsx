import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PencilSimpleIcon, ArrowCircleDownIcon, TrashIcon, DotsThreeIcon, MusicNotesIcon } from 'phosphor-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { Image as ExpoImage } from 'expo-image';
import { useDayPhotos } from '@/hooks/useDayPhotos';
import { useAlbumDays } from '@/hooks/useAlbumDays';
import { useStoryExport } from '@/hooks/useStoryExport';
import { useDaySoundtrack } from '@/hooks/useDaySoundtrack';
import { ensureSoundtrackCached } from '@/hooks/useSoundtrackCache';
import { SoundtrackPickerSheet } from '@/components/story/SoundtrackPickerSheet';
import { theme, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StickerCard } from '@/components/ui/StickerCard';
import { OutlinedText } from '@/components/ui/OutlinedText';
import { PhotoItem, VlogOverlay } from './_components';

const PRELOAD_RADIUS = 2;

export default function StoryScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();

  const { data: photos, isLoading } = useDayPhotos(albumId, date);
  const { data: days } = useAlbumDays(albumId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: daySoundtrack } = useDaySoundtrack(albumId, date);
  const audioPlayer = useAudioPlayer(null);

  const { exporting, exportStory } = useStoryExport(photos ?? [], date, daySoundtrack?.id ?? null);

  // Dual persistent video players: one playing, the other pre-buffering the next item.
  // Per expo-video v56 docs, a VideoPlayer fills its buffers even when not attached to a VideoView.
  const playerA = useVideoPlayer(null, (p) => { p.muted = true; });
  const playerB = useVideoPlayer(null, (p) => { p.muted = true; });
  const [activeKey, setActiveKey] = useState<'A' | 'B'>('A');
  const activePlayer = activeKey === 'A' ? playerA : playerB;
  const uriARef = useRef<string | null>(null);
  const uriBRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (photos && photos.length === 0) {
      router.back();
    }
  }, [photos]);

  // Prefetch adjacent thumbnails so PhotoItem (used for photos and as video poster) renders instantly.
  useEffect(() => {
    if (!photos) return;
    const urls: string[] = [];
    for (let d = -PRELOAD_RADIUS; d <= PRELOAD_RADIUS; d++) {
      if (d === 0) continue;
      const idx = currentIndex + d;
      if (idx < 0 || idx >= photos.length) continue;
      const item = photos[idx];
      if (item.thumb_url) urls.push(item.thumb_url);
    }
    if (urls.length > 0) ExpoImage.prefetch(urls, 'memory-disk').catch(() => { });
  }, [currentIndex, photos]);

  // Active player status drives videoReady (avoid black-flash on source change / swap).
  useEffect(() => {
    setVideoReady(activePlayer.status === 'readyToPlay');
    const sub = activePlayer.addListener('statusChange', ({ status }) => {
      setVideoReady(status === 'readyToPlay');
    });
    return () => sub.remove();
  }, [activePlayer]);

  // Route the current item to a player: swap to standby if it already holds the URI, else load on active.
  useEffect(() => {
    if (!photos) return;
    const current = photos[Math.min(currentIndex, photos.length - 1)];

    if (current.media_type !== 'video') {
      playerA.pause();
      playerB.pause();
      return;
    }

    const target = current.photo_url;
    const aUri = uriARef.current;
    const bUri = uriBRef.current;

    if (activeKey === 'A' && aUri === target) {
      if (!isPaused) playerA.play();
    } else if (activeKey === 'B' && bUri === target) {
      if (!isPaused) playerB.play();
    } else if (activeKey === 'A' && bUri === target) {
      playerA.pause();
      setActiveKey('B');
    } else if (activeKey === 'B' && aUri === target) {
      playerB.pause();
      setActiveKey('A');
    } else {
      setVideoReady(false);
      if (activeKey === 'A') {
        uriARef.current = target;
        playerA.replaceAsync({ uri: target }).catch(() => { });
        if (!isPaused) playerA.play();
      } else {
        uriBRef.current = target;
        playerB.replaceAsync({ uri: target }).catch(() => { });
        if (!isPaused) playerB.play();
      }
    }
  }, [currentIndex, photos]);

  // After swap, kick off playback on the new active player.
  useEffect(() => {
    if (!photos) return;
    const current = photos[Math.min(currentIndex, photos.length - 1)];
    if (current.media_type !== 'video') return;
    if (!isPaused) activePlayer.play();
  }, [activeKey]);

  // Pre-buffer the next video onto whichever player is now standby.
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const nextIdx = currentIndex + 1;
    if (nextIdx >= photos.length) return;
    const next = photos[nextIdx];
    if (next.media_type !== 'video') return;

    const standby = activeKey === 'A' ? playerB : playerA;
    const standbyUriRef = activeKey === 'A' ? uriBRef : uriARef;
    if (standbyUriRef.current === next.photo_url) return;

    standbyUriRef.current = next.photo_url;
    standby.replaceAsync({ uri: next.photo_url }).catch(() => { });
    standby.pause();
  }, [currentIndex, photos, activeKey]);

  // Sync pause/play state with active player.
  useEffect(() => {
    if (!photos) return;
    const current = photos[Math.min(currentIndex, photos.length - 1)];
    if (current.media_type !== 'video') return;
    if (isPaused) activePlayer.pause();
    else activePlayer.play();
  }, [isPaused]);

  // Video end → advance (rebind to whichever player is active).
  useEffect(() => {
    const sub = activePlayer.addListener('playToEnd', goNext);
    return () => sub.remove();
  }, [goNext, activePlayer]);

  // Video progress reporting from the active player.
  useEffect(() => {
    if (!photos) return;
    const current = photos[Math.min(currentIndex, photos.length - 1)];
    if (current.media_type !== 'video') return;
    const id = setInterval(() => {
      const dur = activePlayer.duration;
      if (!dur || isNaN(dur) || dur === 0) { setPhotoProgress(0); return; }
      setPhotoProgress(Math.min(activePlayer.currentTime / dur, 1));
    }, 200);
    return () => clearInterval(id);
  }, [currentIndex, photos, isPaused, activeKey]);

  // Load + play day soundtrack
  useEffect(() => {
    if (!daySoundtrack || daySoundtrack.is_active === false) {
      audioPlayer.pause();
      audioPlayer.replace(null);
      return;
    }
    let cancelled = false;
    ensureSoundtrackCached(daySoundtrack.key).then((localUri) => {
      if (cancelled) return;
      audioPlayer.replace(localUri);
      audioPlayer.loop = true;
      audioPlayer.volume = 0.7;
      if (!isPaused) audioPlayer.play();
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [daySoundtrack?.key, daySoundtrack?.is_active]);

  // Sync audio pause/play with story pause/play
  useEffect(() => {
    if (!daySoundtrack || daySoundtrack.is_active === false) return;
    if (isPaused) audioPlayer.pause();
    else audioPlayer.play();
  }, [isPaused, daySoundtrack?.id]);

  // Cleanup audio when leaving story
  useEffect(() => () => {
    audioPlayer.pause();
    audioPlayer.replace(null);
  }, []);

  if (isLoading || !photos || photos.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <ActivityIndicator color={theme.colors.surface} />
      </View>
    );
  }

  const current = photos[Math.min(currentIndex, photos.length - 1)];
  const isVideo = current.media_type === 'video';

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        <StatusBar hidden />

        <ScreenHeader
          style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
          onBack={() => router.back()}
          backTestID="story-back"
          title={<OutlinedText size={18} testID="story-date-chip">{dateChip}</OutlinedText>}
          right={
            <TouchableOpacity onPress={() => setMenuOpen(true)} testID="story-menu-btn" hitSlop={8}>
              <StickerCard style={styles.topIconBtn}>
                <DotsThreeIcon size={16} color={theme.colors.textPrimary} weight="bold" />
              </StickerCard>
            </TouchableOpacity>
          }
        />

        {/* Dual VideoView — both mounted so standby keeps buffering; only the active one is visible. */}
        <VideoView
          player={playerA}
          style={[StyleSheet.absoluteFill, !(isVideo && videoReady && activeKey === 'A') && styles.hidden]}
          contentFit="contain"
          nativeControls={false}
        />
        <VideoView
          player={playerB}
          style={[StyleSheet.absoluteFill, !(isVideo && videoReady && activeKey === 'B') && styles.hidden]}
          contentFit="contain"
          nativeControls={false}
        />

        {/* Show photo; while a video is loading, render its thumbnail as a poster */}
        {(!isVideo || !videoReady) && (
          <PhotoItem
            photo={current}
            onEnd={!isVideo ? goNext : () => { }}
            isPaused={isPaused || isVideo}
            onProgress={!isVideo ? setPhotoProgress : () => { }}
          />
        )}

        {menuOpen && (
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
            testID="story-menu-backdrop"
          >
            <StickerCard shadow="heavy" style={styles.menuDropdown} testID="story-menu-dropdown">
              <TouchableOpacity
                style={styles.menuItem}
                testID="story-menu-edit"
                onPress={() => {
                  setMenuOpen(false);
                  router.push(`/story/${albumId}/${date}/manage` as any);
                }}
              >
                <PencilSimpleIcon size={16} color={theme.colors.textPrimary} />
                <Text style={styles.menuItemText}>Sửa ghi chú</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                testID="story-menu-soundtrack"
                onPress={() => {
                  setMenuOpen(false);
                  setPickerOpen(true);
                }}
              >
                <MusicNotesIcon size={16} color={theme.colors.textPrimary} />
                <Text style={styles.menuItemText}>Nhạc nền</Text>
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
                  ? <ActivityIndicator color={theme.colors.textPrimary} size="small" />
                  : <ArrowCircleDownIcon size={16} color={theme.colors.textPrimary} />}
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
                <TrashIcon size={16} color={theme.colors.error} />
                <Text style={[styles.menuItemText, { color: theme.colors.error }]}>Xoá ảnh</Text>
              </TouchableOpacity>
            </StickerCard>
          </TouchableOpacity>
        )}

        <View style={styles.tapAreas}>
          <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
          <TouchableOpacity style={styles.tapCenter} onPress={togglePause} testID="story-pause-btn" />
          <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
        </View>

        <VlogOverlay
          key={current.id}
          photo={current}
          currentIndex={currentIndex}
          total={photos.length}
          bottomInset={insets.bottom}
          isPaused={isPaused}
        />

        <View style={styles.progressLine} pointerEvents="none" testID="story-progress-line">
          <View
            style={[
              styles.progressFill,
              isPaused ? styles.progressFillPaused : styles.progressFillPlaying,
              { width: `${photos.length > 0 ? ((currentIndex + photoProgress) / photos.length) * 100 : 0}%` },
            ]}
          />
        </View>

        {pickerOpen && (
          <SoundtrackPickerSheet
            albumId={albumId}
            date={date}
            currentSoundtrackId={daySoundtrack?.id ?? null}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.overlays.cameraBg, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  topIconBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },

  tapAreas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft: { flex: 3 },
  tapCenter: { flex: 4 },
  tapRight: { flex: 3 },

  progressLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 4,
    backgroundColor: theme.overlays.surfaceOnDark,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    zIndex: 20,
  },
  progressFill: { height: '100%' },
  progressFillPlaying: { backgroundColor: theme.colors.surface },
  progressFillPaused: { backgroundColor: theme.colors.accent1 },

  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  menuDropdown: {
    position: 'absolute', top: 48, right: spacing.lg,
    minWidth: 160,
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: theme.border.hairline,
    borderBottomColor: theme.colors.borderSoft,
  },
  menuItemDanger: { borderBottomWidth: 0 },
  menuItemText: { ...typography.body, color: theme.colors.textPrimary, fontSize: 13 },
});
