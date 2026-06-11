import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CaretLeftIcon, TrashIcon, PencilSimpleIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';
import { t } from '@/lib/i18n';

const IMAGE_HEIGHT = Math.round((Dimensions.get('window').width - spacing.lg * 2) * 0.75);

export default function ManageScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <CaretLeftIcon size={24} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('manage.title', { date: dateLabel })}</Text>
          {photos.length > 0 && (
            <Text style={styles.photoCount}>{photos.length} ảnh</Text>
          )}
        </View>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: photo }) => {
          const isOwner = photo.uploaded_by === currentUserId;
          const isSaving = savingIds.has(photo.id);
          return (
            <View style={styles.card} testID={`manage-item-${photo.id}`}>
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
                    <TrashIcon size={18} color={colors.ink} weight="bold" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.captionSection}>
                <View style={styles.pencilWrapper}>
                  <PencilSimpleIcon size={14} color={colors.inkMuted} />
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
                    placeholderTextColor={colors.inkMuted}
                    multiline
                    maxLength={200}
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
                  <Text style={styles.savingLabel}>đang lưu...</Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headerBtn:    { width: 36, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title:        { ...typography.title, color: colors.ink },
  photoCount:   { ...typography.caption, color: colors.inkMuted, marginTop: 2 },

  list: { padding: spacing.lg, gap: spacing.lg },

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    ...shadows.card,
  },

  imageContainer: { width: '100%', height: IMAGE_HEIGHT },
  image:          { width: '100%', height: '100%' },

  deleteOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  pencilWrapper: { marginTop: 2 },
  noteInput: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  noteReadOnly: { ...typography.body, color: colors.ink, flex: 1 },
  noteEmpty:    { color: colors.inkMuted, fontStyle: 'italic' },
  savingLabel:  { ...typography.caption, color: colors.inkMuted, alignSelf: 'center' },
});
