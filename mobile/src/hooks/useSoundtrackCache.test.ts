jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(),
}));
jest.mock('@/constants/api', () => ({ API_URL: 'https://api.example' }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ token: 'tok' }) },
}));

import * as FileSystem from 'expo-file-system/legacy';
import { ensureSoundtrackCached } from '@/hooks/useSoundtrackCache';

const fs = FileSystem as unknown as {
  getInfoAsync: jest.Mock;
  makeDirectoryAsync: jest.Mock;
  downloadAsync: jest.Mock;
};

beforeEach(() => {
  fs.getInfoAsync.mockReset();
  fs.makeDirectoryAsync.mockReset().mockResolvedValue(undefined);
  fs.downloadAsync.mockReset();
});

describe('ensureSoundtrackCached', () => {
  test('returns local URI without downloading when file exists', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true });
    const uri = await ensureSoundtrackCached('lullaby_01');
    expect(uri).toBe('file:///cache/soundtracks/lullaby_01.mp3');
    expect(fs.downloadAsync).not.toHaveBeenCalled();
  });

  test('downloads when missing and returns local URI', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false });
    fs.downloadAsync.mockResolvedValueOnce({ status: 200 });
    const uri = await ensureSoundtrackCached('lullaby_01');
    expect(uri).toBe('file:///cache/soundtracks/lullaby_01.mp3');
    expect(fs.downloadAsync).toHaveBeenCalledWith(
      'https://api.example/soundtracks/lullaby_01/file',
      'file:///cache/soundtracks/lullaby_01.mp3',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  test('throws when download returns non-200', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false });
    fs.downloadAsync.mockResolvedValueOnce({ status: 500 });
    await expect(ensureSoundtrackCached('x')).rejects.toThrow();
  });
});
