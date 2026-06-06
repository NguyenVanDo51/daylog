import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView,
  StyleSheet, StatusBar, useWindowDimensions, ActivityIndicator, Alert,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePhotoReviewStore, ReviewAsset } from '@/stores/photoReviewStore';
import { useCapture } from '@/hooks/useCapture';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { PhotoThumbnailGrid } from '@/components/upload/PhotoThumbnailGrid';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success, tap } from '@/lib/haptics';

function VideoPreview({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={{ width, height, borderRadius: 2 }} contentFit="cover" nativeControls={false} />;
}

function toUploadAsset(a: ReviewAsset): UploadAsset {
  return { uri: a.uri, localAssetId: a.localAssetId, takenAt: a.takenAt ?? null };
}

export default function PhotoReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const assets = usePhotoReviewStore((s) => s.assets);
  const clear = usePhotoReviewStore((s) => s.clear);
  const { capture, canCapture, nextAvailableAt, capturing } = useCapture();
  const { uploadImages, uploading, progress } = useUpload();

  const [caption, setCaption] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(assets.map((a) => a.uri)));
  const [celebrate, setCelebrate] = useState(false);

  const cardWidth = width - spacing['2xl'] * 2;
  const imageWidth = cardWidth - spacing.lg * 2;
  const dateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  React.useEffect(() => {
    if (assets.length === 0) router.back();
  }, []);

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uri) ? next.delete(uri) : next.add(uri);
      return next;
    });
  }

  async function handleSendSingle() {
    const asset = assets[0];
    if (asset.source === 'camera') {
      if (!canCapture) {
        const mins = nextAvailableAt
          ? Math.ceil((nextAvailableAt.getTime() - Date.now()) / 60000)
          : 30;
        Alert.alert(
          t('capture.cooldown_title'),
          t('capture.cooldown_body', { minutes: mins }),
          [
            { text: t('capture.cancel'), style: 'cancel' },
            { text: t('capture.cooldown_fallback'), onPress: () => { clear(); router.dismissAll(); } },
          ],
        );
        return;
      }
      try {
        await capture(asset, caption.trim() || undefined);
        tap();
        clear();
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
              { text: t('capture.cooldown_fallback'), onPress: () => { clear(); router.dismissAll(); } },
            ],
          );
        } else {
          Alert.alert(t('common.error'));
        }
      }
    } else {
      const failed = await uploadImages([toUploadAsset(asset)], caption.trim() || undefined);
      if (failed > 0) {
        Alert.alert(t('upload.error_title'), t('upload.error_body', { success: 0, failed }));
      } else {
        success();
        clear();
        router.dismissAll();
      }
    }
  }

  async function handleUploadMulti() {
    const toUpload = assets.filter((a) => selected.has(a.uri)).map(toUploadAsset);
    const failed = await uploadImages(toUpload, undefined);
    success();
    if (failed > 0) {
      Alert.alert(t('upload.error_title'), t('upload.error_body', { success: toUpload.length - failed, failed }));
    } else {
      clear();
      router.dismissAll();
    }
  }

  if (assets.length === 0) return null;

  const isSingle = assets.length === 1;
  const asset = assets[0];
  const count = selected.size;
  const ctaLabel = count === 1 ? t('photo_review.upload_one') : t('photo_review.upload_n', { n: count });
  const progressLabel = uploading
    ? (progress < 0.05 ? t('upload.compressing') : t('upload.uploading', { done: Math.round(progress * count), total: count }))
    : '';

  if (isSingle) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <StatusBar hidden />
        <View style={[styles.card, { width: cardWidth }]}>
          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} width={imageWidth} height={imageWidth * 0.75} />
          ) : (
            <Image source={{ uri: asset.uri }} style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]} resizeMode="cover" />
          )}
          <View style={styles.cardFooter}>
            <TextInput
              style={styles.captionInput}
              placeholder={t('photo_review.note_ph')}
              placeholderTextColor={colors.inkMuted}
              value={caption}
              onChangeText={(v) => setCaption(v.slice(0, 60))}
              maxLength={60}
              returnKeyType="done"
            />
            <Text style={styles.dateStamp}>{dateStr}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {asset.source === 'camera' && (
            <TouchableOpacity style={styles.retakeBtn} onPress={() => router.back()} disabled={capturing}>
              <Ionicons name="camera-outline" size={20} color={colors.ink} />
              <Text style={styles.retakeBtnText}>{t('photo_review.retake')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.sendBtn, asset.source !== 'camera' && styles.sendBtnFull]}
            onPress={handleSendSingle}
            disabled={capturing || uploading}
          >
            {(capturing || uploading)
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="paper-plane-outline" size={20} color={colors.white} />
                  <Text style={styles.sendBtnText}>{t('photo_review.send')}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.multiContainer, { paddingTop: insets.top }]}>
      <StatusBar hidden />
      <ScrollView contentContainerStyle={styles.multiContent}>
        <PhotoThumbnailGrid
          assets={assets.map(toUploadAsset)}
          selected={selected}
          onToggle={toggleSelect}
        />
        {uploading && <Text style={styles.progress}>{progressLabel}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={ctaLabel} onPress={handleUploadMulti} fullWidth loading={uploading} disabled={!count} />
      </View>
      <Confetti visible={celebrate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream, alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  card:           { backgroundColor: colors.white, padding: spacing.lg, paddingBottom: spacing.md, borderRadius: 4, shadowColor: '#7C5CBF', shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  image:          { borderRadius: 2 },
  cardFooter:     { marginTop: spacing.sm, gap: spacing.xs },
  captionInput:   { fontFamily: 'Caveat_600SemiBold', fontSize: 18, color: colors.ink, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateStamp:      { ...typography.caption, color: colors.inkMuted, textAlign: 'right', marginTop: spacing.xs },
  actions:        { flexDirection: 'row', gap: spacing.md, marginTop: spacing['2xl'] },
  retakeBtn:      { flex: 1, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 14, paddingVertical: spacing.md },
  retakeBtnText:  { ...typography.body, color: colors.ink, fontWeight: '600' },
  sendBtn:        { flex: 2, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pink, borderRadius: 14, paddingVertical: spacing.md },
  sendBtnFull:    { flex: 1 },
  sendBtnText:    { ...typography.body, color: colors.white, fontWeight: '700' },
  multiContainer: { flex: 1, backgroundColor: colors.cream },
  multiContent:   { padding: spacing['2xl'] },
  footer:         { padding: spacing['2xl'] },
  progress:       { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.md, fontFamily: 'Caveat_500Medium', fontSize: 18 },
});
