import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { API_URL } from '@/constants/api';

export function VideoItem({
  photo,
  onEnd,
  isPaused,
  onProgress,
}: {
  photo: DayPhoto;
  onEnd: () => void;
  isPaused: boolean;
  onProgress: (f: number) => void;
}) {
  const player = useVideoPlayer(`${API_URL}/photos/${photo.id}/full`, (p) => {
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (isPaused) player.pause();
    else player.play();
  }, [isPaused, player]);

  useEffect(() => {
    const id = setInterval(() => {
      const dur = player.duration;
      if (!dur || isNaN(dur) || dur === 0) { onProgress(0); return; }
      onProgress(Math.min(player.currentTime / dur, 1));
    }, 200);
    return () => clearInterval(id);
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
