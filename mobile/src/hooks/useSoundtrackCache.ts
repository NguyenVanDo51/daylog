import * as FileSystem from 'expo-file-system/legacy';
import { API_URL } from '@/constants/api';
import { useAuthStore } from '@/stores/authStore';

const CACHE_DIR = `${FileSystem.cacheDirectory}soundtracks/`;

export async function ensureSoundtrackCached(key: string): Promise<string> {
  const localUri = `${CACHE_DIR}${key}.mp3`;
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) return localUri;

  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  const token = useAuthStore.getState().token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const result = await FileSystem.downloadAsync(
    `${API_URL}/soundtracks/${encodeURIComponent(key)}/file`,
    localUri,
    { headers },
  );
  if (result.status !== 200) throw new Error(`fetch soundtrack ${key} failed (${result.status})`);
  return localUri;
}

export function useSoundtrackCache() {
  return { ensure: ensureSoundtrackCached };
}
