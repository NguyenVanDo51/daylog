import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { MonthHeader } from './MonthHeader';
import { PhotoRow } from './PhotoRow';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, spacing } from '@/constants/theme';
import { router } from 'expo-router';

function getMonthLabel(isoDate: string, birthdate: string | null): string {
  const d = new Date(isoDate);
  const month = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const year = d.getFullYear();
  if (!birthdate) return `${month} · ${year}`;
  const birth = new Date(birthdate);
  const months = (d.getFullYear() - birth.getFullYear()) * 12 + d.getMonth() - birth.getMonth();
  return `${month} · ${months} MONTHS`;
}

interface FlatListItem {
  type: 'month' | 'photoRow' | 'milestone';
  key: string;
  label?: string;
  photos?: any[];
  milestone?: any;
}

export function TimelineFeed({ childBirthdate }: { childBirthdate: string | null }) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } = useTimeline();

  const items = React.useMemo<FlatListItem[]>(() => {
    if (!data) return [];
    const allItems: TimelineItem[] = data.pages.flatMap((p) => p.items);
    const result: FlatListItem[] = [];
    let currentMonth = '';
    let photoBuffer: any[] = [];

    const flushPhotos = () => {
      while (photoBuffer.length > 0) {
        const batch = photoBuffer.splice(0, photoBuffer.length >= 3 ? 3 : 2);
        result.push({ type: 'photoRow', key: `row-${batch[0].id}`, photos: batch });
      }
    };

    for (const item of allItems) {
      const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
      const monthKey = dateStr.slice(0, 7);
      if (monthKey !== currentMonth) {
        flushPhotos();
        currentMonth = monthKey;
        result.push({ type: 'month', key: `month-${monthKey}`, label: getMonthLabel(dateStr, childBirthdate) });
      }
      if (item.type === 'photo') {
        photoBuffer.push(item);
        if (photoBuffer.length >= 3) flushPhotos();
      } else {
        flushPhotos();
        result.push({ type: 'milestone', key: `ms-${item.id}`, milestone: item });
      }
    }
    flushPhotos();
    return result;
  }, [data, childBirthdate]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <LoadingSpinner />;
  if (!items.length) return <EmptyState emoji="🌸" message="No photos yet! Tap ➕ to add your first memory." />;

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
        if (item.type === 'photoRow') return <PhotoRow photos={item.photos!} />;
        return (
          <MilestoneCard
            title={item.milestone.title}
            note={item.milestone.note}
            occurredAt={item.milestone.occurred_at}
            onPress={() => router.push(`/milestone/${item.milestone.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'] },
});
