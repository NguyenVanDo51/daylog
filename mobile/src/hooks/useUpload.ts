import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { compressToWebP } from '@/lib/compression';
import { extractTakenAt } from '@/lib/exif';
import { useAlbumStore } from '@/stores/albumStore';
import { useUploadStore } from '@/stores/uploadStore';

export interface UploadAsset {
  uri: string;
  localAssetId?: string;
  takenAt: string | null;
}

export function useUpload() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  const addSynced = useUploadStore((s) => s.addSynced);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

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

  async function uploadImages(assets: UploadAsset[], caption?: string) {
    setUploading(true);
    setProgress(0);
    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        // 1. Presign
        const { data: presign } = await api.post('/photos/presign', { album_id: albumId });
        // 2. Compress
        const compressedUri = await compressToWebP(asset.uri);
        // 3. Upload to R2
        const blob = await fetch(compressedUri).then((r) => r.blob());
        await fetch(presign.url, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/webp' },
        });
        // 4. Register
        await api.post('/photos', {
          album_id: albumId,
          r2_key: presign.key,
          taken_at: asset.takenAt ?? new Date().toISOString(),
          caption: caption || null,
          local_asset_id: asset.localAssetId ?? null,
        });
        // 5. Track synced photo for Storage Freedom
        if (asset.localAssetId) {
          addSynced({ localAssetId: asset.localAssetId, compressedBytes: blob.size });
        }
        setProgress((i + 1) / assets.length);
      }
      qc.invalidateQueries({ queryKey: ['timeline', albumId] });
    } finally {
      setUploading(false);
    }
  }

  return { pickImages, uploadImages, uploading, progress };
}
