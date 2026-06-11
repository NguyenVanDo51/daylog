import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { DotsThree, PlusCircle, Camera, CaretRight } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAlbums, Album } from '@/hooks/useAlbums';
import { useAlbumStore } from '@/stores/albumStore';
import { SettingsSheet } from './SettingsSheet';
import { api } from '@/lib/api';
import { theme, colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { Avatar } from '@/components/ui/Avatar';

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
      Alert.alert(t('common.error'), t('albums.create_error'));
    } finally {
      setCreating(false);
    }
  }

  const sorted = albums
    ? [...albums.filter((a) => a.is_private), ...albums.filter((a) => !a.is_private)]
    : [];

  const SWATCHES = theme.colors.swatch;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal visible={showInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <StickerCard shadow="heavy" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('albums.new_album')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('albums.rename_ph')}
              placeholderTextColor={theme.colors.textMuted}
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
          </StickerCard>
        </View>
      </Modal>

      <View style={styles.header}>
        <Mascot size={24} tilt="playful" flip />
        <Text style={styles.heading}>Nhật ký</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} testID="menu-btn">
          <DotsThree size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Mascot size={80} tilt="default" />
          <Text style={styles.empty}>{t('albums.empty')}</Text>
          <StickerButton
            label={t('albums.empty_cta')}
            variant="primary"
            onPress={() => { setNewName(''); setShowInput(true); }}
            testID="create-album-empty-btn"
          />
        </View>
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
              <PlusCircle size={20} color={theme.colors.primary} />
              <Text style={styles.createBtnText}>{t('albums.new_album')}</Text>
            </TouchableOpacity>
          }
          renderItem={({ item, index }) => (
            <StickerCard
              tilt="subtle"
              flip={index % 2 === 1}
              style={styles.row}
              testID={`album-row-${item.id}`}
            >
              <TouchableOpacity
                onPress={() => handleAlbumPress(item)}
                activeOpacity={0.85}
                style={styles.rowInner}
              >
                <Avatar
                  size={48}
                  src={item.cover_thumb_url ?? null}
                  bgColor={(['accent1','accent2','accent3','accent4'] as const)[index % 4]}
                />
                <View style={styles.rowInfo}>
                  <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
                </View>
                {typeof (item as any).photo_count === 'number' && (
                  <StickerChip
                    label={String((item as any).photo_count)}
                    variant="yellow"
                    tilt="default"
                    flip
                  />
                )}
                <CaretRight size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </StickerCard>
          )}
        />
      )}

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + spacing.lg }]}>
        <StickerButton
          label="Chụp ảnh"
          variant="primary"
          shadow="heavy"
          icon={<Camera size={18} color={theme.colors.textOnPrimary} weight="fill" />}
          onPress={onCameraPress}
          testID="camera-pill-btn"
        />
      </View>

      <SettingsSheet visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: theme.colors.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.lg },
  heading:         { ...typography.displayCute, flex: 1 },
  menuBtn:         { padding: spacing.sm },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing['3xl'] },
  empty:           { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center' },
  list:            { paddingHorizontal: spacing['2xl'], gap: spacing.md, paddingBottom: spacing['2xl'] },
  row:             { marginBottom: spacing.sm },
  rowInner:        { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, minHeight: 64 },
  rowInfo:         { flex: 1 },
  albumName:       { ...typography.title, color: theme.colors.textPrimary },
  bottomArea:      { alignItems: 'center', paddingTop: spacing.md },
  createBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  createBtnText:   { ...typography.body, color: theme.colors.primary },
  modalOverlay:    { flex: 1, backgroundColor: theme.overlays.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] },
  modalCard:       { width: '100%', padding: spacing['2xl'], gap: spacing.lg },
  modalTitle:      { ...typography.title, color: theme.colors.textPrimary },
  input:           { ...typography.body, color: theme.colors.textPrimary, borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:        { padding: spacing.sm },
  modalBtnCancel:  { ...typography.body, color: theme.colors.textMuted },
  modalBtnConfirm: { ...typography.body, color: theme.colors.primary },
});
