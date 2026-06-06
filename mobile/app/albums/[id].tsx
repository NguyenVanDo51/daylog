import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { InviteSheet } from '@/components/family/InviteSheet';
import { useUploadSheetStore } from '@/stores/uploadSheetStore';
import { useAlbumStore } from '@/stores/albumStore';
import { tap } from '@/lib/haptics';
import { colors, shadows, spacing, typography } from '@/constants/theme';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const openUpload = useUploadSheetStore((s) => s.open);
  const albumName = useAlbumStore((s) => s.albumName);
  const isPrivate = useAlbumStore((s) => s.isPrivate);
  const [inviteVisible, setInviteVisible] = useState(false);

  function handleFab() {
    tap();
    openUpload();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        {isPrivate === false ? (
          <TouchableOpacity onPress={() => setInviteVisible(true)} hitSlop={8} style={styles.inviteBtn} testID="invite-btn">
            <Ionicons name="person-add-outline" size={22} color={colors.ink} />
          </TouchableOpacity>
        ) : (
          <View style={styles.inviteBtn} />
        )}
      </View>

      <TimelineFeed onJumpToDay={() => {}} />

      <TouchableOpacity
        testID="timeline-upload-fab"
        onPress={handleFab}
        activeOpacity={0.85}
        style={[styles.fabWrap, { bottom: spacing['2xl'] + insets.bottom }]}
      >
        <LinearGradient
          colors={[colors.peach, colors.pink]}
          style={styles.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={26} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn:   { width: 32 },
  title:     { ...typography.title, color: colors.ink, flex: 1, textAlign: 'center' },
  inviteBtn: { width: 32, alignItems: 'flex-end' },
  fabWrap: {
    position: 'absolute',
    right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.fab,
  },
  fab: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
});
