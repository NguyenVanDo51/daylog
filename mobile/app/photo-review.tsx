import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
  KeyboardAvoidingView, Platform, Keyboard, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { XIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { useCapture, type UploadResult } from '@/hooks/useCapture';
import { useAlbums } from '@/hooks/useAlbums';
import { useLastAlbumSelection } from '@/hooks/useLastAlbumSelection';
import { Confetti } from '@/components/ui/Confetti';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { theme, spacing, typography } from '@/constants/theme';
import { success } from '@/lib/haptics';
import { t } from '@/lib/i18n';

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function PhotoReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const assets = usePhotoReviewStore((s) => s.assets);
  const clear = usePhotoReviewStore((s) => s.clear);
  const { startBackgroundUpload, finishCapture } = useCapture();
  const { data: albums = [] } = useAlbums();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const uploadPromiseRef = useRef<Promise<UploadResult> | undefined>(undefined);
  const { savedIds, persist } = useLastAlbumSelection();
  const initializedRef = useRef(false);

  const asset = assets[0];

  useEffect(() => {
    if (assets.length === 0) { router.back(); return; }
    uploadPromiseRef.current = startBackgroundUpload(asset);
  }, []);

  useEffect(() => {
    if (initializedRef.current || savedIds === null || albums.length === 0) return;
    initializedRef.current = true;
    const valid = savedIds.filter((id) => albums.some((a) => a.id === id));
    if (valid.length > 0) setSelectedIds(new Set(valid));
  }, [savedIds, albums]);

  if (assets.length === 0 || !asset) return null;

  const timeStr = asset.takenAt
    ? new Date(asset.takenAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  function toggleAlbum(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const albumIds = Array.from(selectedIds);
    setSaving(true);
    try {
      const result = await uploadPromiseRef.current!;
      await finishCapture(result, asset, albumIds, caption.trim() || null);
      if (albumIds.length > 0) void persist(albumIds);
      success();
      setCelebrate(true);
      setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
    } catch {
      Alert.alert(t('common.error'), t('photo_review.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar hidden />

          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} />
          ) : (
            <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}

          <LinearGradient
            colors={[theme.overlays.scrimSoft, 'transparent']}
            style={[styles.gradientTop, { paddingTop: insets.top }]}
          >
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-close" hitSlop={8}>
                <StickerCard style={styles.closeBtn}>
                  <XIcon size={20} color={theme.colors.textPrimary} weight="bold" />
                </StickerCard>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-retake">
                <StickerChip label={t('capture.retake')} variant="yellow" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.timeArea} pointerEvents="box-none">
            {timeStr ? (
              <StickerChip label={timeStr} variant="yellow" tilt="playful" flip />
            ) : null}
          </View>

          <View style={styles.captionArea}>
            <StickerCard style={styles.captionCard}>
              <TextInput
                testID="review-note-input"
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder={t('photo_review.note_ph')}
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
            </StickerCard>
          </View>

          <LinearGradient
            colors={['transparent', theme.overlays.scrimDeep]}
            style={[styles.gradientBottom, { paddingBottom: insets.bottom + spacing.lg }]}
          >
            <View style={styles.albumChips}>
              {albums.map((album) => {
                const selected = selectedIds.has(album.id);
                return (
                  <TouchableOpacity
                    key={album.id}
                    testID={`album-checkbox-${album.id}`}
                    onPress={() => toggleAlbum(album.id)}
                    activeOpacity={0.7}
                  >
                    <StickerChip
                      label={selected ? `✓ ${album.name}` : album.name}
                      variant={selected ? 'pink' : 'white'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <StickerButton
              testID="review-save"
              label="Lưu vào nhật ký"
              variant="inverted"
              shadow="heavy"
              fullWidth
              loading={saving}
              disabled={selectedIds.size === 0}
              onPress={handleSave}
            />
          </LinearGradient>

          <Confetti visible={celebrate} />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.overlays.cameraBg,
  },
  gradientTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  timeArea: {
    position: 'absolute',
    top: '22%',
    left: 0, right: 0,
    alignItems: 'center',
  },
  captionArea: {
    position: 'absolute',
    top: '32%',
    left: spacing['2xl'], right: spacing['2xl'],
  },
  captionCard: {
    padding: spacing.md,
  },
  captionInput: {
    ...typography.body,
    color: theme.colors.textPrimary,
    minHeight: 36,
    maxHeight: 96,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    gap: spacing.md,
  },
  albumChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
