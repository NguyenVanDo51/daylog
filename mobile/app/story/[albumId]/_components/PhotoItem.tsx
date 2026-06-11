import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { DayPhoto } from '@/hooks/useDayPhotos';

const PHOTO_DURATION_MS = 3000;

export function PhotoItem({
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
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
  }, [photo.id]);

  useEffect(() => {
    if (isPaused) return;
    let cancelled = false;
    const startTime = Date.now() - elapsedRef.current;
    const tick = () => {
      if (cancelled) return;
      const frac = Math.min((Date.now() - startTime) / PHOTO_DURATION_MS, 1);
      onProgress(frac);
      if (frac < 1) requestAnimationFrame(tick);
      else { elapsedRef.current = 0; onEnd(); }
    };
    requestAnimationFrame(tick);
    return () => {
      elapsedRef.current = Date.now() - startTime;
      cancelled = true;
    };
  }, [photo.id, isPaused]);

  return (
    <Image
      source={{ uri: photo.thumb_url ?? undefined }}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
    />
  );
}
