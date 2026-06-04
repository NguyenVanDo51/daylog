import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCalendar } from '@/hooks/useCalendar';
import { useTimeline, TimelineItem } from '@/hooks/useTimeline';
import { colors, spacing, typography } from '@/constants/theme';
import { formatVnDayLabel } from '@/lib/format';

const DOW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function getFirstDayOfWeek(year: number, month: number): number {
  // Returns 0-6 where 0=Monday … 6=Sunday (Vietnamese week starts Monday)
  const d = new Date(year, month - 1, 1).getDay(); // 0=Sun…6=Sat
  return d === 0 ? 6 : d - 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: calData = {} } = useCalendar(year, month);
  const { data: timelineData } = useTimeline();

  const totalDays = daysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const todayKey = toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const selectedItems = useMemo<TimelineItem[]>(() => {
    if (!selectedDay || !timelineData) return [];
    return timelineData.pages
      .flatMap((p: any) => p.items)
      .filter((item: TimelineItem) => {
        const dateStr = item.type === 'photo' ? item.taken_at : item.occurred_at;
        return dateStr.slice(0, 10) === selectedDay;
      });
  }, [selectedDay, timelineData]);

  function getDayStyle(dayKey: string) {
    const info = calData[dayKey];
    if (!info) return styles.dayEmpty;
    if (info.capture) return styles.dayCapture;
    if (info.photo) return styles.dayPhoto;
    if (info.milestone) return styles.dayMilestone;
    return styles.dayEmpty;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.nav}>
        <TouchableOpacity testID="cal-prev" onPress={prevMonth} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>Tháng {month} · {year}</Text>
        <TouchableOpacity testID="cal-next" onPress={nextMonth} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dowRow}>
        {DOW_LABELS.map(d => <Text key={d} style={styles.dowLabel}>{d}</Text>)}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: firstDow }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dayKey = toDateKey(year, month, day);
          const isToday = dayKey === todayKey;
          const isSelected = dayKey === selectedDay;
          return (
            <TouchableOpacity
              key={dayKey}
              testID={`cal-day-${dayKey}`}
              style={[
                styles.dayCell,
                getDayStyle(dayKey),
                isToday && styles.dayToday,
                isSelected && styles.daySelected,
              ]}
              onPress={() => setSelectedDay(dayKey === selectedDay ? null : dayKey)}
            >
              <Text style={[
                styles.dayNum,
                calData[dayKey] && styles.dayNumActive,
                isToday && styles.dayNumToday,
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: colors.yellow }]} />
          <Text style={styles.legText}>Ảnh upload</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: colors.pink }]} />
          <Text style={styles.legText}>Capture</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: colors.mint }]} />
          <Text style={styles.legText}>Cột mốc</Text>
        </View>
      </View>

      {selectedDay && (
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>{formatVnDayLabel(selectedDay + 'T12:00:00Z')}</Text>
          {selectedItems.length === 0 && (
            <Text style={styles.detailEmpty}>Không có nội dung cho ngày này trong bộ nhớ cache. Kéo feed để tải thêm.</Text>
          )}
          {selectedItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <View style={styles.detailDivider} />}
              <TouchableOpacity
                style={styles.detailItem}
                onPress={() =>
                  item.type === 'photo'
                    ? router.push(`/photo/${item.id}`)
                    : router.push(`/milestone/${item.id}`)
                }
              >
                <View style={styles.detailThumb}>
                  {item.type === 'photo' && (
                    <Image
                      source={{ uri: `${API_URL}/photos/${item.id}/thumb` }}
                      style={StyleSheet.absoluteFill as any}
                      contentFit="cover"
                    />
                  )}
                  {item.type === 'milestone' && (
                    <Text style={{ fontSize: 22 }}>🎯</Text>
                  )}
                </View>
                <View style={styles.detailMeta}>
                  <Text style={styles.detailCap} numberOfLines={1}>
                    {item.type === 'photo'
                      ? (item.caption ?? 'Ảnh')
                      : item.title}
                  </Text>
                  {item.type === 'milestone' && (
                    <Text style={styles.detailSub}>Cột mốc</Text>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing['4xl'] },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  arrow: { padding: spacing.sm },
  arrowText: { ...typography.heading, color: colors.inkMuted },
  monthLabel: { ...typography.title, color: colors.ink },
  dowRow: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  dowLabel: { flex: 1, textAlign: 'center', ...typography.bodySmall, color: colors.inkMuted, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, gap: 3 },
  dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayEmpty: { backgroundColor: 'transparent' },
  dayPhoto: { backgroundColor: colors.yellow },
  dayCapture: { backgroundColor: colors.pink },
  dayMilestone: { backgroundColor: colors.mint },
  dayToday: { borderWidth: 2, borderColor: colors.pink },
  daySelected: { borderWidth: 2.5, borderColor: colors.ink },
  dayNum: { ...typography.bodySmall, color: colors.inkMuted },
  dayNumActive: { color: colors.ink, fontWeight: '700' },
  dayNumToday: { color: colors.pink, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 3 },
  legText: { ...typography.bodySmall, color: colors.inkSoft },
  detail: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  detailLabel: { ...typography.bodySmall, color: colors.pink, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  detailEmpty: { ...typography.bodySmall, color: colors.inkMuted, textAlign: 'center', paddingVertical: spacing.md },
  detailItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 5 },
  detailThumb: { width: 50, height: 50, borderRadius: 9, backgroundColor: colors.borderSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailMeta: { flex: 1 },
  detailCap: { ...typography.body, color: colors.ink },
  detailSub: { ...typography.bodySmall, color: colors.inkMuted },
  detailDivider: { height: 1, backgroundColor: colors.borderSoft },
});
