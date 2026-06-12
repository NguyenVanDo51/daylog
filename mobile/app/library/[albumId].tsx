import React, { useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlbumPhotos, LibraryPhoto } from '@/hooks/useAlbumPhotos';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ThumbnailCell, COLS, getColWidth } from '@/components/library/ThumbnailCell';
import { DayHeader } from '@/components/library/DayHeader';
import { PhotoEditSheet } from '@/components/library/PhotoEditSheet';
import { theme, spacing, typography } from '@/constants/theme';

interface Row {
  photos: LibraryPhoto[];
  startIndex: number; // running index across the album for alternating flip
}

interface Section {
  date: string;
  photoCount: number;
  data: Row[];
}

export default function LibraryScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { data, isLoading } = useAlbumPhotos(albumId ?? null);
  const [selected, setSelected] = useState<LibraryPhoto | null>(null);
  const colWidth = getColWidth(screenW);

  const sections: Section[] = useMemo(() => {
    let running = 0;
    return (data ?? []).map((day) => {
      const rows: Row[] = [];
      for (let i = 0; i < day.photos.length; i += COLS) {
        rows.push({ photos: day.photos.slice(i, i + COLS), startIndex: running });
        running += COLS;
      }
      return { date: day.date, photoCount: day.photos.length, data: rows };
    });
  }, [data]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader
        onBack={() => router.back()}
        backTestID="library-back"
        title="Kho ảnh"
      />

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.textPrimary} />
        </View>
      )}

      {!isLoading && sections.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Album chưa có ảnh nào</Text>
        </View>
      )}

      {!isLoading && sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(row, idx) => `${row.photos[0]?.id ?? 'empty'}-${idx}`}
          renderSectionHeader={({ section }) => (
            <DayHeader date={section.date} photoCount={section.photoCount} />
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.photos.map((p, i) => (
                <ThumbnailCell
                  key={p.id}
                  photo={p}
                  index={item.startIndex + i}
                  onPress={() => setSelected(p)}
                />
              ))}
              {item.photos.length < COLS &&
                Array.from({ length: COLS - item.photos.length }).map((_, i) => (
                  <View key={`fill-${i}`} style={{ width: colWidth }} />
                ))}
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          testID="library-list"
        />
      )}

      <PhotoEditSheet
        albumId={albumId!}
        photo={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.body, color: theme.colors.textMuted },
  listContent: { paddingBottom: spacing['2xl'] },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
  },
});
