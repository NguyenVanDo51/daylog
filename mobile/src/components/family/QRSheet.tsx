import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { useQueryClient } from '@tanstack/react-query';
import { theme, spacing, typography } from '@/constants/theme';
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

  useEffect(() => {
    if (!visible) setScanned(false);
  }, [visible]);

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
      {!permission ? null : !permission.granted ? (
        <>
          <Text style={styles.heading}>{t('qr.perm_title')}</Text>
          <Text style={styles.body}>{t('qr.perm_body')}</Text>
          <View style={styles.buttons}>
            <StickerButton label={t('qr.perm_grant')} variant="primary" fullWidth onPress={requestPermission} />
            <StickerButton label={t('common.cancel')} variant="surface" fullWidth onPress={onClose} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.heading}>{t('qr.sheet_title')}</Text>
          {visible && (
            <StickerCard style={styles.scannerCard}>
              <CameraView
                style={styles.scanner}
                onBarcodeScanned={handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            </StickerCard>
          )}
          <Text style={styles.validity}>{t('qr.valid_for')}</Text>
          <StickerButton label={t('common.cancel')} variant="surface" fullWidth onPress={onClose} />
        </>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading:     { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  body:        { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  scannerCard: { flex: 1, padding: 0, overflow: 'hidden' },
  scanner:     { flex: 1 },
  validity:    { ...typography.body, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  buttons:     { gap: spacing.md, marginTop: spacing.lg },
});
