import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { useUploadStore } from '@/stores/uploadStore';
import { colors, spacing, typography, shadows } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

export function StorageFreedomModal({ visible, onClose }: Props) {
  const syncedPhotos = useUploadStore((s) => s.syncedPhotos);
  const removeSynced = useUploadStore((s) => s.removeSynced);
  const [deleting, setDeleting] = useState(false);
  const totalBytes = syncedPhotos.reduce((s, p) => s + p.compressedBytes, 0);
  const count = syncedPhotos.length;
  const mb = formatMB(totalBytes);

  async function handleDelete() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Lỗi', 'Không có quyền truy cập thư viện ảnh');
      return;
    }
    setDeleting(true);
    try {
      for (const photo of syncedPhotos) {
        try {
          await MediaLibrary.deleteAssetsAsync([photo.localAssetId]);
          removeSynced(photo.localAssetId);
        } catch {
          // skip assets that can't be deleted
        }
      }
      onClose();
      Alert.alert('Thành công', `Đã giải phóng ${mb} trên điện thoại của bạn`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Ảnh đã lưu an toàn</Text>
          <Text style={styles.body}>
            {count} ảnh đã được lưu trên ứng dụng. Bạn có thể xóa khỏi điện thoại để giải phóng {mb}.
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting} activeOpacity={0.8}>
            <Text style={styles.deleteBtnText}>{deleting ? 'Đang xóa...' : `Xóa ${count} ảnh khỏi điện thoại`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing['3xl'], paddingBottom: spacing['4xl'], ...shadows.sticker },
  title:         { ...typography.heading, fontSize: 18, marginBottom: spacing.md },
  body:          { ...typography.body, color: colors.inkMuted, marginBottom: spacing['3xl'] },
  deleteBtn:     { backgroundColor: colors.ink, borderRadius: 22, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  deleteBtnText: { ...typography.body, color: colors.cream },
  cancelBtn:     { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText:    { ...typography.body, color: colors.inkMuted },
});
