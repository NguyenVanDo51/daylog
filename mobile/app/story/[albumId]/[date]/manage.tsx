import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function ManageScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();
  const { data: serverPhotos } = useDayPhotos(albumId ?? null, date ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const deletePhoto = useDeletePhoto(albumId!, date!);
  const updateCaption = useUpdateCaption(albumId!, date!);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});

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
    try {
      await updateCaption.mutateAsync({ photoId: photo.id, caption: captionToSave });
    } catch {
      Alert.alert('', t('manage.save_error'));
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('manage.title', { date: dateLabel })}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: photo }) => {
          const isOwner = photo.uploaded_by === currentUserId;
          return (
            <View style={styles.item} testID={`manage-item-${photo.id}`}>
              <Image
                source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
                style={styles.thumb}
              />
              <View style={styles.itemContent}>
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
                  <Text testID={`note-readonly-${photo.id}`} style={styles.noteReadOnly}>
                    {photo.caption ?? ''}
                  </Text>
                )}
              </View>
              {isOwner && (
                <TouchableOpacity
                  testID={`delete-${photo.id}`}
                  onPress={() => handleDelete(photo, photos.length)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.inkMuted} />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  backBtn:      { width: 32 },
  title:        { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  list:         { padding: spacing.lg, gap: spacing.md },
  item:         { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.white, borderRadius: 10, padding: spacing.md },
  thumb:        { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.borderSoft },
  itemContent:  { flex: 1 },
  noteInput:    { ...typography.body, color: colors.ink, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 48, textAlignVertical: 'top' },
  noteReadOnly: { ...typography.body, color: colors.inkMuted },
  deleteBtn:    { alignSelf: 'center' },
});
