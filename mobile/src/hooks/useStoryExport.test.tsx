jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn(),
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  Asset: { create: jest.fn() },
}));
jest.mock('@/constants/api', () => ({ API_URL: 'https://api.example' }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ token: 'jwt-tok' }) },
}));
jest.mock('@/lib/haptics', () => ({ success: jest.fn() }));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useStoryExport } from '@/hooks/useStoryExport';
import { success as successHaptic } from '@/lib/haptics';
import type { DayPhoto } from '@/hooks/useDayPhotos';

const fs = FileSystem as unknown as {
  downloadAsync: jest.Mock;
  deleteAsync: jest.Mock;
  readAsStringAsync: jest.Mock;
};
const ml = MediaLibrary as unknown as {
  requestPermissionsAsync: jest.Mock;
  Asset: { create: jest.Mock };
};

function makePhotos(n: number): DayPhoto[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    media_type: 'photo',
    duration_ms: null,
    taken_at: `2026-06-13T0${i}:00:00.000Z`,
    caption: null,
    uploaded_by: 'u-1',
    photo_url: `https://r2/p${i + 1}.webp`,
    thumb_url: null,
  }));
}

beforeEach(() => {
  fs.downloadAsync.mockReset();
  fs.deleteAsync.mockReset().mockResolvedValue(undefined);
  fs.readAsStringAsync.mockReset();
  ml.requestPermissionsAsync.mockReset();
  ml.Asset.create.mockReset();
  (successHaptic as jest.Mock).mockReset();
});

describe('useStoryExport', () => {
  test('does nothing when photos array is empty', async () => {
    const { result } = renderHook(() => useStoryExport([], '2026-06-13'));
    await act(async () => { await result.current.exportStory(); });
    expect(result.current.status).toBe('idle');
    expect(fs.downloadAsync).not.toHaveBeenCalled();
  });

  test('sets permission status when MediaLibrary permission is denied', async () => {
    ml.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const { result } = renderHook(() => useStoryExport(makePhotos(1), '2026-06-13'));
    await act(async () => { await result.current.exportStory(); });
    expect(result.current.status).toBe('permission');
    expect(fs.downloadAsync).not.toHaveBeenCalled();
  });

  test('downloads the story, saves to MediaLibrary, fires haptic on success', async () => {
    ml.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    fs.downloadAsync.mockResolvedValueOnce({ status: 200 });
    ml.Asset.create.mockResolvedValueOnce({});
    const photos = makePhotos(3);
    const { result } = renderHook(() => useStoryExport(photos, '2026-06-13'));
    await act(async () => { await result.current.exportStory(); });

    const call = fs.downloadAsync.mock.calls[0];
    expect(call[0]).toBe('https://api.example/stories/export?photo_ids=p1%2Cp2%2Cp3');
    expect(call[1]).toBe('file:///cache/story_2026-06-13.mp4');
    expect(call[2].headers).toEqual({ Authorization: 'Bearer jwt-tok' });
    expect(ml.Asset.create).toHaveBeenCalledWith('file:///cache/story_2026-06-13.mp4');
    expect(successHaptic).toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///cache/story_2026-06-13.mp4', { idempotent: true });
  });

  test('appends soundtrack_id when provided', async () => {
    ml.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    fs.downloadAsync.mockResolvedValueOnce({ status: 200 });
    ml.Asset.create.mockResolvedValueOnce({});
    const { result } = renderHook(() => useStoryExport(makePhotos(1), '2026-06-13', 'snd-xyz'));
    await act(async () => { await result.current.exportStory(); });
    expect(fs.downloadAsync.mock.calls[0][0]).toBe(
      'https://api.example/stories/export?photo_ids=p1&soundtrack_id=snd-xyz',
    );
  });

  test('sets error state and reads body on non-200', async () => {
    ml.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    fs.downloadAsync.mockResolvedValueOnce({ status: 500 });
    fs.readAsStringAsync.mockResolvedValueOnce('upstream failed');
    const { result } = renderHook(() => useStoryExport(makePhotos(1), '2026-06-13'));
    await act(async () => { await result.current.exportStory(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/HTTP 500/);
    expect(result.current.error).toMatch(/upstream failed/);
    expect(fs.deleteAsync).toHaveBeenCalled();
  });

  test('reset returns to idle and clears error', async () => {
    ml.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    fs.downloadAsync.mockResolvedValueOnce({ status: 500 });
    fs.readAsStringAsync.mockResolvedValueOnce('');
    const { result } = renderHook(() => useStoryExport(makePhotos(1), '2026-06-13'));
    await act(async () => { await result.current.exportStory(); });
    expect(result.current.status).toBe('error');
    await act(async () => { result.current.reset(); });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBeNull();
  });

  test('handles downloadAsync rejection as error', async () => {
    ml.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    fs.downloadAsync.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useStoryExport(makePhotos(1), '2026-06-13'));
    await act(async () => { await result.current.exportStory(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('network down');
  });
});
