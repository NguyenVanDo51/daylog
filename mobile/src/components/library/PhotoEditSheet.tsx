import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, TouchableOpacity, TextInput, StyleSheet, Alert, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PlayIcon, TrashIcon } from 'phosphor-react-native';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { theme, spacing, typography } from '@/constants/theme';
import { SheetModal } from '@/components/ui/SheetModal';
import type { LibraryPhoto } from '@/hooks/useAlbumPhotos';

interface Props {
  albumId: string;
  photo: LibraryPhoto | null;
  onClose: () => void;
}

const PREVIEW_MAX_H_RATIO = 0.7;
const FALLBACK_RATIO_PHOTO = 3 / 4;
const FALLBACK_RATIO_VIDEO = 9 / 16;
const CAPTION_MAX = 50;

export function PhotoEditSheet({ albumId, photo, onClose }: Props) {
  const updateCaption = useUpdateCaption(albumId, photo?.date ?? '');
  const deletePhoto = useDeletePhoto(albumId, photo?.date ?? '');
  const { height: screenH } = useWindowDimensions();

  const [caption, setCaption] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const isVideo = photo?.media_type === 'video';
  const videoUri = isVideo ? (photo?.photo_url ?? '') : '';
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
  });

  // Width = sheet content, height derived from photo aspect ratio.
  // maxHeight caps very tall portraits (e.g., 9:16) at 70% of screen.
  const ratio =
    photo?.width && photo?.height
      ? photo.width / photo.height
      : isVideo
        ? FALLBACK_RATIO_VIDEO
        : FALLBACK_RATIO_PHOTO;
  const maxH = Math.round(screenH * PREVIEW_MAX_H_RATIO);
  const previewBoxStyle = [styles.previewWrap, { aspectRatio: ratio, maxHeight: maxH }];

  function setVideoPlaying(playing: boolean): void {
    if (playing) player.play();
    else player.pause();
    setIsPlaying(playing);
  }

  useEffect(() => {
    setCaption(photo?.caption ?? '');
    setVideoPlaying(isVideo);
  }, [photo?.id]);

  function toggleVideo(): void {
    if (isVideo) setVideoPlaying(!isPlaying);
  }

  const pending = updateCaption.isPending || deletePhoto.isPending;

  async function saveCaption(): Promise<void> {
    if (!photo) return;
    const trimmed = caption.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    if (next === (photo.caption ?? null)) return;
    try {
      await updateCaption.mutateAsync({ photoId: photo.id, caption: next });
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ghi chú. Thử lại nhé.');
    }
  }

  function confirmDelete(): void {
    Alert.alert(
      'Xoá ảnh?',
      'Ảnh sẽ bị xoá khỏi album. Không thể hoàn tác.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            if (!photo) return;
            try {
              await deletePhoto.mutateAsync(photo.id);
              onClose();
            } catch {
              Alert.alert('Lỗi', 'Không thể xoá ảnh. Thử lại nhé.');
            }
          },
        },
      ],
    );
  }

  return (
    <SheetModal visible={photo !== null} onClose={onClose}>
      {photo && (
        <View style={styles.body} testID="photo-edit-sheet">
          {isVideo ? (
            <Pressable
              style={previewBoxStyle}
              onPress={toggleVideo}
              testID="photo-edit-video-toggle"
            >
              <VideoView
                player={player}
                style={styles.preview}
                contentFit="contain"
                nativeControls={false}
              />
              {!isPlaying && (
                <View style={styles.videoBadge} pointerEvents="none">
                  <PlayIcon size={20} color={theme.colors.surface} weight="fill" />
                </View>
              )}
            </Pressable>
          ) : (
            <View style={previewBoxStyle}>
              <ExpoImage
                source={{ uri: photo.photo_url }}
                style={styles.preview}
                contentFit="contain"
                transition={120}
              />
            </View>
          )}

          <TextInput
            value={caption}
            onChangeText={setCaption}
            onBlur={saveCaption}
            placeholder="Thêm ghi chú…"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={CAPTION_MAX}
            style={styles.captionInput}
            editable={!pending}
            testID="photo-edit-caption"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={confirmDelete}
              disabled={pending}
              testID="photo-edit-delete"
            >
              <TrashIcon size={16} color={theme.colors.error} />
              <Text style={[styles.btnText, styles.btnTextDanger]}>Xoá ảnh</Text>
            </TouchableOpacity>
            <View style={styles.spacer} />
            {pending && <ActivityIndicator color={theme.colors.textPrimary} size="small" />}
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
              disabled={pending}
              testID="photo-edit-close"
            >
              <Text style={styles.btnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  previewWrap: {
    width: '100%',
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    backgroundColor: theme.overlays.surfaceOnDark,
  },
  preview: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginLeft: -22, marginTop: -22,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.overlays.scrimDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  captionInput: {
    ...typography.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.overlays.surfaceOnDark,
    borderRadius: theme.radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spacer: { flex: 1 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: theme.radii.md,
  },
  btnGhost: { backgroundColor: theme.overlays.surfaceOnDark },
  btnDanger: { backgroundColor: 'transparent' },
  btnText: { ...typography.body, color: theme.colors.textPrimary },
  btnTextDanger: { color: theme.colors.error, fontWeight: '700' },
});
