import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { Video } from 'phosphor-react-native';
import { colors, spacing, typography, shadows } from '@/constants/theme';
import { ReactionBadge } from '@/components/ui/ReactionBadge';
import { ReactionPicker } from '@/components/ui/ReactionPicker';
import { useReactions, useReact } from '@/hooks/useReactions';
import { tap } from '@/lib/haptics';
import { formatVnDate } from '@/lib/format';
import type { TimelinePhoto } from '@/hooks/useTimeline';

interface PolaroidCardProps {
  photo: TimelinePhoto;
}

export function PolaroidCard({ photo }: PolaroidCardProps) {
  const { width } = useWindowDimensions();
  const cardWidth = width - spacing['2xl'] * 2;
  const imageWidth = cardWidth - spacing.lg * 2;
  const [pickerVisible, setPickerVisible] = useState(false);
  const { data: reactionData = [] } = useReactions(photo.id);
  const { add } = useReact(photo.id);

  // Hook must be called unconditionally; empty string disables loading for non-video
  const videoUri = photo.media_type === 'video' ? (photo.photo_url ?? '') : '';
  const videoPlayer = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  function handlePress() {
    tap();
    router.push(`/photo/${photo.id}`);
  }

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={() => setPickerVisible(true)}
        delayLongPress={350}
        activeOpacity={0.95}
      >
        {photo.media_type === 'video' ? (
          <VideoView
            player={videoPlayer}
            style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: photo.thumb_url ?? undefined }}
            style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]}
            contentFit="cover"
          />
        )}

        {photo.media_type === 'video' && (
          <View style={styles.videoBadge} testID="polaroid-video-badge">
            <Video size={12} color={colors.white} weight="fill" />
          </View>
        )}

        <View style={styles.footer}>
          {photo.caption ? (
            <Text style={styles.caption} numberOfLines={2} testID="polaroid-caption">
              {photo.caption}
            </Text>
          ) : null}
          <Text style={styles.date} testID="polaroid-date">
            {formatVnDate(new Date(photo.taken_at))}
          </Text>
        </View>

        <ReactionBadge reactions={reactionData} />
      </TouchableOpacity>

      <ReactionPicker
        visible={pickerVisible}
        onSelect={(emoji) => add.mutate(emoji)}
        onDismiss={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 4,
    ...shadows.card,
  },
  image: {
    borderRadius: 2,
  },
  footer: {
    marginTop: spacing.sm,
    gap: 2,
  },
  caption: {
    ...typography.handAccent,
    color: colors.ink,
    fontSize: 16,
  },
  date: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'right',
  },
  videoBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 99,
    padding: 4,
  },
});
