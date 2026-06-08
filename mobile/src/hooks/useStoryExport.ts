import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { success } from '@/lib/haptics';
import { DayPhoto } from './useDayPhotos';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function useStoryExport(photos: DayPhoto[], date: string) {
  const [exporting, setExporting] = useState(false);

  async function exportStory() {
    setExporting(true);
    if (photos.length === 0) {
      setExporting(false);
      return;
    }

    const outputPath = `${FileSystem.cacheDirectory}story_${date}.mp4`;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Cần quyền truy cập',
          'Cần quyền truy cập Ảnh. Vui lòng bật trong Cài đặt.',
        );
        return;
      }

      const token = useAuthStore.getState().token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const photoIds = photos.map((p) => p.id).join(',');
      const url = `${API_URL}/stories/export?photo_ids=${encodeURIComponent(photoIds)}`;

      const result = await FileSystem.downloadAsync(url, outputPath, { headers });
      if (result.status !== 200) throw new Error(`Export failed: ${result.status}`);

      await MediaLibrary.saveToLibraryAsync(outputPath);
      success();
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất video. Thử lại nhé.');
    } finally {
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
      setExporting(false);
    }
  }

  return { exporting, exportStory };
}
