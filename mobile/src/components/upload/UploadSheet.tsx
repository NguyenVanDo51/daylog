import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { PhotoThumbnailGrid } from './PhotoThumbnailGrid';
import { useUpload, UploadAsset } from '@/hooks/useUpload';
import { colors, spacing, typography } from '@/constants/theme';

interface UploadSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadSheet({ visible, onClose }: UploadSheetProps) {
  const { pickImages, uploadImages, uploading, progress } = useUpload();
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (visible) {
      pickImages().then((a) => {
        if (!a.length) { onClose(); return; }
        setAssets(a);
        setSelected(new Set(a.map((x) => x.uri)));
      });
    } else {
      setAssets([]);
      setSelected(new Set());
      setCaption('');
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
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Photos</Text>
          <Button label="Cancel" onPress={onClose} variant="ghost" />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={toggleSelect} />
          <TextInput
            label="Caption (optional)"
            placeholder="Add a caption..."
            value={caption}
            onChangeText={setCaption}
            style={styles.captionInput}
          />
          {uploading && (
            <Text style={styles.progress}>{Math.round(progress * 100)}% uploaded...</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={`Upload ${selected.size} Photo${selected.size !== 1 ? 's' : ''}`}
            onPress={handleUpload}
            fullWidth
            loading={uploading}
            disabled={!selected.size}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'] },
  title:        { ...typography.title, color: colors.textPrimary },
  content:      { padding: spacing['2xl'] },
  captionInput: { marginTop: spacing.lg },
  progress:     { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  footer:       { padding: spacing['2xl'] },
});
