import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, AppState, Linking, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router } from 'expo-router';
import { X, CameraRotate } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import * as SecureStore from 'expo-secure-store';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { MediaCaption } from '@/components/ui/MediaCaption';

const HINT_KEY = 'capture.hint_seen';
const MODE_KEY = 'capture.mode';

interface Props {
  onTabPress: (index: number) => void;
}

function formatClock(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function CameraPage({ onTabPress }: Props) {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [mode, setModeState] = useState<'photo' | 'video'>('video');
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [clock, setClock] = useState<string>(formatClock);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const recordMorph = useSharedValue(0);
  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const shutterInnerStyle = useAnimatedStyle(() => {
    const size = 56 - recordMorph.value * 28;
    const radius = 28 - recordMorph.value * 22;
    return { width: size, height: size, borderRadius: radius };
  });

  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    SecureStore.getItemAsync(MODE_KEY).then((saved) => {
      if (saved === 'photo' || saved === 'video') setModeState(saved);
    });
  }, []);

  function setMode(next: 'photo' | 'video') {
    setModeState(next);
    SecureStore.setItemAsync(MODE_KEY, next).catch(() => {});
  }

  React.useEffect(() => {
    if (mode !== 'video') return;
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, [mode]);

  React.useEffect(() => {
    if (permissionResponse && !permissionResponse.granted && permissionResponse.canAskAgain !== false) {
      requestPermission();
    }
  }, [permissionResponse?.granted, permissionResponse?.canAskAgain]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && recordingRef.current) {
        cameraRef.current?.stopRecording();
        recordingRef.current = false;
        progress.value = 0;
      }
    });
    return () => sub.remove();
  }, []);

  function handleMediaCaptured(asset: { type: 'photo' | 'video'; uri: string; durationMs?: number }) {
    usePhotoReviewStore.getState().setAssets([{
      uri: asset.uri,
      type: asset.type,
      source: 'camera',
      durationMs: asset.durationMs,
      takenAt: new Date().toISOString(),
    }]);
    router.push('/photo-review');
  }

  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, skipProcessing: true });
    if (photo) handleMediaCaptured({ type: 'photo', uri: photo.uri });
  }

  async function startRecord() {
    if (recordingRef.current) return;
    recordingRef.current = true;
    setRecordingActive(true);
    recordMorph.value = withTiming(1, { duration: 150 });
    const start = Date.now();
    progress.value = withTiming(1, { duration: 2000, easing: Easing.linear });
    const finalizingTimer = setTimeout(() => setFinalizing(true), 2000);
    const video = await cameraRef.current?.recordAsync({ maxDuration: 2, videoQuality: '1080p' });
    clearTimeout(finalizingTimer);
    setFinalizing(false);
    setRecordingActive(false);
    const durationMs = Math.min(Date.now() - start, 2000);
    recordingRef.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    recordMorph.value = withTiming(0, { duration: 150 });
    if (video) handleMediaCaptured({ type: 'video', uri: video.uri, durationMs });
  }

  function handleShutter() {
    if (mode === 'photo') takePhoto();
    else startRecord();
  }

  const tapGesture = Gesture.Tap().runOnJS(true).onStart(handleShutter);

  if (!permissionResponse) return <View style={styles.container} />;

  if (!permissionResponse.granted) {
    return (
      <View style={styles.container}>
        <Modal transparent animationType="fade" visible>
          <View style={styles.permOverlay}>
            <StickerCard shadow="heavy" style={styles.permSheet}>
              <Text style={styles.permTitle}>{t('capture.perm_title')}</Text>
              <Text style={styles.permBody}>{t('capture.perm_body')}</Text>
              <StickerButton
                label={t('capture.perm_open')}
                variant="primary"
                fullWidth
                onPress={() => Linking.openSettings()}
              />
            </StickerCard>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={mode === 'photo' ? 'picture' : 'video'}
        mute
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity testID="close-btn" onPress={() => onTabPress(1)} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <X size={20} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CameraRotate size={20} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
      </View>

      <MediaCaption time={clock} style={styles.clockArea} />

      {showHint && !finalizing && (
        <View style={styles.hintArea} pointerEvents="none">
          <StickerChip label={t('capture.hint_video')} variant="ink" />
        </View>
      )}

      {finalizing && (
        <View style={styles.hintArea} pointerEvents="none">
          <StickerChip label={t('capture.finalizing')} variant="yellow" />
        </View>
      )}

      <View style={[styles.shutterArea, { paddingBottom: insets.bottom + spacing['2xl'] }]}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            testID="mode-photo"
            onPress={() => setMode('photo')}
            disabled={recordingRef.current}
            hitSlop={8}
          >
            <StickerChip
              label={t('capture.mode_photo')}
              variant={mode === 'photo' ? 'yellow' : 'ink'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID="mode-video"
            onPress={() => setMode('video')}
            disabled={recordingRef.current}
            hitSlop={8}
          >
            <StickerChip
              label={t('capture.mode_video')}
              variant={mode === 'video' ? 'yellow' : 'ink'}
            />
          </TouchableOpacity>
        </View>
        <GestureDetector gesture={tapGesture}>
          <View style={styles.shutterOuter}>
            <Animated.View style={[styles.shutterInner, shutterInnerStyle]} />
          </View>
        </GestureDetector>
      </View>

      {recordingActive && (
        <View
          style={[styles.progressTrack, { bottom: insets.bottom + spacing.sm }]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.progressFill, progressFillStyle]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.overlays.cameraBg },
  topBar:       { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, zIndex: 10 },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', padding: 0 },
  clockArea:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  hintArea:     { position: 'absolute', bottom: 160, left: 0, right: 0, alignItems: 'center' },
  shutterArea:  { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  modeToggle:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: theme.border.thick, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadows.stickerHeavy,
    backgroundColor: theme.colors.surface,
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, borderWidth: theme.border.medium, borderColor: theme.colors.border },
  progressTrack: {
    position: 'absolute',
    left: spacing['2xl'], right: spacing['2xl'],
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.medium,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.stickerHeavy,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  permOverlay:  { flex: 1, backgroundColor: theme.overlays.scrimDeep, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
  permSheet:    { width: '100%', padding: spacing['2xl'], gap: spacing.md },
  permTitle:    { ...typography.title, color: theme.colors.textPrimary },
  permBody:     { ...typography.body, color: theme.colors.textSecondary },
});
