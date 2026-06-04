import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, View, Text, useWindowDimensions } from 'react-native';
import { useTimeline, TimelineItem, TimelineMilestone } from '@/hooks/useTimeline';
import { MasonryBlock, MasonryBlockData, distributeMasonry } from './MasonryBlock';
import { MilestoneRow } from './MilestoneRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { colors, spacing, typography } from '@/constants/theme';
import { formatVnDayLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const H_PADDING = 6;
const COL_GAP = 4;

interface FlatListItem {
  type: 'dayHeader' | 'masonryBlock' | 'milestone';
  key: string;
  label?: string;
  block?: MasonryBlockData;
  milestone?: TimelineMilestone;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } =
    useTimeline();
  const { width: screenWidth } = useWindowDimensions();
  const columnWidth = (screenWidth - H_PADDING * 2 - COL_GAP) / 2;

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentDay = '';
    let photoBuffer: TimelinePhoto[] = [];

    const flushPhotos = (dayKey: string, anchorId: string) => {
      if (photoBuffer.length === 0) return;
      const block = distributeMasonry(photoBuffer, columnWidth);
      result.push({ type: 'masonryBlock', key: `masonry-${dayKey}-${anchorId}`, block });
      photoBuffer = [];
    };

    for (const item of allItems) {
      const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
      const dayKey = dateStr.slice(0, 10);

      if (dayKey !== currentDay) {
        if (currentDay) flushPhotos(currentDay, photoBuffer[0]?.id ?? 'end');
        currentDay = dayKey;
        result.push({ type: 'dayHeader', key: `day-${dayKey}`, label: formatVnDayLabel(dateStr) });
      }

      if (item.type === 'photo') {
        photoBuffer.push(item as TimelinePhoto);
      } else {
        flushPhotos(dayKey, item.id);
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item as TimelineMilestone });
      }
    }
    if (photoBuffer.length > 0) flushPhotos(currentDay, photoBuffer[0].id);

    return result;
  }, [data, columnWidth]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.skel}>
        <SkeletonRow rowIndex={0} />
        <SkeletonRow rowIndex={1} />
      </View>
    );
  }
  if (!items.length) return <EmptyState emoji="🌸" message={t('home.empty_message')} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.content}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pink} />
      }
      renderItem={({ item }) => {
        if (item.type === 'dayHeader') {
          return (
            <Text style={styles.dayHeader} testID={`day-header-${item.key}`}>
              {item.label}
            </Text>
          );
        }
        if (item.type === 'masonryBlock') {
          return <MasonryBlock block={item.block!} columnWidth={columnWidth} />;
        }
        return <MilestoneRow milestone={item.milestone!} />;
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: H_PADDING, paddingBottom: spacing['4xl'] },
  skel: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg },
  dayHeader: {
    ...typography.bodySmall,
    color: colors.pink,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 2,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
});
