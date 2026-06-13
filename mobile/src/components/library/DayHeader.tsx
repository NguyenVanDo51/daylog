import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, spacing, typography } from '@/constants/theme';

const WEEKDAY_VI: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
};

function formatHeader(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  const [y, m, d] = parts;
  const dt = new Date(`${date}T00:00:00`);
  const weekday = WEEKDAY_VI[dt.getDay()] ?? '';
  return `${d}.${m}.${y} · ${weekday}`;
}

interface Props {
  date: string;
  photoCount: number;
}

export function DayHeader({ date, photoCount }: Props) {
  return (
    <View style={styles.row} testID={`library-day-header-${date}`}>
      <Text style={styles.date}>{formatHeader(date)}</Text>
      <Text style={styles.count}>{photoCount} ảnh</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: theme.colors.background,
  },
  date: {
    ...typography.title,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  count: {
    ...typography.caption,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
