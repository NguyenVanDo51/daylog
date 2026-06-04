import React, { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { DayPage } from './DayPage';
import { MilestoneLabelInput } from './MilestoneLabelInput';
import { useTimeline } from '@/hooks/useTimeline';
import type { TimelinePage, TimelinePhoto } from '@/hooks/useTimeline';
import { useDayLabelsRange, useUpsertDayLabel, useDeleteDayLabel } from '@/hooks/useDayLabels';
import { toDateKey, addDays, isFuture } from '@/lib/dateKey';
import { useCaptureStore, getCooldownRemaining } from '@/stores/captureStore';
import { t } from '@/lib/i18n';

interface Props {
  initialDateKey?: string;
}

export function DayPager({ initialDateKey }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey ?? toDateKey(new Date()));
  const [labelSheetOpen, setLabelSheetOpen] = useState(false);

  const { data: timeline } = useTimeline();

  // 60-day window around current date for label prefetch.
  const fromKey = addDays(dateKey, -30);
  const toKey = addDays(dateKey, 30);
  const { data: labels = [] } = useDayLabelsRange(fromKey, toKey);
  const upsert = useUpsertDayLabel();
  const remove = useDeleteDayLabel();

  const photosForDay = useMemo<TimelinePhoto[]>(() => {
    if (!timeline) return [];
    return timeline.pages
      .flatMap((p: TimelinePage) => p.items)
      .filter((it: any) => it.type === 'photo' && typeof it.taken_at === 'string' && it.taken_at.slice(0, 10) === dateKey)
      .map((it: any) => it as TimelinePhoto);
  }, [timeline, dateKey]);

  const currentLabel = useMemo(() => {
    return labels.find((l) => l.date === dateKey)?.label ?? null;
  }, [labels, dateKey]);

  const goPrev = useCallback(() => setDateKey((k) => addDays(k, -1)), []);
  const goNext = useCallback(() => setDateKey((k) => {
    const next = addDays(k, 1);
    return isFuture(next) ? k : next;
  }), []);

  const handleCamera = useCallback(() => {
    const { lastCaptureAt } = useCaptureStore.getState();
    const remaining = getCooldownRemaining(lastCaptureAt);
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      Alert.alert(
        t('capture.cooldown_title'),
        t('capture.cooldown_body', { minutes: mins }),
        [
          { text: t('capture.cancel'), style: 'cancel' },
          {
            text: t('capture.cooldown_fallback'),
            onPress: () => {},
          },
        ]
      );
      return;
    }
    router.push('/capture');
  }, []);

  const handleUpload = useCallback(() => {
    router.push({ pathname: '/(tabs)/upload', params: { targetDate: dateKey } });
  }, [dateKey]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((e) => {
          if (e.translationX < -50) runOnJS(goNext)();
          else if (e.translationX > 50) runOnJS(goPrev)();
        }),
    [goNext, goPrev]
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.root}>
          <DayPage
            dateKey={dateKey}
            photos={photosForDay}
            label={currentLabel}
            onCameraPress={handleCamera}
            onUploadPress={handleUpload}
            onHeaderPress={() => setLabelSheetOpen(true)}
          />
        </View>
      </GestureDetector>

      {/* Hidden test-only buttons; visually no-op. */}
      <View style={styles.hidden} pointerEvents="box-none" importantForAccessibility="no">
        <TouchableOpacity testID="day-pager-prev" onPress={goPrev} accessible={false} />
        <TouchableOpacity testID="day-pager-next" onPress={goNext} accessible={false} />
      </View>

      <MilestoneLabelInput
        visible={labelSheetOpen}
        date={dateKey}
        initialLabel={currentLabel ?? ''}
        onSave={(label) => {
          upsert.mutate({ date: dateKey, label });
          setLabelSheetOpen(false);
        }}
        onClear={() => {
          remove.mutate({ date: dateKey });
          setLabelSheetOpen(false);
        }}
        onClose={() => setLabelSheetOpen(false)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { width: 0, height: 0, opacity: 0, position: 'absolute' },
});
