import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Props {
  date: string;
  thumbnailPhotoId: string | null;
  hasVideo: boolean;
  tall: boolean;
  onPress: () => void;
}

export function DayCell({ date, thumbnailPhotoId, hasVideo, tall, onPress }: Props) {
  const { width } = useWindowDimensions();
  const colWidth = (width - spacing['2xl'] * 2 - spacing.sm) / 2;
  const cellHeight = tall ? colWidth * 1.4 : colWidth * 0.85;

  const parts = date.split('-'); // ['YYYY', 'MM', 'DD']
  const label = `${parts[2]}/${parts[1]}`;

  return (
    <TouchableOpacity
      testID={`day-cell-${date}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.cell, { width: colWidth, height: cellHeight }]}
    >
      {thumbnailPhotoId ? (
        <Image
          source={{ uri: `${API_URL}/photos/${thumbnailPhotoId}/thumb` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Ionicons name="images-outline" size={28} color={colors.inkMuted} />
        </View>
      )}
      <View style={styles.overlay}>
        <Text style={styles.dateLabel}>{label}</Text>
      </View>
      {hasVideo && (
        <View style={styles.videoBadge} testID="video-badge">
          <Ionicons name="play" size={10} color={colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell:        { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.borderSoft },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  overlay:     { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dateLabel:   { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 11 },
  videoBadge:  { position: 'absolute', bottom: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
