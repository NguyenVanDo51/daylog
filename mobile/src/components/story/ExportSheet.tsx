import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircleIcon, WarningCircleIcon } from 'phosphor-react-native';
import { theme, spacing, typography } from '@/constants/theme';
import { StickerCard } from '@/components/ui/StickerCard';
import type { ExportStatus } from '@/hooks/useStoryExport';

interface Props {
  visible: boolean;
  status: ExportStatus;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

const AUTO_CLOSE_MS = 1500;

export function ExportSheet({ visible, status, error, onClose, onRetry }: Props) {
  // Auto-close on success so the menu collapses without a manual tap.
  useEffect(() => {
    if (!visible || status !== 'success') return;
    const id = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [visible, status, onClose]);

  if (!visible) return null;

  const dismissable = status !== 'loading';

  return (
    <TouchableOpacity
      style={styles.backdrop}
      activeOpacity={1}
      onPress={dismissable ? onClose : undefined}
      testID="export-sheet-backdrop"
    >
      {/* Inner Touchable swallows taps so backdrop dismiss doesn't fire from card area. */}
      <TouchableOpacity activeOpacity={1} onPress={() => { }}>
        <StickerCard shadow="heavy" style={styles.sheet} testID="export-sheet">
          {status === 'loading' && (
            <View style={styles.row} testID="export-sheet-loading">
              <ActivityIndicator color={theme.colors.textPrimary} />
              <Text style={styles.title}>Đang lưu video…</Text>
            </View>
          )}

          {status === 'success' && (
            <View style={styles.row} testID="export-sheet-success">
              <CheckCircleIcon size={28} color={theme.colors.success} weight="fill" />
              <Text style={styles.title}>Đã lưu vào Ảnh</Text>
            </View>
          )}

          {status === 'permission' && (
            <View style={styles.column} testID="export-sheet-permission">
              <View style={styles.row}>
                <WarningCircleIcon size={28} color={theme.colors.error} weight="fill" />
                <Text style={styles.title}>Cần quyền truy cập Ảnh</Text>
              </View>
              <Text style={styles.message}>Hãy bật quyền trong phần Cài đặt để lưu video.</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.btn} onPress={onClose} testID="export-sheet-close">
                  <Text style={styles.btnText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.column} testID="export-sheet-error">
              <View style={styles.row}>
                <WarningCircleIcon size={28} color={theme.colors.error} weight="fill" />
                <Text style={styles.title}>Không thể xuất video</Text>
              </View>
              {__DEV__ && error && <Text style={styles.message}>{error}</Text>}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={onClose}
                  testID="export-sheet-close"
                >
                  <Text style={styles.btnText}>Đóng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={onRetry}
                  testID="export-sheet-retry"
                >
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </StickerCard>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.overlays.scrimDeep, zIndex: 50,
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: spacing.lg, padding: spacing.lg, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  column: { gap: spacing.md },
  title: {
    ...typography.title, color: theme.colors.textPrimary, flex: 1,
  },
  message: {
    ...typography.body, color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm,
  },
  btn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: theme.radii.md,
  },
  btnGhost: { backgroundColor: theme.overlays.surfaceOnDark },
  btnPrimary: { backgroundColor: theme.colors.accent1 },
  btnText: { ...typography.body, color: theme.colors.textPrimary },
  btnTextPrimary: { color: theme.colors.textPrimary, fontWeight: '700' },
});
