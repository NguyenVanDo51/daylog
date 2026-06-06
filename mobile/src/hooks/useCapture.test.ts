import { renderHook, act } from '@testing-library/react-native';
import { useCapture } from './useCapture';

jest.mock('@/lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('@/lib/compression', () => ({ compressToWebP: jest.fn().mockResolvedValue('file:///compressed.webp') }));
jest.mock('@/lib/uploadFile', () => ({ putLocalFile: jest.fn().mockResolvedValue(1024) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('useCapture', () => {
  beforeEach(() => jest.clearAllMocks());

  it('canCapture is always true (no cooldown)', () => {
    const { result } = renderHook(() => useCapture());
    expect(result.current.canCapture).toBe(true);
  });

  it('posts photo with album_ids array', async () => {
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://r2.example.com/put', key: 'photos/abc.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-1', r2_key: 'photos/abc.webp' } });

    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.capture(
        { uri: 'file:///photo.jpg', type: 'photo', source: 'camera', takenAt: '2026-05-21T10:00:00Z' },
        ['album-1', 'album-2']
      );
    });

    expect(mockApi.post).toHaveBeenNthCalledWith(1, '/photos/presign', {
      album_id: 'album-1',
      content_type: 'image/webp',
    });
    expect(mockApi.post).toHaveBeenNthCalledWith(2, '/photos', expect.objectContaining({
      album_ids: ['album-1', 'album-2'],
      media_type: 'photo',
    }));
  });

  it('throws when no album selected', async () => {
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await expect(
        result.current.capture(
          { uri: 'file:///photo.jpg', type: 'photo', source: 'camera', takenAt: '2026-05-21T10:00:00Z' },
          []
        )
      ).rejects.toThrow('No album selected');
    });
  });
});
