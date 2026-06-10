import { useQueryClient } from '@tanstack/react-query';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { putLocalFile } from '@/lib/uploadFile';
import type { ReviewAsset } from '@/stores/photoReviewStore';

export interface UploadResult {
  r2Key: string;
  thumbnailR2Key?: string;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export function useCapture() {
  const qc = useQueryClient();

  async function extractVideoThumbnail(videoUri: string): Promise<string | null> {
    try {
      const { uri } = await getThumbnailAsync(videoUri, { time: 0 });
      return uri;
    } catch {
      return null;
    }
  }

  async function startBackgroundUpload(asset: ReviewAsset): Promise<UploadResult> {
    return withRetry(async () => {
      if (asset.type === 'photo') {
        const { data: presign } = await api.post('/photos/presign', { content_type: 'image/webp' });
        const compressedUri = await compressToWebP(asset.uri);
        await putLocalFile(presign.url, compressedUri, 'image/webp');
        return { r2Key: presign.key };
      }
      const thumbUri = await extractVideoThumbnail(asset.uri);
      const compressedThumb = thumbUri != null ? await compressToWebP(thumbUri) : null;
      const [videoPresign, thumbPresign] = await Promise.all([
        api.post('/photos/presign', { content_type: 'video/mp4' }),
        compressedThumb != null ? api.post('/photos/presign', { content_type: 'image/webp' }) : Promise.resolve(null),
      ]);
      await Promise.all([
        putLocalFile(videoPresign.data.url, asset.uri, 'video/mp4'),
        ...(compressedThumb != null && thumbPresign != null
          ? [putLocalFile(thumbPresign.data.url, compressedThumb, 'image/webp')]
          : []),
      ]);
      return {
        r2Key: videoPresign.data.key,
        ...(thumbPresign != null ? { thumbnailR2Key: thumbPresign.data.key } : {}),
      };
    });
  }

  async function finishCapture(result: UploadResult, asset: ReviewAsset, albumIds: string[], caption?: string | null): Promise<void> {
    await api.post('/photos', {
      album_ids: albumIds,
      r2_key: result.r2Key,
      taken_at: asset.takenAt ?? new Date().toISOString(),
      source: 'capture',
      media_type: asset.type === 'video' ? 'video' : 'photo',
      ...(result.thumbnailR2Key ? { thumbnail_r2_key: result.thumbnailR2Key } : {}),
      ...(asset.durationMs ? { duration_ms: asset.durationMs } : {}),
      ...(caption ? { caption } : {}),
    });
    albumIds.forEach((id) => {
      qc.invalidateQueries({ queryKey: ['album-days', id] });
      qc.invalidateQueries({ queryKey: ['timeline', id] });
    });
  }

  return { startBackgroundUpload, finishCapture };
}
