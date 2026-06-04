import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MasonryBlock, distributeMasonry } from '@/components/timeline/MasonryBlock';
import { colors, spacing, typography } from '@/constants/theme';
import { isToday } from '@/lib/dateKey';
import { formatVnDayLabel } from '@/lib/format';
import type { TimelinePhoto } from '@/hooks/useTimeline';

interface Props {
  dateKey: string;
  photos: TimelinePhoto[];
  label: string | null;
  onCameraPress: () => void;
  onUploadPress: () => void;
  onHeaderPress: () => void;
}

const H_PADDING = 16; // align with page padding
const COL_GAP = 4;

export function DayPage({
  dateKey, photos, label, onCameraPress, onUploadPress, onHeaderPress,
}: Props) {
  const today = isToday(dateKey);
  const hasPhotos = photos.length > 0;
  const { width: screenWidth } = useWindowDimensions();
  const columnWidth = (screenWidth - H_PADDING * 2 - COL_GAP) / 2;
  const block = useMemo(() => distributeMasonry(photos, columnWidth), [photos, columnWidth]);

  return (
    <View style={styles.container} testID={`day-page-${dateKey}`}>
      <TouchableOpacity testID="day-header" onPress={onHeaderPress} style={styles.header}>
        {label ? (
          <>
            <Text style={styles.labelLine}>{label}</Text>
            <Text style={styles.dateLine}>{formatVnDayLabel(dateKey + 'T12:00:00Z')}</Text>
          </>
        ) : (
          <Text style={styles.dateLineLarge}>{formatVnDayLabel(dateKey + 'T12:00:00Z')}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        {hasPhotos ? (
          <MasonryBlock block={block} columnWidth={columnWidth} />
        ) : today ? (
          <TouchableOpacity testID="day-camera-cta" onPress={onCameraPress} style={styles.cta}>
            <View style={styles.ctaCircle}>
              <Ionicons name="camera" size={42} color={colors.white} />
            </View>
            <Text style={styles.ctaText}>Ghi lại ngày hôm nay</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity testID="day-upload-cta" onPress={onUploadPress} style={styles.uploadCta}>
            <Text style={styles.emptyText}>Chưa có ảnh ngày này</Text>
            <Text style={styles.uploadLink}>Thêm ảnh từ thư viện</Text>
          </TouchableOpacity>
        )}
      </View>

      {hasPhotos && (today ? (
        <TouchableOpacity testID="day-camera-fab" style={styles.fab} onPress={onCameraPress}>
          <Ionicons name="camera" size={22} color={colors.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity testID="day-upload-fab" style={styles.fab} onPress={onUploadPress}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.md },
  dateLineLarge: { ...typography.title, color: colors.ink, textAlign: 'center' },
  labelLine: { ...typography.title, color: colors.ink, textAlign: 'center' },
  dateLine: { ...typography.bodySmall, color: colors.inkMuted, textAlign: 'center', marginTop: 2 },
  body: { flex: 1, justifyContent: 'center' },
  cta: { alignItems: 'center', gap: spacing.md },
  ctaCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...typography.title, color: colors.ink },
  uploadCta: { alignItems: 'center', gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.inkMuted },
  uploadLink: { ...typography.body, color: colors.pink, fontWeight: '700' },
  fab: {
    position: 'absolute', right: spacing['2xl'], bottom: spacing['2xl'],
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
