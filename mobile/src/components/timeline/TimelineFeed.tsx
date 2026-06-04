import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTimeline } from '@/hooks/useTimeline';
import { useDayLabelsRange } from '@/hooks/useDayLabels';
import { MasonryBlock, MasonryBlockData, distributeMasonry } from './MasonryBlock';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { colors, spacing, typography } from '@/constants/theme';
import { formatVnDayLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toDateKey, addDays } from '@/lib/dateKey';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const H_PADDING = 6;
const COL_GAP = 4;

interface FlatListItem {
  type: 'dayHeader' | 'masonryBlock';
  key: string;
  label?: string;       // formatted date string
  dateKey?: string;     // YYYY-MM-DD for label lookup
  block?: MasonryBlockData;
}

interface TimelineFeedProps {
  onJumpToDay?: (dateKey: string) => void;
}

export function TimelineFeed({ onJumpToDay }: TimelineFeedProps = {}) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } =
    useTimeline();
  const { width: screenWidth } = useWindowDimensions();
  const columnWidth = (screenWidth - H_PADDING * 2 - COL_GAP) / 2;

  const today = toDateKey(new Date());
  const from = addDays(today, -365);
  const { data: labelsData = [] } = useDayLabelsRange(from, today);
  const labelByDate = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of labelsData) m.set(l.date, l.label);
    return m;
  }, [labelsData]);

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelinePhoto[] = data.pages.flatMap((p) => p.items).filter((it: any) => it.type === 'photo');
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
      const dateStr = item.taken_at;
      const dayKey = dateStr.slice(0, 10);

      if (dayKey !== currentDay) {
        if (currentDay) flushPhotos(currentDay, photoBuffer[0]?.id ?? 'end');
        currentDay = dayKey;
        result.push({ type: 'dayHeader', key: `day-${dayKey}`, label: formatVnDayLabel(dateStr), dateKey: dayKey });
      }

      photoBuffer.push(item);
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
          const customLabel = item.dateKey ? labelByDate.get(item.dateKey) : undefined;
          const inner = (
            <>
              {customLabel ? (
                <>
                  <Text style={styles.dayHeaderLabel}>{customLabel}</Text>
                  <Text style={styles.dayHeaderDate}>{item.label}</Text>
                </>
              ) : (
                <Text style={styles.dayHeader}>{item.label}</Text>
              )}
            </>
          );
          return (
            <TouchableOpacity
              style={styles.dayHeaderContainer}
              testID={`day-heading-${item.dateKey}`}
              onPress={() => item.dateKey && onJumpToDay?.(item.dateKey)}
              disabled={!onJumpToDay}
              activeOpacity={onJumpToDay ? 0.6 : 1}
            >
              {inner}
            </TouchableOpacity>
          );
        }
        return <MasonryBlock block={item.block!} columnWidth={columnWidth} />;
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
  dayHeaderContainer: {
    paddingHorizontal: 2,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  dayHeaderLabel: {
    ...typography.title,
    color: colors.ink,
    fontWeight: '700',
  },
  dayHeaderDate: {
    ...typography.bodySmall,
    color: colors.inkMuted,
    marginTop: 2,
  },
});
