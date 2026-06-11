import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Images } from 'phosphor-react-native';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { theme, spacing, typography } from '@/constants/theme';

interface Props {
  date: string;
  thumbnailUrl: string | null;
  hasVideo: boolean;
  tall: boolean;
  index: number;
  onPress: () => void;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // Vietnamese short weekdays, Sunday=0

export function DayCell({ date, thumbnailUrl, hasVideo, tall, index, onPress }: Props) {
  const { width } = useWindowDimensions();
  const colWidth = (width - spacing['2xl'] * 2 - spacing.sm) / 2;
  const thumbHeight = tall ? colWidth * 1.2 : colWidth * 0.75;

  const parts = date.split('-'); // ['YYYY', 'MM', 'DD']
  const dayNum = parts[2];
  const monthNum = parts[1];
  const weekday = WEEKDAYS[new Date(date).getDay()] ?? '';
  const label = `${weekday} · ${dayNum}.${monthNum}`;

  return (
    <TouchableOpacity
      testID={`day-cell-${date}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={{ width: colWidth }}
    >
      <StickerCard tilt="default" flip={index % 2 === 1} style={styles.card}>
        <View style={[styles.thumbWrap, { height: thumbHeight }]}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Images size={28} color={theme.colors.textMuted} />
            </View>
          )}
          {hasVideo && (
            <View style={styles.videoBadge} testID="video-badge">
              <StickerChip label="▶" variant="ink" />
            </View>
          )}
        </View>
        <Text style={styles.dateLabel}>{label}</Text>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:        { padding: spacing.xs, overflow: 'hidden' },
  thumbWrap:   {
    width: '100%',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  videoBadge:  { position: 'absolute', top: spacing.xs, right: spacing.xs },
  dateLabel:   { ...typography.displayCute, fontSize: 13, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xs },
});
