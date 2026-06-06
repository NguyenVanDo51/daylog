import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlbums, Album } from '@/hooks/useAlbums';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function AlbumsScreen() {
  const insets = useSafeAreaInsets();
  const { data: albums, isLoading } = useAlbums();
  const setAlbum = useAlbumStore((s) => s.setAlbum);

  function handleAlbumPress(album: Album) {
    setAlbum(album);
    router.push(`/albums/${album.id}`);
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
      <Text style={styles.heading}>{t('albums.title')}</Text>
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
  heading:   { ...typography.heading, color: colors.ink, padding: spacing['2xl'], paddingBottom: spacing.lg },
  empty:     { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing['4xl'] },
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
