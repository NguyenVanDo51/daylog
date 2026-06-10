jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLastAlbumSelection } from './useLastAlbumSelection';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useLastAlbumSelection', () => {
  it('starts as null then resolves to saved ids', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['album-1', 'album-2']));
    const { result } = renderHook(() => useLastAlbumSelection());
    expect(result.current.savedIds).toBeNull();
    await waitFor(() => expect(result.current.savedIds).toEqual(['album-1', 'album-2']));
  });

  it('resolves to empty array when key not set', async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
  });

  it('falls back to empty array on AsyncStorage read error', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
  });

  it('persist writes ids to AsyncStorage as JSON', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
    await act(async () => { await result.current.persist(['album-3', 'album-4']); });
    expect(mockSetItem).toHaveBeenCalledWith(
      'photo_review_last_album_ids',
      '["album-3","album-4"]',
    );
  });

  it('persist does not throw when AsyncStorage write fails', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockRejectedValue(new Error('write failed'));
    const { result } = renderHook(() => useLastAlbumSelection());
    await waitFor(() => expect(result.current.savedIds).toEqual([]));
    await expect(result.current.persist(['album-1'])).resolves.toBeUndefined();
  });
});
