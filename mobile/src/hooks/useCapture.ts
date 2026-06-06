import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { putLocalFile } from '@/lib/uploadFile';
import type { ReviewAsset } from '@/stores/photoReviewStore';

export function useCapture() {
  const qc = useQueryClient();
  const [capturing, setCapturing] = useState(false);

  async function extractVideoThumbnail(videoUri: string): Promise<string> {
    try {
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const { uri } = await getThumbnailAsync(videoUri, { time: 0 });
      return uri;
    } catch {
      return videoUri;
    }
  }

  async function capture(asset: ReviewAsset, albumIds: string[]) {
    if (albumIds.length === 0) throw new Error('No album selected');
    setCapturing(true);
    try {
      const primaryAlbumId = albumIds[0];
      if (asset.type === 'photo') {
        const { data: presign } = await api.post('/photos/presign', {
          album_id: primaryAlbumId,
          content_type: 'image/webp',
        });
        const compressedUri = await compressToWebP(asset.uri);
        await putLocalFile(presign.url, compressedUri, 'image/webp');
        const { data: photo } = await api.post('/photos', {
          album_ids: albumIds,
          r2_key: presign.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          source: 'capture',
          media_type: 'photo',
        });
        albumIds.forEach((id) => qc.invalidateQueries({ queryKey: ['album-days', id] }));
        return photo;
      } else {
        const thumbUri = await extractVideoThumbnail(asset.uri);
        const [videoPresign, thumbPresign] = await Promise.all([
          api.post('/photos/presign', { album_id: primaryAlbumId, content_type: 'video/mp4' }),
          api.post('/photos/presign', { album_id: primaryAlbumId, content_type: 'image/jpeg' }),
        ]);
        await Promise.all([
          putLocalFile(videoPresign.data.url, asset.uri, 'video/mp4'),
          putLocalFile(thumbPresign.data.url, thumbUri, 'image/jpeg'),
        ]);
        const { data: photo } = await api.post('/photos', {
          album_ids: albumIds,
          r2_key: videoPresign.data.key,
          thumbnail_r2_key: thumbPresign.data.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          source: 'capture',
          media_type: 'video',
          duration_ms: asset.durationMs,
        });
        albumIds.forEach((id) => qc.invalidateQueries({ queryKey: ['album-days', id] }));
        return photo;
      }
    } finally {
      setCapturing(false);
    }
  }

  return { capture, canCapture: true, capturing };
}
