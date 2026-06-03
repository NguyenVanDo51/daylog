import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@/constants/theme';

interface QRSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function QRSheet({ visible, onClose }: QRSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const qc = useQueryClient();
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const token = data.includes('://') ? data.split('/').pop() : data;
    try {
      await api.post(`/invites/${token}/join`);
      qc.invalidateQueries({ queryKey: ['members', albumId] });
      Alert.alert('Joined!', 'You joined the album.');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message);
      setScanned(false);
    }
  }

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.heading}>Camera Permission</Text>
          <Text style={styles.body}>Camera access is needed to scan QR codes.</Text>
          <Button label="Grant Permission" onPress={requestPermission} fullWidth />
          <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth />
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>Scan QR Code</Text>
        {visible && (
          <CameraView
            style={styles.scanner}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}
        <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing['2xl'], backgroundColor: colors.background, gap: spacing.md },
  heading:   { ...typography.heading, color: colors.textPrimary },
  body:      { ...typography.body, color: colors.textSecondary },
  scanner:   { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
