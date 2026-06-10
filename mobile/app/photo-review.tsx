import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
  TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { X, Check } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { useCapture, type UploadResult } from '@/hooks/useCapture';
import { useAlbums } from '@/hooks/useAlbums';
import { useLastAlbumSelection } from '@/hooks/useLastAlbumSelection';
import { Confetti } from '@/components/ui/Confetti';
import { colors, spacing, fonts, radii, shadows } from '@/constants/theme';
import { success } from '@/lib/haptics';

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
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
  const { savedIds, persist } = useLastAlbumSelection();
  const initializedRef = useRef(false);

  const asset = assets[0];

  // Tile sizing: content-fit with max 3 per row.
  // containerWidth = screen width minus horizontal padding on both sides.
  // tileMin = divide remaining width (after 2 inter-tile gaps) by 3.
  const containerWidth = width - spacing['2xl'] * 2;
  const tileMin = (containerWidth - 6 * 2) / 3;

  useEffect(() => {
    if (assets.length === 0) { router.back(); return; }
    uploadPromiseRef.current = startBackgroundUpload(asset);
  }, []);

  useEffect(() => {
    // albums.length === 0 defers init until albums are fetched, allowing re-evaluation when they arrive
    if (initializedRef.current || savedIds === null || albums.length === 0) return;
    initializedRef.current = true;
    const valid = savedIds.filter((id) => albums.some((a) => a.id === id));
    if (valid.length > 0) setSelectedIds(new Set(valid));
  }, [savedIds, albums]);

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
      if (albumIds.length > 0) void persist(albumIds);
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar hidden />

          {/* Layer 1: full-bleed photo or video */}
          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} />
          ) : (
            <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}

          {/* Layer 2: top gradient + top bar */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent']}
            style={[styles.gradientTop, { paddingTop: insets.top }]}
          >
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-close">
                <X size={26} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-retake">
                <Text style={styles.retakeText}>Chụp lại</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Layer 3: caption overlay — vertically centered on screen */}
          <View style={styles.captionZone} pointerEvents="box-none">
            <TextInput
              testID="review-note-input"
              style={styles.captionInput}
              placeholder="Thêm ghi chú..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={200}
              autoFocus
              textAlign="center"
              selectionColor={colors.pink}
            />
            <View style={styles.captionUnderline} />
          </View>

          {/* Layer 4: bottom gradient + album tiles + save */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.82)']}
            style={[styles.gradientBottom, { paddingBottom: insets.bottom + spacing.lg }]}
          >
            <View style={styles.albumGrid}>
              {albums.map((album) => {
                const selected = selectedIds.has(album.id);
                return (
                  <TouchableOpacity
                    key={album.id}
                    testID={`album-checkbox-${album.id}`}
                    style={[
                      styles.albumTile,
                      { minWidth: tileMin, maxWidth: containerWidth },
                      selected && styles.albumTileSelected,
                    ]}
                    onPress={() => toggleAlbum(album.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.tileCheckbox, selected && styles.tileCheckboxSelected]}>
                      {selected && <Check size={9} color={colors.white} weight="bold" />}
                    </View>
                    <Text
                      style={[styles.tileName, selected && styles.tileNameSelected]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {album.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              testID="review-save"
              style={[styles.saveBtn, (selectedIds.size === 0 || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={selectedIds.size === 0 || saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnLabel}>{saving ? '' : 'Lưu lại'}</Text>
            </TouchableOpacity>
          </LinearGradient>

          <Confetti visible={celebrate} />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradientTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  retakeText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  captionZone: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
    width: '82%',
    textAlign: 'center',
  },
  captionUnderline: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
    marginTop: 6,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    gap: spacing.md,
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  albumTile: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  albumTileSelected: {
    backgroundColor: colors.pink,
    borderColor: colors.pink,
  },
  tileCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCheckboxSelected: {
    borderColor: colors.white,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tileName: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    flexShrink: 1,
  },
  tileNameSelected: {
    color: colors.white,
  },
  saveBtn: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.ink,
    ...shadows.sticker,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.ink,
  },
});
