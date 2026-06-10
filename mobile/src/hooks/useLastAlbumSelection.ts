import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'photo_review_last_album_ids';

export function useLastAlbumSelection() {
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setSavedIds(raw ? JSON.parse(raw) : []))
      .catch(() => setSavedIds([]));
  }, []);

  const persist = useCallback(
    (ids: string[]) => AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {}),
    [],
  );

  return { savedIds, persist };
}
