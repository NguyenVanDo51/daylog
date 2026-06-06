import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { putLocalFile } from '@/lib/uploadFile';
import { extractTakenAt } from '@/lib/exif';
import { useAlbumStore } from '@/stores/albumStore';
import { useUploadStore } from '@/stores/uploadStore';
import { usePendingUploadStore } from '@/stores/pendingUploadStore';
import { runWithConcurrency } from '@/lib/concurrency';

export interface UploadAsset {
  uri: string;
  localAssetId?: string;
  takenAt: string | null;
}

interface PendingAsset extends UploadAsset {
  pendingId: string;
}

export function useUpload() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  const addSynced = useUploadStore((s) => s.addSynced);
  const addPending = usePendingUploadStore((s) => s.addPending);
  const markDone = usePendingUploadStore((s) => s.markDone);
  const markError = usePendingUploadStore((s) => s.markError);
  const clearAll = usePendingUploadStore((s) => s.clearAll);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  async function pickImages(): Promise<UploadAsset[]> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      exif: true,
      quality: 1,
    });
    if (result.canceled) return [];
    return result.assets.map((a) => ({
      uri: a.uri,
      localAssetId: a.assetId ?? undefined,
      takenAt: extractTakenAt(a),
    }));
  }

  async function uploadImages(assets: UploadAsset[], caption?: string): Promise<number> {
    setUploading(true);
    setProgress(0);
    setFailedCount(0);

    const pendingAssets: PendingAsset[] = assets.map((a, i) => ({
      ...a,
      pendingId: `${Date.now()}-${i}`,
    }));

    addPending(pendingAssets.map((a) => ({ id: a.pendingId, localUri: a.uri })));

    let done = 0;
    let failed = 0;

    async function uploadOne(asset: PendingAsset): Promise<void> {
      try {
        const { data: presign } = await api.post('/photos/presign', { album_id: albumId });
        const compressedUri = await compressToWebP(asset.uri);
        const compressedBytes = await putLocalFile(presign.url, compressedUri, 'image/webp');
        await api.post('/photos', {
          album_id: albumId,
          r2_key: presign.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          caption: caption || null,
          local_asset_id: asset.localAssetId ?? null,
        });
        if (asset.localAssetId) {
          addSynced({ localAssetId: asset.localAssetId, compressedBytes });
        }
        markDone(asset.pendingId);
      } catch {
        markError(asset.pendingId);
        failed++;
      } finally {
        done++;
        setProgress(done / assets.length);
      }
    }

    await runWithConcurrency(
      pendingAssets.map((a) => () => uploadOne(a)),
      3,
    );

    qc.invalidateQueries({ queryKey: ['timeline', albumId] });
    setFailedCount(failed);
    setUploading(false);
    setTimeout(() => clearAll(), 400);
    return failed;
  }

  return { pickImages, uploadImages, uploading, progress, failedCount };
}
