import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { DotsThree, PlusCircle, Images, CaretRight, Camera } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAlbums, Album } from '@/hooks/useAlbums';
import { useAlbumStore } from '@/stores/albumStore';
import { SettingsSheet } from './SettingsSheet';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Props {
  onCameraPress: () => void;
}

export function AlbumsPage({ onCameraPress }: Props) {
  const insets = useSafeAreaInsets();
  const { data: albums, isLoading } = useAlbums();
  const setAlbum = useAlbumStore((s) => s.setAlbum);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  function handleAlbumPress(album: Album) {
    setAlbum(album);
    router.push(`/albums/${album.id}`);
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
        <Text style={styles.heading}>Nhật ký</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} testID="menu-btn">
          <DotsThree size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : sorted.length === 0 ? (
        <Text style={styles.empty}>{t('albums.empty')}</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => { setNewName(''); setShowInput(true); }}
              testID="create-album-btn"
            >
              <PlusCircle size={20} color={colors.pink} />
              <Text style={styles.createBtnText}>Tạo album mới</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleAlbumPress(item)}
              activeOpacity={0.75}
              testID={`album-row-${item.id}`}
            >
              {item.cover_photo_id ? (
                <Image
                  source={{ uri: `${API_URL}/photos/${item.cover_photo_id}/thumb` }}
                  style={styles.thumb}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Images size={22} color={colors.inkMuted} />
                </View>
              )}
              <View style={styles.rowInfo}>
                <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
              </View>
              <CaretRight size={18} color={colors.inkMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity
          testID="camera-pill-btn"
          style={styles.cameraPill}
          onPress={onCameraPress}
          activeOpacity={0.85}
        >
          <Camera size={18} color={colors.white} weight="fill" />
          <Text style={styles.cameraPillText}>Chụp ảnh</Text>
        </TouchableOpacity>
      </View>

      <SettingsSheet visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['2xl'], paddingVertical: spacing.lg },
  heading:         { ...typography.heading, color: colors.ink },
  menuBtn:         { padding: spacing.sm },
  empty:           { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing['4xl'] },
  list:            { paddingHorizontal: spacing['2xl'], gap: spacing.md, paddingBottom: spacing['2xl'] },
  row:             { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, gap: spacing.md, minHeight: 72 },
  thumb:           { width: 56, height: 56, borderRadius: 8, overflow: 'hidden' },
  thumbPlaceholder:{ backgroundColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  rowInfo:         { flex: 1 },
  albumName:       { ...typography.body, color: colors.ink, fontWeight: '600' },
  bottomArea:      { alignItems: 'center', paddingTop: spacing.md },
  cameraPill:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.pink, borderRadius: 9999, borderWidth: 2, borderColor: colors.ink, shadowColor: colors.ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4, paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'] },
  cameraPillText:  { fontFamily: 'Caveat_600SemiBold', fontSize: 18, color: colors.white },
  createBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  createBtnText:   { ...typography.body, color: colors.pink },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard:       { backgroundColor: colors.white, borderRadius: 16, padding: spacing['2xl'], width: '80%', gap: spacing.lg },
  modalTitle:      { ...typography.title, color: colors.ink },
  input:           { ...typography.body, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:        { padding: spacing.sm },
  modalBtnCancel:  { ...typography.body, color: colors.inkMuted },
  modalBtnConfirm: { ...typography.body, color: colors.pink },
});
