import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { putLocalFile } from '@/lib/uploadFile';
import { useAlbumStore } from '@/stores/albumStore';
import { useCaptureStore, getCooldownRemaining } from '@/stores/captureStore';
import type { ReviewAsset } from '@/stores/photoReviewStore';

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
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const { uri } = await getThumbnailAsync(videoUri, { time: 0 });
      return uri;
    } catch {
      return videoUri;
    }
  }

  async function capture(asset: ReviewAsset, caption?: string) {
    if (!albumId) throw new Error('No active album');
    setCapturing(true);
    try {
      if (asset.type === 'photo') {
        const { data: presign } = await api.post('/photos/presign', {
          album_id: albumId,
          content_type: 'image/webp',
        });
        const compressedUri = await compressToWebP(asset.uri);
        await putLocalFile(presign.url, compressedUri, 'image/webp');
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

        await Promise.all([
          putLocalFile(videoPresign.data.url, asset.uri, 'video/mp4'),
          putLocalFile(thumbPresign.data.url, thumbUri, 'image/jpeg'),
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
