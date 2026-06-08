import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
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
    const tempDir = `${FileSystem.cacheDirectory}export_${date}/`;
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

      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const token = useAuthStore.getState().token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const localPaths: { path: string; mediaType: 'photo' | 'video' }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const ext = photo.media_type === 'video' ? 'mp4' : 'webp';
        const filename = `${i.toString().padStart(3, '0')}_${photo.id}.${ext}`;
        const localPath = `${tempDir}${filename}`;
        const result = await FileSystem.downloadAsync(
          `${API_URL}/photos/${photo.id}/full`,
          localPath,
          { headers },
        );
        if (result.status !== 200) throw new Error(`Download failed: ${photo.id}`);
        localPaths.push({ path: localPath, mediaType: photo.media_type });
      }

      // Build filter_complex: scale/pad each input, then concat
      const filterParts: string[] = [];
      const ffArgs: string[] = [];

      for (let i = 0; i < localPaths.length; i++) {
        const { path, mediaType } = localPaths[i];
        if (mediaType === 'photo') {
          ffArgs.push('-loop', '1', '-t', '3', '-i', path);
        } else {
          ffArgs.push('-i', path);
        }
        filterParts.push(
          `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
          `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`,
        );
      }

      const concatInputs = localPaths.map((_, i) => `[v${i}]`).join('');
      const filterComplex = [
        ...filterParts,
        `${concatInputs}concat=n=${localPaths.length}:v=1:a=0[out]`,
      ].join('; ');

      const session = await FFmpegKit.executeWithArguments([
        ...ffArgs,
        '-filter_complex', filterComplex,
        '-map', '[out]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', '30',
        '-an',
        '-y', outputPath,
      ]);
      const returnCode = await session.getReturnCode();
      if (!ReturnCode.isSuccess(returnCode)) throw new Error('FFmpeg failed');

      await MediaLibrary.saveToLibraryAsync(outputPath);
      success();
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất video. Thử lại nhé.');
    } finally {
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
      setExporting(false);
    }
  }

  return { exporting, exportStory };
}
