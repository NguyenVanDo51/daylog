import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, DotsThree, Archive } from 'phosphor-react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { DayCell } from '@/components/album/DayCell';
import { useAlbumDays, AlbumDay } from '@/hooks/useAlbumDays';
import { useAlbumStore } from '@/stores/albumStore';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
import { InviteSheet } from '@/components/family/InviteSheet';
import { MembersSheet } from '@/components/family/MembersSheet';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albumId    = useAlbumStore((s) => s.albumId);
  const albumName  = useAlbumStore((s) => s.albumName);
  const archivedAt = useAlbumStore((s) => s.archivedAt);
  const setAlbumName  = useAlbumStore((s) => s.setAlbumName);
  const setArchivedAt = useAlbumStore((s) => s.setArchivedAt);
  const { data: days, isLoading } = useAlbumDays(albumId ?? null);
  const qc = useQueryClient();

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [renameOpen,  setRenameOpen]  = useState(false);
  const [renameText,  setRenameText]  = useState('');
  const [renaming,    setRenaming]    = useState(false);

  const isArchived = archivedAt !== null;

  const pairs: Array<[AlbumDay, AlbumDay | undefined]> = [];
  if (days) {
    for (let i = 0; i < days.length; i += 2) {
      pairs.push([days[i], days[i + 1]]);
    }
  }

  async function handleRenameConfirm() {
    const name = renameText.trim();
    if (!name || !albumId) return;
    setRenaming(true);
    try {
      await api.patch(`/albums/${albumId}`, { name });
      setAlbumName(name);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      setRenameOpen(false);
    } catch {
      Alert.alert(t('common.error'), 'Không thể đổi tên album.');
    } finally {
      setRenaming(false);
    }
  }

  function handleArchivePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.archive'),
      t('album_menu.archive_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.archive'),
          onPress: async () => {
            try {
              const { data } = await api.post(`/albums/${albumId}/archive`);
              setArchivedAt(data.archived_at);
              await qc.invalidateQueries({ queryKey: ['albums'] });
            } catch {
              Alert.alert(t('common.error'), 'Không thể lưu trữ album.');
            }
          },
        },
      ]
    );
  }

  function handleDeletePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.delete_album'),
      t('album_menu.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.delete_album'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/albums/${albumId}`);
              await qc.invalidateQueries({ queryKey: ['albums'] });
              router.back();
            } catch {
              Alert.alert(t('common.error'), 'Không thể xóa album.');
            }
          },
        },
      ]
    );
  }

  function handleLeavePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.leave_album'),
      t('album_menu.leave_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.leave_album'),
          onPress: async () => {
            try {
              await api.delete(`/albums/${albumId}/members/me`);
              await qc.invalidateQueries({ queryKey: ['albums'] });
              router.back();
            } catch {
              Alert.alert(t('common.error'), 'Không thể rời album.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal visible={renameOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('album_menu.rename_title')}</Text>
            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRenameConfirm} disabled={renaming} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{renaming ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <CaretLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.backBtn}>
          <DotsThree size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {isArchived && (
        <View style={styles.archivedBanner}>
          <Archive size={14} color={colors.inkMuted} />
          <Text style={styles.archivedText}>{t('album_menu.archived_banner')}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : !days || days.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Chưa có khoảnh khắc nào</Text>
          <Text style={styles.emptySub}>Vuốt sang tab Camera để chụp ảnh đầu tiên</Text>
        </View>
      ) : (
        <FlatList
          data={pairs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.grid}
          renderItem={({ item: [left, right], index }) => (
            <View style={styles.row}>
              <DayCell
                date={left.date}
                thumbnailUrl={left.thumb_url}
                hasVideo={left.has_video}
                tall={index % 2 === 0}
                onPress={() => router.push(`/story/${albumId}/${left.date}`)}
              />
              {right && (
                <DayCell
                  date={right.date}
                  thumbnailUrl={right.thumb_url}
                  hasVideo={right.has_video}
                  tall={index % 2 !== 0}
                  onPress={() => router.push(`/story/${albumId}/${right.date}`)}
                />
              )}
            </View>
          )}
        />
      )}

      <AlbumMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenMembers={() => { setMenuOpen(false); setMembersOpen(true); }}
        onOpenInvite={() =>  { setMenuOpen(false); setInviteOpen(true); }}
        onRename={() => {
          setMenuOpen(false);
          setRenameText(albumName ?? '');
          setRenameOpen(true);
        }}
        onArchive={handleArchivePress}
        onDelete={handleDeletePress}
        onLeave={handleLeavePress}
      />
      <InviteSheet  visible={inviteOpen}  onClose={() => setInviteOpen(false)} />
      <MembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.cream },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  backBtn:         { width: 32 },
  title:           { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  archivedBanner:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.borderSoft },
  archivedText:    { ...typography.caption, color: colors.inkMuted },
  empty:           { ...typography.body, color: colors.inkMuted },
  emptySub:        { ...typography.caption, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
  grid:            { padding: spacing['2xl'], gap: spacing.sm },
  row:             { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard:       { backgroundColor: colors.white, borderRadius: 16, padding: spacing['2xl'], width: '80%', gap: spacing.lg },
  modalTitle:      { ...typography.title, color: colors.ink },
  input:           { ...typography.body, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:        { padding: spacing.sm },
  modalBtnCancel:  { ...typography.body, color: colors.inkMuted },
  modalBtnConfirm: { ...typography.body, color: colors.pink },
});
