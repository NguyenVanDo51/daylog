import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAlbums, Album } from '@/hooks/useAlbums';
import { useAlbumStore } from '@/stores/albumStore';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function AlbumsScreen() {
  const insets = useSafeAreaInsets();
  const { data: albums, isLoading } = useAlbums();
  const setAlbum = useAlbumStore((s) => s.setAlbum);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);

  function handleAlbumPress(album: Album) {
    setAlbum(album);
    router.push(`/albums/${album.id}`);
  }

  function openNewAlbum() {
    setNewName('');
    setShowInput(true);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post('/albums', { name });
      setShowInput(false);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      setAlbum(data);
      router.push(`/albums/${data.id}`);
    } catch {
      Alert.alert(t('common.error'), 'Không thể tạo album.');
    } finally {
      setCreating(false);
    }
  }

  const sorted = albums
    ? [...albums.filter((a) => a.is_private), ...albums.filter((a) => !a.is_private)]
    : [];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal visible={showInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('albums.new_album')}</Text>
            <TextInput
              style={styles.input}
              placeholder="Tên album..."
              placeholderTextColor={colors.inkMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowInput(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={creating} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{creating ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.heading}>{t('albums.title')}</Text>
        <TouchableOpacity onPress={openNewAlbum} style={styles.addBtn} testID="add-album-btn">
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>{t('albums.empty')}</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleAlbumPress(item)}
              activeOpacity={0.75}
            >
              <Text style={styles.albumName}>{item.name}</Text>
              {item.is_private && (
                <Text style={styles.badge}>{t('albums.private')}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center:    { alignItems: 'center', justifyContent: 'center' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: spacing['2xl'] },
  heading:   { ...typography.heading, color: colors.ink, padding: spacing['2xl'], paddingBottom: spacing.lg },
  addBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: colors.white, fontSize: 24, lineHeight: 28, fontFamily: 'Fredoka_400Regular' },
  empty:     { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing['4xl'] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard:    { backgroundColor: colors.white, borderRadius: 16, padding: spacing['2xl'], width: '80%', gap: spacing.lg },
  modalTitle:   { ...typography.title, color: colors.ink },
  input:        { ...typography.body, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:     { padding: spacing.sm },
  modalBtnCancel:  { ...typography.body, color: colors.inkMuted },
  modalBtnConfirm: { ...typography.body, color: colors.pink },
  list:      { paddingHorizontal: spacing['2xl'], gap: spacing.md },
  row: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  albumName: { ...typography.body, color: colors.ink },
  badge: {
    ...typography.caption,
    color: colors.inkMuted,
    backgroundColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
