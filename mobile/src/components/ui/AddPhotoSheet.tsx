import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUpload } from '@/hooks/useUpload';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tap } from '@/lib/haptics';

interface AddPhotoSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AddPhotoSheet({ visible, onClose }: AddPhotoSheetProps) {
  const ref = useRef<TrueSheet>(null);
  const presented = useRef(false);
  const { pickImages } = useUpload();
  const { setAssets } = usePhotoReviewStore();

  React.useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present().catch(() => {});
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss().catch(() => {});
    }
  }, [visible]);

  function handleCamera() {
    tap();
    onClose();
    router.push('/capture');
  }

  async function handleUpload() {
    tap();
    onClose();
    const picked = await pickImages();
    if (!picked.length) return;
    setAssets(
      picked.map((a) => ({
        uri: a.uri,
        type: 'photo' as const,
        source: 'gallery' as const,
        takenAt: a.takenAt,
        localAssetId: a.localAssetId,
      })),
    );
    router.push('/photo-review');
  }

  return (
    <TrueSheet
      ref={ref}
      detents={['auto']}
      cornerRadius={24}
      backgroundColor={colors.background}
      onDidDismiss={() => { presented.current = false; onClose(); }}
    >
      <View style={styles.handle} />
      <View style={styles.sheet}>
        <TouchableOpacity style={styles.row} onPress={handleCamera} activeOpacity={0.7}>
          <View style={styles.iconWrap}>
            <Ionicons name="camera-outline" size={22} color={colors.pink} />
          </View>
          <Text style={styles.label}>{t('add_photo.camera')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={handleUpload} activeOpacity={0.7}>
          <View style={styles.iconWrap}>
            <Ionicons name="images-outline" size={22} color={colors.pink} />
          </View>
          <Text style={styles.label}>{t('add_photo.upload')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </TouchableOpacity>
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  handle:   { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginTop: spacing.md },
  sheet:    { padding: spacing['2xl'], paddingTop: spacing.lg, paddingBottom: spacing['4xl'] },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF0F5', alignItems: 'center', justifyContent: 'center' },
  label:    { ...typography.body, color: colors.ink, flex: 1, fontWeight: '600' },
  divider:  { height: 1, backgroundColor: colors.borderSoft },
});
