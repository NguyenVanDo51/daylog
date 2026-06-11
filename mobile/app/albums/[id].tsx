import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
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
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

export default function AlbumScreen() {
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
      Alert.alert(t('common.error'), t('albums.rename_error'));
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
              Alert.alert(t('common.error'), t('albums.archive_error'));
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
              Alert.alert(t('common.error'), t('albums.delete_error'));
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
              Alert.alert(t('common.error'), t('albums.leave_error'));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Modal visible={renameOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <StickerCard shadow="heavy" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('album_menu.rename_title')}</Text>
            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRenameConfirm} disabled={renaming} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{renaming ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </StickerCard>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <DotsThree size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
      </View>

      {isArchived && (
        <View style={styles.archivedWrap}>
          <StickerChip
            label={t('album_menu.archived_banner')}
            variant="ink"
            icon={<Archive size={12} color={theme.colors.accent1} />}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : !days || days.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Mascot size={80} tilt="default" />
          <Text style={styles.empty}>{t('albums.day_grid_empty')}</Text>
          <Text style={styles.emptySub}>{t('albums.day_grid_empty_hint')}</Text>
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
                index={index * 2}
                onPress={() => router.push(`/story/${albumId}/${left.date}`)}
              />
              {right && (
                <DayCell
                  date={right.date}
                  thumbnailUrl={right.thumb_url}
                  hasVideo={right.has_video}
                  tall={index % 2 !== 0}
                  index={index * 2 + 1}
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
  container:       { flex: 1, backgroundColor: theme.colors.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', padding: 0 },
  title:           { ...typography.title, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  archivedWrap:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, alignItems: 'flex-start' },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing['3xl'] },
  empty:           { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', fontFamily: theme.fonts.semiBold },
  emptySub:        { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  grid:            { padding: spacing['2xl'], gap: spacing.md },
  row:             { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  modalOverlay:    { flex: 1, backgroundColor: theme.overlays.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] },
  modalCard:       { width: '100%', padding: spacing['2xl'], gap: spacing.lg },
  modalTitle:      { ...typography.title, color: theme.colors.textPrimary },
  input:           { ...typography.body, color: theme.colors.textPrimary, borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:        { padding: spacing.sm },
  modalBtnCancel:  { ...typography.body, color: theme.colors.textMuted },
  modalBtnConfirm: { ...typography.body, color: theme.colors.primary },
});
