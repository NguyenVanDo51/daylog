import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'photo_review_last_album_ids';

export function useLastAlbumSelection() {
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return setSavedIds([]);
        const parsed = JSON.parse(raw);
        setSavedIds(Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === 'string') : []);
      })
      .catch(() => setSavedIds([]));
  }, []);

  const persist = useCallback(
    (ids: string[]) => AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {}),
    [],
  );

  return { savedIds, persist };
}
