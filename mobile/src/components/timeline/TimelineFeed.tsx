import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, View } from 'react-native';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { MonthHeader } from './MonthHeader';
import { PhotoRow } from './PhotoRow';
import { PolaroidCard } from './PolaroidCard';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { colors, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { formatVnMonth, formatVnAge } from '@/lib/format';
import { t } from '@/lib/i18n';

function getMonthLabel(isoDate: string, birthdate: string | null): string {
  const d = new Date(isoDate);
  const month = formatVnMonth(d);
  if (!birthdate) return `${month} · ${d.getFullYear()}`;
  return `${month} · ${formatVnAge(birthdate, d)}`;
}

interface FlatListItem {
  type: 'month' | 'photoRow' | 'polaroid' | 'milestone';
  key: string;
  label?: string;
  photos?: any[];
  photo?: any;
  milestone?: any;
  index?: number;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } = useTimeline();

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentMonth = '';
    let photoBuffer: any[] = [];
    let rowIndex = 0;

    const flushPhotos = () => {
      while (photoBuffer.length > 0) {
        const batch = photoBuffer.splice(0, 2);
        result.push({ type: 'photoRow', key: `row-${batch[0].id}`, photos: batch, index: rowIndex });
        rowIndex++;
      }
    };

    let mIdx = 0;
    for (const item of allItems) {
      const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
      const monthKey = dateStr.slice(0, 7);
      if (monthKey !== currentMonth) {
        flushPhotos();
        currentMonth = monthKey;
        result.push({ type: 'month', key: `month-${monthKey}`, label: getMonthLabel(dateStr, childBirthdate) });
      }
      if (item.type === 'photo') {
        if ((item as any).source === 'capture') {
          flushPhotos();
          result.push({ type: 'polaroid', key: `polaroid-${item.id}`, photo: item });
        } else {
          photoBuffer.push(item);
          if (photoBuffer.length >= 2) flushPhotos();
        }
      } else {
        flushPhotos();
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item, index: mIdx++ });
      }
    }
    flushPhotos();
    return result;
  }, [data, childBirthdate]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.skel}>
        <SkeletonRow rowIndex={0} />
        <SkeletonRow rowIndex={1} />
        <SkeletonRow rowIndex={2} />
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
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pink} />}
      renderItem={({ item }) => {
        if (item.type === 'month') return <MonthHeader label={item.label!} />;
        if (item.type === 'photoRow') return <PhotoRow photos={item.photos!} rowIndex={item.index} />;
        if (item.type === 'polaroid') return <PolaroidCard photo={item.photo!} />;
        return (
          <MilestoneCard
            title={item.milestone.title}
            note={item.milestone.note}
            occurredAt={item.milestone.occurred_at}
            index={item.index}
            onPress={() => router.push(`/milestone/${item.milestone.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'] },
  skel:    { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg },
});
