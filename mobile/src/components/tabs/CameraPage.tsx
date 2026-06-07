import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, AppState, Linking, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import * as SecureStore from 'expo-secure-store';

const HINT_KEY = 'capture.hint_seen';
const VI_DAYS = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];

interface Props {
  onTabPress: (index: number) => void;
}

function formatClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    date: `${VI_DAYS[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}`,
  };
}

export function CameraPage({ onTabPress }: Props) {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const [clock, setClock] = useState(formatClock);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  // Lock to portrait permanently
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  // Live clock — ticks every second
  React.useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // First-launch hint
  React.useEffect(() => {
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, []);

  // Stop recording when app backgrounds
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
    .onStart(startRecord).onEnd(stopRecord).onFinalize(stopRecord);
  const composed = Gesture.Exclusive(longPressGesture, tapGesture);

  if (!permissionResponse) return <View style={styles.container} />;

  if (!permissionResponse.granted) {
    if (permissionResponse.canAskAgain !== false) requestPermission();
    return (
      <View style={styles.container}>
        <Modal transparent animationType="fade" visible>
          <View style={styles.permOverlay}>
            <View style={styles.permSheet}>
              <Text style={styles.permTitle}>{t('capture.perm_title')}</Text>
              <Text style={styles.permBody}>{t('capture.perm_body')}</Text>
              <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.permBtnText}>{t('capture.perm_open')}</Text>
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

      {/* Inset bordered viewfinder */}
      <View
        style={[
          styles.viewfinder,
          { top: insets.top + spacing.sm, bottom: insets.bottom + spacing['3xl'] + 60 },
        ]}
      >
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute />

        {/* Close (left) + Flip (right) */}
        <View style={styles.topBar}>
          <TouchableOpacity testID="close-btn" style={styles.closeBtn} onPress={() => onTabPress(1)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Live clock centered in viewfinder */}
        <View style={styles.clockOverlay} pointerEvents="none">
          <Text testID="clock-display" style={styles.clockTime}>{clock.time}</Text>
          <Text style={styles.clockDate}>{clock.date}</Text>
        </View>
      </View>

      {/* First-launch hint */}
      {showHint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>{t('capture.hint_video')}</Text>
        </View>
      )}

      {/* Shutter */}
      <View style={[styles.shutterArea, { bottom: insets.bottom + spacing.lg }]}>
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
  container: { flex: 1, backgroundColor: colors.cream },

  viewfinder: {
    position: 'absolute', left: spacing.lg, right: spacing.lg,
    borderRadius: 18, borderWidth: 2, borderColor: colors.ink,
    shadowColor: colors.ink, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0, elevation: 4, overflow: 'hidden',
  },

  topBar: {
    position: 'absolute', top: 10, left: 10, right: 10,
    flexDirection: 'row', justifyContent: 'space-between', zIndex: 10,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.pink, borderWidth: 1.5, borderColor: colors.ink,
    shadowColor: colors.ink, shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1, shadowRadius: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: colors.white, fontWeight: '700' },
  flipBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },

  clockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  clockTime: {
    fontFamily: 'Caveat_700Bold', fontSize: 42, color: colors.white,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  clockDate: {
    fontFamily: 'Caveat_600SemiBold', fontSize: 15,
    color: 'rgba(255,255,255,0.6)', marginTop: 4,
  },

  shutterArea:  { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  progressArc:  { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.pink, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },

  hint:        { position: 'absolute', bottom: 160, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
  hintText:    { ...typography.caption, color: colors.white, fontSize: 13 },
  permOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  permSheet:   { width: '100%', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing['2xl'], gap: spacing.md },
  permTitle:   { ...typography.title, color: colors.ink },
  permBody:    { ...typography.body, color: colors.inkSoft },
  permBtn:     { backgroundColor: colors.pink, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  permBtnText: { ...typography.body, color: colors.white, fontWeight: '700' },
});
