import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, AppState, Linking, Modal,
} from 'react-native';
import {
  CameraView, useCameraPermissions, CameraType,
} from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import * as SecureStore from 'expo-secure-store';

const HINT_KEY = 'capture.hint_seen';

export default function CaptureScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  // Show hint once for long-press video
  React.useEffect(() => {
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, []);

  // Cancel recording if app backgrounds
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
    if (recordingRef.current) {
      cameraRef.current?.stopRecording();
    }
  }

  const tapGesture = Gesture.Tap().runOnJS(true).onStart(() => {
    takePhoto();
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(250)
    .runOnJS(true)
    .onStart(() => { startRecord(); })
    .onEnd(() => { stopRecord(); })
    .onFinalize(() => { stopRecord(); });

  const composed = Gesture.Exclusive(longPressGesture, tapGesture);

  if (!permissionResponse) return <View style={styles.container} />;

  if (!permissionResponse.granted) {
    if (permissionResponse.canAskAgain !== false) {
      requestPermission();
    }
    return (
      <View style={styles.container}>
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.permOverlay}>
            <View style={styles.permSheet}>
              <Text style={styles.permTitle}>{t('capture.perm_title')}</Text>
              <Text style={styles.permBody}>{t('capture.perm_body')}</Text>
              <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.permBtnText}>{t('capture.perm_open')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.permCancel}>{t('capture.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute={true} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        >
          <Ionicons name="camera-reverse-outline" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Video hint toast */}
      {showHint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>{t('capture.hint_video')}</Text>
        </View>
      )}

      {/* Shutter */}
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
  container:    { flex: 1, backgroundColor: '#000' },
  topBar:       { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, zIndex: 10 },
  iconBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  shutterArea:  { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  progressArc:  { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.pink, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },
  hint:         { position: 'absolute', bottom: 160, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
  hintText:     { ...typography.caption, color: colors.white, fontSize: 13 },
  permOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  permSheet:    { width: '100%', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing['2xl'], gap: spacing.md },
  permTitle:    { ...typography.title, color: colors.ink },
  permBody:     { ...typography.body, color: colors.inkSoft },
  permBtn:      { backgroundColor: colors.pink, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  permBtnText:  { ...typography.body, color: colors.white, fontWeight: '700' },
  permCancel:   { ...typography.body, color: colors.inkMuted, textAlign: 'center', paddingVertical: spacing.sm },
});
