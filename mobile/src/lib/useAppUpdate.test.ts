jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
}));
jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { api } from '@/lib/api';
import { useAppUpdate, checkOta } from '@/lib/useAppUpdate';

const mockGet = api.get as jest.Mock;
const mockCheckForUpdate = Updates.checkForUpdateAsync as jest.Mock;
const mockFetchUpdate = Updates.fetchUpdateAsync as jest.Mock;

describe('useAppUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('starts as checking', () => {
    mockGet.mockResolvedValue({ data: { minVersion: '1.0.0', latestVersion: '1.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current).toBe('checking');
  });

  it('returns ok when current version equals minVersion', async () => {
    mockGet.mockResolvedValue({ data: { minVersion: '1.0.0', latestVersion: '1.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('ok'));
  });

  it('returns ok when current version is greater than minVersion', async () => {
    mockGet.mockResolvedValue({ data: { minVersion: '0.9.0', latestVersion: '1.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('ok'));
  });

  it('returns force-update when current version is below minVersion', async () => {
    mockGet.mockResolvedValue({ data: { minVersion: '2.0.0', latestVersion: '2.0.0' } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('force-update'));
  });

  it('returns ok when version check network fails (fail open)', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current).toBe('ok'));
  });
});

describe('checkOta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('shows restart Alert when update is available and downloaded', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: true });
    mockFetchUpdate.mockResolvedValue(undefined);

    await checkOta();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Có bản cập nhật mới',
      'Khởi động lại để áp dụng bản mới nhất?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Để sau' }),
        expect.objectContaining({ text: 'Khởi động lại' }),
      ])
    );
  });

  it('does nothing when no update is available', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: false });

    await checkOta();

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockFetchUpdate).not.toHaveBeenCalled();
  });

  it('fails silently when checkForUpdateAsync throws', async () => {
    mockCheckForUpdate.mockRejectedValue(new Error('No updates URL'));

    await expect(checkOta()).resolves.toBeUndefined();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('calls Updates.reloadAsync when user taps Khởi động lại', async () => {
    mockCheckForUpdate.mockResolvedValue({ isAvailable: true });
    mockFetchUpdate.mockResolvedValue(undefined);
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      const restartBtn = buttons.find((b: any) => b.text === 'Khởi động lại');
      restartBtn?.onPress();
    });

    await checkOta();

    expect(Updates.reloadAsync).toHaveBeenCalled();
  });
});
