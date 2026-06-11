import React from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, StatusBar, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'phosphor-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTimeline } from '@/hooks/useTimeline';
import { useSharedTransition } from '@/lib/sharedElement';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnDate } from '@/lib/format';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

export default function PhotoViewer() {
  const params = useLocalSearchParams<{ id: string; srcX?: string; srcY?: string; srcW?: string; srcH?: string }>();
  const { data } = useTimeline();
  const photos = (data?.pages.flatMap((p) => p.items) ?? []).filter((i: any) => i.type === 'photo');
  const idx    = photos.findIndex((p: any) => p.id === params.id);
  const photo  = photos[idx];
  const { width, height } = useWindowDimensions();

  const source = (params.srcX && params.srcY && params.srcW && params.srcH) ? {
    x: Number(params.srcX), y: Number(params.srcY), width: Number(params.srcW), height: Number(params.srcH),
  } : null;
  const style = useSharedTransition(source, width, height, true);

  const isVideo = (photo as any)?.media_type === 'video';
  const videoUri = isVideo ? ((photo as any)?.photo_url ?? '') : '';
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
  });

  React.useEffect(() => {
    if (isVideo && player) player.play();
  }, [isVideo]);

  if (!photo) return null;
  const taken = (photo as any).taken_at as string;
  const counter = t('photo.counter', { i: idx + 1, n: photos.length });
  const dateLabel = formatVnDate(new Date(taken));

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {isVideo
        ? (
          <Animated.View style={[style]}>
            <VideoView
              player={player}
              style={{ flex: 1 }}
              contentFit="contain"
              nativeControls={false}
            />
          </Animated.View>
        )
        : <Animated.Image source={{ uri: (photo as any).photo_url }} style={[style]} resizeMode="contain" />
      }

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <X size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <View style={styles.chipWrap}>
          <StickerChip label={`${counter} · ${dateLabel}`} variant="yellow" tilt="default" flip />
        </View>
        <View style={styles.iconBtn} />
      </View>

      {(photo as any).caption && (
        <View style={styles.captionWrap}>
          <StickerCard tilt="subtle" flip style={styles.captionCard}>
            <Text style={styles.captionText}>{(photo as any).caption}</Text>
          </StickerCard>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.overlays.cameraBg },
  topBar:      {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  iconBtn:     { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  chipWrap:    { flex: 1, alignItems: 'center' },
  captionWrap: { position: 'absolute', bottom: 60, left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  captionCard: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  captionText: { ...typography.body, color: theme.colors.textPrimary, textAlign: 'center' },
});
