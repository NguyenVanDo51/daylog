import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { ReactionPicker } from '@/components/ui/ReactionPicker';
import { useReactions, useReact } from '@/hooks/useReactions';
import { tap } from '@/lib/haptics';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PhotoTileProps {
  photo: TimelinePhoto;
  tileWidth: number;
  tileHeight: number;
}

export function PhotoTile({ photo, tileWidth, tileHeight }: PhotoTileProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const { data: reactions = [] } = useReactions(photo.id);
  const { add } = useReact(photo.id);

  const videoUri = photo.media_type === 'video'
    ? `${API_URL}/photos/${photo.id}/full`
    : '';
  const videoPlayer = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const topReactions = reactions.slice(0, 3);

  return (
    <>
      <TouchableOpacity
        testID="photo-tile"
        activeOpacity={0.92}
        onPress={() => { tap(); router.push(`/photo/${photo.id}`); }}
        onLongPress={() => setPickerVisible(true)}
        delayLongPress={350}
      >
        <View style={[styles.tile, { width: tileWidth, height: tileHeight }]}>
          {photo.media_type === 'video' ? (
            <VideoView
              player={videoPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}

          {photo.media_type === 'video' && (
            <View style={styles.videoBadge} testID="video-badge">
              <Ionicons name="videocam" size={10} color={colors.white} />
            </View>
          )}

          {topReactions.length > 0 && (
            <View style={styles.reactionOverlay} testID="reaction-overlay">
              {topReactions.map((r) => (
                <Text key={r.emoji} style={styles.rxnText}>
                  {r.emoji} {r.count}
                </Text>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>

      <ReactionPicker
        visible={pickerVisible}
        onSelect={(emoji) => add.mutate(emoji)}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.borderSoft,
  },
  videoBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(61,42,31,0.6)',
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  rxnText: {
    fontSize: 10,
    color: colors.ink,
  },
});
