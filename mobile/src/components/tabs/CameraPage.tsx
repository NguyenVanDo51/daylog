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
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const [clock, setClock] = useState<string>(formatClock);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, []);

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
    const start = Date.now();
    progress.value = withTiming(1, { duration: 2000, easing: Easing.linear });
    const video = await cameraRef.current?.recordAsync({ maxDuration: 2 });
    const durationMs = Math.min(Date.now() - start, 2000);
    recordingRef.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    if (video) handleMediaCaptured({ type: 'video', uri: video.uri, durationMs });
  }

  function stopRecord() {
    if (recordingRef.current) cameraRef.current?.stopRecording();
  }

  const tapGesture = Gesture.Tap().runOnJS(true).onStart(takePhoto);
  const longPressGesture = Gesture.LongPress().minDuration(250).runOnJS(true)
    .onStart(startRecord).onFinalize(stopRecord);
  const composed = Gesture.Exclusive(longPressGesture, tapGesture);

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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute />

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

      {showHint && (
        <View style={styles.hintArea} pointerEvents="none">
          <StickerChip label={t('capture.hint_video')} variant="ink" />
        </View>
      )}

      <View style={[styles.shutterArea, { paddingBottom: insets.bottom + spacing['2xl'] }]}>
        <GestureDetector gesture={composed}>
          <View style={styles.shutterOuter}>
            <Animated.View style={[styles.progressArc, progressStyle]} />
            <View style={styles.shutterInner} />
          </View>
        </GestureDetector>
      </View>
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
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: theme.border.thick, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadows.stickerHeavy,
    backgroundColor: theme.colors.surface,
  },
  progressArc:  { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: theme.colors.primary, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, borderWidth: theme.border.medium, borderColor: theme.colors.border },
  permOverlay:  { flex: 1, backgroundColor: theme.overlays.scrimDeep, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
  permSheet:    { width: '100%', padding: spacing['2xl'], gap: spacing.md },
  permTitle:    { ...typography.title, color: theme.colors.textPrimary },
  permBody:     { ...typography.body, color: theme.colors.textSecondary },
});
