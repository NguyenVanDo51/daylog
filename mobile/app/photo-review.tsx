import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { useCapture, type UploadResult } from '@/hooks/useCapture';
import { useAlbums } from '@/hooks/useAlbums';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { colors, spacing, typography } from '@/constants/theme';
import { success } from '@/lib/haptics';

function VideoPreview({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={{ width, height, borderRadius: 8 }} contentFit="cover" nativeControls={false} />;
}

export default function PhotoReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const assets = usePhotoReviewStore((s) => s.assets);
  const clear = usePhotoReviewStore((s) => s.clear);
  const { startBackgroundUpload, finishCapture } = useCapture();
  const { data: albums = [] } = useAlbums();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const uploadPromiseRef = useRef<Promise<UploadResult>>();

  const asset = assets[0];
  const previewSize = width - spacing['2xl'] * 2;

  useEffect(() => {
    if (assets.length === 0) { router.back(); return; }
    uploadPromiseRef.current = startBackgroundUpload(asset);
  }, []);

  if (assets.length === 0 || !asset) return null;

  function toggleAlbum(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const albumIds = Array.from(selectedIds);
    setSaving(true);
    try {
      const result = await uploadPromiseRef.current!;
      await finishCapture(result, asset, albumIds, caption.trim() || null);
      success();
      setCelebrate(true);
      setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ảnh. Thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar hidden />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-close">
          <Ionicons name="close" size={26} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} testID="review-retake">
          <Text style={styles.retakeText}>Chụp lại</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.preview, { width: previewSize, height: previewSize * 0.75 }]}>
          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} width={previewSize} height={previewSize * 0.75} />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={[styles.previewImg, { width: previewSize, height: previewSize * 0.75 }]}
              resizeMode="cover"
            />
          )}
        </View>

        <TextInput
          style={styles.noteInput}
          placeholder="Thêm ghi chú..."
          placeholderTextColor={colors.inkMuted}
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={200}
          testID="review-note-input"
        />

        <Text style={styles.sectionLabel}>Thêm vào album:</Text>
        {albums.map((album) => {
          const selected = selectedIds.has(album.id);
          return (
            <TouchableOpacity
              key={album.id}
              testID={`album-checkbox-${album.id}`}
              style={styles.albumRow}
              onPress={() => toggleAlbum(album.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <Text style={styles.albumName}>{album.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          testID="review-save"
          label={saving ? '' : 'Lưu lại'}
          onPress={handleSave}
          fullWidth
          loading={saving}
          disabled={selectedIds.size === 0 || saving}
        />
      </View>

      <Confetti visible={celebrate} />
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.cream },
  topBar:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  retakeText:       { ...typography.body, color: colors.inkMuted },
  scroll:           { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['2xl'], gap: spacing.lg },
  preview:          { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.borderSoft, alignSelf: 'center' },
  previewImg:       { borderRadius: 12 },
  noteInput:        { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 64, ...typography.body, color: colors.ink, textAlignVertical: 'top' },
  sectionLabel:     { ...typography.body, color: colors.inkSoft, fontWeight: '600' },
  albumRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.pink, borderColor: colors.pink },
  albumName:        { ...typography.body, color: colors.ink },
  footer:           { paddingHorizontal: spacing['2xl'], paddingTop: spacing.md },
});
