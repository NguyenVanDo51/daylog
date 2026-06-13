import { useCallback, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { API_URL } from '@/constants/api';
import { useAuthStore } from '@/stores/authStore';
import { success as successHaptic } from '@/lib/haptics';
import { DayPhoto } from './useDayPhotos';

export type ExportStatus = 'idle' | 'loading' | 'success' | 'permission' | 'error';

export interface UseStoryExport {
  status: ExportStatus;
  error: string | null;
  exportStory: () => Promise<void>;
  reset: () => void;
}

export function useStoryExport(
  photos: DayPhoto[],
  date: string,
  soundtrackId?: string | null,
): UseStoryExport {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const exportStory = useCallback(async () => {
    if (photos.length === 0) return;

    setStatus('loading');
    setError(null);

    const outputPath = `${FileSystem.cacheDirectory}story_${date}.mp4`;

    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('permission');
        return;
      }

      const token = useAuthStore.getState().token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const photoIds = photos.map((p) => p.id).join(',');
      let url = `${API_URL}/stories/export?photo_ids=${encodeURIComponent(photoIds)}`;
      if (soundtrackId) url += `&soundtrack_id=${encodeURIComponent(soundtrackId)}`;

      const result = await FileSystem.downloadAsync(url, outputPath, {
        headers: headers as Record<string, string>,
      });
      if (result.status !== 200) {
        let body = '';
        try { body = await FileSystem.readAsStringAsync(outputPath); } catch { /* ignored */ }
        throw new Error(`HTTP ${result.status}${body ? ` — ${body.slice(0, 300)}` : ''}`);
      }

      await MediaLibrary.Asset.create(outputPath);
      successHaptic();
      setStatus('success');
    } catch (err) {
      console.error('[useStoryExport] failed', err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
    }
  }, [photos, date, soundtrackId]);

  return { status, error, exportStory, reset };
}
