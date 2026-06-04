import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet, StatusBar,
  useWindowDimensions, ActivityIndicator, Alert,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCaptureStore } from '@/stores/captureStore';
import { useCapture } from '@/hooks/useCapture';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tap } from '@/lib/haptics';

export default function CaptureReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { pendingAsset, clearPendingAsset } = useCaptureStore();
  const { capture, capturing } = useCapture();
  const [caption, setCaption] = useState('');

  const cardWidth = width - spacing['2xl'] * 2;
  const imageWidth = cardWidth - spacing.lg * 2;

  const dateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  // Must be called unconditionally (hook rules)
  const videoUri = pendingAsset?.type === 'video' ? pendingAsset.uri : '';
  const previewPlayer = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    if (pendingAsset?.type === 'video') p.play();
  });

  // Navigate back safely if there is no pending asset (cannot call router.back during render)
  React.useEffect(() => {
    if (!pendingAsset) router.back();
  }, [pendingAsset]);

  function handleRetake() {
    clearPendingAsset();
    router.back();
  }

  async function handleSend() {
    if (!pendingAsset) return;
    try {
      await capture(pendingAsset, caption.trim() || undefined);
      tap();
      clearPendingAsset();
      router.dismissAll();
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const secs = err.response.data?.retry_after_seconds ?? 1800;
        const mins = Math.ceil(secs / 60);
        Alert.alert(
          t('capture.cooldown_title'),
          t('capture.cooldown_body', { minutes: mins }),
          [
            { text: t('capture.cancel'), style: 'cancel' },
            {
              text: t('capture.cooldown_fallback'),
              onPress: () => { clearPendingAsset(); router.dismissAll(); },
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'));
      }
    }
  }

  if (!pendingAsset) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <StatusBar hidden />

      {/* Polaroid card */}
      <View style={[styles.card, { width: cardWidth }]}>
        {pendingAsset.type === 'video' ? (
          <VideoView
            player={previewPlayer}
            style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: pendingAsset.uri }}
            style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]}
            resizeMode="cover"
          />
        )}
        <View style={styles.footer}>
          <TextInput
            style={styles.captionInput}
            placeholder={t('capture.review_caption_ph')}
            placeholderTextColor={colors.inkMuted}
            value={caption}
            onChangeText={(v) => setCaption(v.slice(0, 60))}
            maxLength={60}
            returnKeyType="done"
          />
          <Text style={styles.dateStamp}>{dateStr}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} disabled={capturing}>
          <Ionicons name="camera-outline" size={20} color={colors.ink} />
          <Text style={styles.retakeBtnText}>{t('capture.retake')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={capturing}>
          {capturing
            ? <ActivityIndicator color={colors.white} />
            : <>
                <Ionicons name="paper-plane-outline" size={20} color={colors.white} />
                <Text style={styles.sendBtnText}>{t('capture.send')}</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.cream, alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  card:          { backgroundColor: colors.white, padding: spacing.lg, paddingBottom: spacing.md, borderRadius: 4, shadowColor: '#7C5CBF', shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  image:         { borderRadius: 2 },
  footer:        { marginTop: spacing.sm, gap: spacing.xs },
  captionInput:  { fontFamily: 'Caveat_600SemiBold', fontSize: 18, color: colors.ink, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateStamp:     { ...typography.caption, color: colors.inkMuted, textAlign: 'right', marginTop: spacing.xs },
  actions:       { flexDirection: 'row', gap: spacing.md, marginTop: spacing['2xl'] },
  retakeBtn:     { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 14, paddingVertical: spacing.md },
  retakeBtnText: { ...typography.body, color: colors.ink, fontWeight: '600' },
  sendBtn:       { flex: 2, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pink, borderRadius: 14, paddingVertical: spacing.md },
  sendBtnText:   { ...typography.body, color: colors.white, fontWeight: '700' },
});
