import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { TrashIcon, PencilSimpleIcon } from 'phosphor-react-native';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { useAuthStore } from '@/stores/authStore';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

const IMAGE_HEIGHT = Math.round((Dimensions.get('window').width - spacing.lg * 2) * 0.75);

export default function ManageScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const { data: serverPhotos } = useDayPhotos(albumId ?? null, date ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const deletePhoto = useDeletePhoto(albumId!, date!);
  const updateCaption = useUpdateCaption(albumId!, date!);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const photos = (serverPhotos ?? []).filter((p) => !deletedIds.has(p.id));

  const parts = (date ?? '').split('-');
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : (date ?? '');

  function getCaptionValue(photo: DayPhoto): string {
    return photo.id in captions ? captions[photo.id] : (photo.caption ?? '');
  }

  async function handleCaptionBlur(photo: DayPhoto) {
    const newVal = getCaptionValue(photo);
    if (newVal === (photo.caption ?? '')) return;
    const captionToSave = newVal.trim() === '' ? null : newVal.trim();
    setSavingIds((prev) => new Set([...prev, photo.id]));
    try {
      await updateCaption.mutateAsync({ photoId: photo.id, caption: captionToSave });
    } catch {
      Alert.alert('', t('manage.save_error'));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
    }
  }

  function handleDelete(photo: DayPhoto, remainingCount: number) {
    Alert.alert(
      t('manage.delete_confirm_title'),
      t('manage.delete_confirm_body'),
      [
        { text: t('manage.cancel'), style: 'cancel' },
        {
          text: t('manage.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletedIds((prev) => new Set([...prev, photo.id]));
            try {
              await deletePhoto.mutateAsync(photo.id);
              if (remainingCount === 1) router.back();
            } catch {
              setDeletedIds((prev) => {
                const next = new Set(prev);
                next.delete(photo.id);
                return next;
              });
              Alert.alert('', t('manage.delete_error'));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        onBack={() => router.back()}
        title={
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{t('manage.title', { date: dateLabel })}</Text>
            {photos.length > 0 && (
              <Text style={styles.photoCount}>{photos.length} ảnh</Text>
            )}
          </View>
        }
      />

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: photo, index }) => {
          const isOwner = photo.uploaded_by === currentUserId;
          const isSaving = savingIds.has(photo.id);
          return (
            <StickerCard
              tilt="subtle"
              flip={index % 2 === 1}
              style={styles.card}
              testID={`manage-item-${photo.id}`}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: photo.thumb_url ?? undefined }}
                  style={styles.image}
                  resizeMode="cover"
                />
                {isOwner && (
                  <TouchableOpacity
                    testID={`delete-${photo.id}`}
                    onPress={() => handleDelete(photo, photos.length)}
                    hitSlop={8}
                    style={styles.deleteOverlay}
                  >
                    <StickerCard style={styles.deleteBtn}>
                      <TrashIcon size={16} color={theme.colors.textPrimary} weight="bold" />
                    </StickerCard>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.captionSection}>
                <View style={styles.pencilWrapper}>
                  <PencilSimpleIcon size={14} color={theme.colors.textMuted} />
                </View>
                {isOwner ? (
                  <TextInput
                    testID={`note-input-${photo.id}`}
                    style={styles.noteInput}
                    value={getCaptionValue(photo)}
                    onChangeText={(v) =>
                      setCaptions((prev) => ({ ...prev, [photo.id]: v }))
                    }
                    onBlur={() => handleCaptionBlur(photo)}
                    placeholder={t('manage.note_ph')}
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    maxLength={50}
                  />
                ) : (
                  <Text
                    testID={`note-readonly-${photo.id}`}
                    style={[styles.noteReadOnly, !photo.caption && styles.noteEmpty]}
                  >
                    {photo.caption ?? t('manage.note_ph')}
                  </Text>
                )}
                {isSaving && (
                  <StickerChip label="đang lưu..." variant="ink" />
                )}
              </View>
            </StickerCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },

  headerCenter: { alignItems: 'center' },
  title:        { ...typography.title, color: theme.colors.textPrimary },
  photoCount:   { ...typography.caption, color: theme.colors.textMuted, marginTop: 2 },

  list: { padding: spacing.lg, gap: spacing.lg },

  card:         { padding: 0, overflow: 'hidden' },
  imageContainer: { width: '100%', height: IMAGE_HEIGHT },
  image:        { width: '100%', height: '100%' },

  deleteOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  deleteBtn: {
    width: 36, height: 36,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.borderSoft,
  },
  pencilWrapper: { marginTop: 2 },
  noteInput: {
    ...typography.body,
    color: theme.colors.textPrimary,
    flex: 1,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  noteReadOnly: { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
  noteEmpty:    { color: theme.colors.textMuted, fontStyle: 'italic' },
});
