import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useUploadStore } from '@/stores/uploadStore';
import { colors, spacing, shadows, typography } from '@/constants/theme';

interface Props {
  onPress: () => void;
}

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

export function StorageBadge({ onPress }: Props) {
  const syncedPhotos = useUploadStore((s) => s.syncedPhotos);
  if (!syncedPhotos.length) return null;
  const totalBytes = syncedPhotos.reduce((s, p) => s + p.compressedBytes, 0);
  const count = syncedPhotos.length;
  const mb = formatMB(totalBytes);
  return (
    <TouchableOpacity style={styles.badge} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.text}>{count} ảnh đã lưu an toàn — Giải phóng {mb}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.mint,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.sticker,
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing.md,
  },
  text: { ...typography.caption, color: colors.ink, textAlign: 'center' },
});
