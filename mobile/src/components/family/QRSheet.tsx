import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { useQueryClient } from '@tanstack/react-query';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

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
      success();
      Alert.alert(t('qr.joined_title'), t('qr.joined_body'));
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.error ?? e.message);
      setScanned(false);
    }
  }

  return (
    <SheetModal visible={visible} onClose={onClose} size="large">
      <View style={styles.handle} />

      {!permission ? null : !permission.granted ? (
        <>
          <Text style={styles.heading}>{t('qr.perm_title')}</Text>
          <Text style={styles.body}>{t('qr.perm_body')}</Text>
          <Button label={t('qr.perm_grant')} onPress={requestPermission} fullWidth />
          <Button label={t('common.cancel')} onPress={onClose} variant="ghost" fullWidth />
        </>
      ) : (
        <>
          <Text style={styles.eyebrow}>{t('qr.sheet_title')}</Text>
          {visible && (
            <View style={styles.scannerFrame}>
              <CameraView style={styles.scanner} onBarcodeScanned={handleBarCodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
            </View>
          )}
          <Text style={styles.validity}>{t('qr.valid_for')}</Text>
          <Button label={t('common.cancel')} onPress={onClose} variant="ghost" fullWidth />
        </>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  handle:       { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginBottom: spacing.md },
  eyebrow:      { ...typography.handAccent, color: colors.pink, textAlign: 'center' },
  heading:      { ...typography.heading, color: colors.ink },
  body:         { ...typography.body },
  scannerFrame: { flex: 1, borderRadius: radii.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, overflow: 'hidden', ...shadows.sticker },
  scanner:      { flex: 1 },
  validity:     { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted, textAlign: 'center' },
});
