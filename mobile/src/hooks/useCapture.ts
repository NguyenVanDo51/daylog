import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { useAlbumStore } from '@/stores/albumStore';
import { useCaptureStore, getCooldownRemaining, PendingCaptureAsset } from '@/stores/captureStore';

export function useCapture() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  const { lastCaptureAt, setLastCaptureAt } = useCaptureStore();
  const [capturing, setCapturing] = useState(false);

  const cooldownRemaining = getCooldownRemaining(lastCaptureAt);
  const canCapture = cooldownRemaining === 0;
  const nextAvailableAt = lastCaptureAt && cooldownRemaining > 0
    ? new Date(lastCaptureAt + 30 * 60 * 1000)
    : null;

  async function extractVideoThumbnail(videoUri: string): Promise<string> {
    try {
      const { VideoThumbnails } = await import('expo-video-thumbnails');
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0 });
      return uri;
    } catch {
      return videoUri;
    }
  }

  async function capture(asset: PendingCaptureAsset, caption?: string) {
    if (!albumId) throw new Error('No active album');
    setCapturing(true);
    try {
      if (asset.type === 'photo') {
        const { data: presign } = await api.post('/photos/presign', {
          album_id: albumId,
          content_type: 'image/webp',
        });
        const compressedUri = await compressToWebP(asset.uri);
        const blob = await fetch(compressedUri).then((r) => r.blob());
        await fetch(presign.url, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/webp' },
        });
        const { data: photo } = await api.post('/photos', {
          album_id: albumId,
          r2_key: presign.key,
          taken_at: new Date().toISOString(),
          caption: caption ?? null,
          source: 'capture',
          media_type: 'photo',
        });
        setLastCaptureAt(Date.now());
        qc.invalidateQueries({ queryKey: ['timeline', albumId] });
        return photo;
      } else {
        const thumbUri = await extractVideoThumbnail(asset.uri);

        const [videoPresign, thumbPresign] = await Promise.all([
          api.post('/photos/presign', { album_id: albumId, content_type: 'video/mp4' }),
          api.post('/photos/presign', { album_id: albumId, content_type: 'image/jpeg' }),
        ]);

        const [videoBlob, thumbBlob] = await Promise.all([
          fetch(asset.uri).then((r) => r.blob()),
          fetch(thumbUri).then((r) => r.blob()),
        ]);
        await Promise.all([
          fetch(videoPresign.data.url, {
            method: 'PUT',
            body: videoBlob,
            headers: { 'Content-Type': 'video/mp4' },
          }),
          fetch(thumbPresign.data.url, {
            method: 'PUT',
            body: thumbBlob,
            headers: { 'Content-Type': 'image/jpeg' },
          }),
        ]);

        const { data: photo } = await api.post('/photos', {
          album_id: albumId,
          r2_key: videoPresign.data.key,
          thumbnail_r2_key: thumbPresign.data.key,
          taken_at: new Date().toISOString(),
          caption: caption ?? null,
          source: 'capture',
          media_type: 'video',
          duration_ms: asset.durationMs,
        });
        setLastCaptureAt(Date.now());
        qc.invalidateQueries({ queryKey: ['timeline', albumId] });
        return photo;
      }
    } finally {
      setCapturing(false);
    }
  }

  return { capture, canCapture, nextAvailableAt, capturing };
}
