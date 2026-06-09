import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import semver from 'semver';
import { api } from '@/lib/api';

export type UpdateStatus = 'checking' | 'force-update' | 'ok';

export async function checkOta(): Promise<void> {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) return;
    await Updates.fetchUpdateAsync();
    Alert.alert(
      'Có bản cập nhật mới',
      'Khởi động lại để áp dụng bản mới nhất?',
      [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Khởi động lại', onPress: () => Updates.reloadAsync() },
      ]
    );
  } catch {
    // silent — OTA is best-effort
  }
}

async function checkVersion(setStatus: (s: UpdateStatus) => void): Promise<void> {
  try {
    const { data } = await api.get<{ minVersion: string; latestVersion: string }>('/version');
    const current = Application.nativeApplicationVersion ?? '0.0.0';
    if (semver.lt(current, data.minVersion)) {
      setStatus('force-update');
    } else {
      setStatus('ok');
    }
  } catch {
    // Fail open — network error should not block the user
    setStatus('ok');
  }
}

export function useAppUpdate(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>('checking');

  useEffect(() => {
    checkVersion(setStatus);
    if (!__DEV__) checkOta();
  }, []);

  return status;
}
