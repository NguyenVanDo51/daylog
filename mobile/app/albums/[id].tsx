import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, DotsThree } from 'phosphor-react-native';
import { router } from 'expo-router';
import { DayCell } from '@/components/album/DayCell';
import { useAlbumDays, AlbumDay } from '@/hooks/useAlbumDays';
import { useAlbumStore } from '@/stores/albumStore';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
import { InviteSheet } from '@/components/family/InviteSheet';
import { QRSheet } from '@/components/family/QRSheet';
import { MembersSheet } from '@/components/family/MembersSheet';
import { colors, spacing, typography } from '@/constants/theme';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albumId = useAlbumStore((s) => s.albumId);
  const albumName = useAlbumStore((s) => s.albumName);
  const { data: days, isLoading } = useAlbumDays(albumId ?? null);

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [qrOpen,      setQrOpen]      = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  // Build pairs for 2-column masonry layout
  const pairs: Array<[AlbumDay, AlbumDay | undefined]> = [];
  if (days) {
    for (let i = 0; i < days.length; i += 2) {
      pairs.push([days[i], days[i + 1]]);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <CaretLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.backBtn}>
          <DotsThree size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>

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
                thumbnailPhotoId={left.thumbnail_photo_id}
                hasVideo={left.has_video}
                tall={index % 2 === 0}
                onPress={() => router.push(`/story/${albumId}/${left.date}`)}
              />
              {right && (
                <DayCell
                  date={right.date}
                  thumbnailPhotoId={right.thumbnail_photo_id}
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
        onOpenQR={() =>      { setMenuOpen(false); setQrOpen(true); }}
      />
      <InviteSheet  visible={inviteOpen}  onClose={() => setInviteOpen(false)} />
      <QRSheet      visible={qrOpen}      onClose={() => setQrOpen(false)} />
      <MembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  backBtn:   { width: 32 },
  title:     { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  empty:     { ...typography.body, color: colors.inkMuted },
  emptySub:  { ...typography.caption, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
  grid:      { padding: spacing['2xl'], gap: spacing.sm },
  row:       { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
