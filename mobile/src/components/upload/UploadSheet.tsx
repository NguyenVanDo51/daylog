import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { Confetti } from '@/components/ui/Confetti';
import { PhotoThumbnailGrid } from './PhotoThumbnailGrid';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface UploadSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadSheet({ visible, onClose }: UploadSheetProps) {
  const { pickImages, uploadImages, uploading, progress } = useUpload();
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (visible) {
      pickImages().then((a) => {
        if (!a.length) { onClose(); return; }
        setAssets(a);
        setSelected(new Set(a.map((x) => x.uri)));
      });
    } else {
      setAssets([]); setSelected(new Set()); setCaption(''); setCelebrate(false);
    }
  }, [visible]);

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uri) ? next.delete(uri) : next.add(uri);
      return next;
    });
  }

  async function handleUpload() {
    const toUpload = assets.filter((a) => selected.has(a.uri));
    await uploadImages(toUpload, caption);
    success();
    setCelebrate(true);
    setTimeout(() => { setCelebrate(false); onClose(); }, 1300);
  }

  const count = selected.size;
  const ctaLabel = count === 1 ? t('upload.cta_one') : t('upload.cta', { n: count });
  const progressLabel = uploading
    ? (progress < 0.05 ? t('upload.compressing') : t('upload.uploading', { done: Math.round(progress * count), total: count }))
    : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('upload.eyebrow')}</Text>
            <Text style={styles.title}>{t('upload.title')}</Text>
          </View>
          <Button label={t('upload.cancel')} onPress={onClose} variant="ghost" tier="quiet" />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={toggleSelect} />
          <TextInput
            placeholder={t('upload.caption_ph')}
            value={caption}
            onChangeText={setCaption}
            style={styles.captionInput}
            caveatPlaceholder
          />
          {uploading && <Text style={styles.progress}>{progressLabel}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button label={ctaLabel} onPress={handleUpload} fullWidth loading={uploading} disabled={!count} />
        </View>

        <Confetti visible={celebrate} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream },
  handle:       { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginTop: spacing.md },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'] },
  eyebrow:      { ...typography.handAccent, color: colors.pink },
  title:        { ...typography.heading, color: colors.ink },
  content:      { padding: spacing['2xl'] },
  captionInput: { marginTop: spacing.lg },
  progress:     { ...typography.body, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.md, fontFamily: 'Caveat_500Medium', fontSize: 18 },
  footer:       { padding: spacing['2xl'] },
});
