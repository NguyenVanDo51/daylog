import { renderHook, act } from '@testing-library/react-native';
import { useCapture } from './useCapture';
import { useCaptureStore } from '@/stores/captureStore';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
  },
}));
jest.mock('@/lib/compression', () => ({
  compressToWebP: jest.fn().mockResolvedValue('file:///compressed.webp'),
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(() => 'album-uuid-123'),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.startsWith('file://')) {
    return Promise.resolve({
      blob: () => Promise.resolve(new Blob(['data'], { type: 'image/webp' })),
    });
  }
  return Promise.resolve({ ok: true });
}) as jest.Mock;

describe('useCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCaptureStore.setState({ lastCaptureAt: null, pendingAsset: null });
  });

  it('canCapture is true when no prior capture', () => {
    const { result } = renderHook(() => useCapture());
    expect(result.current.canCapture).toBe(true);
  });

  it('canCapture is false within 30-min cooldown', () => {
    useCaptureStore.setState({ lastCaptureAt: Date.now() - 5 * 60 * 1000 });
    const { result } = renderHook(() => useCapture());
    expect(result.current.canCapture).toBe(false);
  });

  it('canCapture is true after 30-min cooldown expires', () => {
    useCaptureStore.setState({ lastCaptureAt: Date.now() - 31 * 60 * 1000 });
    const { result } = renderHook(() => useCapture());
    expect(result.current.canCapture).toBe(true);
  });

  it('capture photo: presigns, uploads, POSTs, updates lastCaptureAt', async () => {
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://r2.test/upload', key: 'photos/test.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-id-1', source: 'capture', media_type: 'photo' } });

    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.capture({ type: 'photo', uri: 'file:///photo.jpg' }, 'caption test');
    });

    expect(mockApi.post).toHaveBeenNthCalledWith(
      1,
      '/photos/presign',
      { album_id: 'album-uuid-123', content_type: 'image/webp' }
    );
    expect(mockApi.post).toHaveBeenNthCalledWith(
      2,
      '/photos',
      expect.objectContaining({ source: 'capture', media_type: 'photo', caption: 'caption test' })
    );
    expect(useCaptureStore.getState().lastCaptureAt).not.toBeNull();
  });

  it('capture video: presigns twice, uploads both, POSTs with duration_ms', async () => {
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://r2.test/video', key: 'photos/test.mp4' } })
      .mockResolvedValueOnce({ data: { url: 'https://r2.test/thumb', key: 'photos/test-thumb.jpg' } })
      .mockResolvedValueOnce({ data: { id: 'photo-id-2', source: 'capture', media_type: 'video' } });

    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.capture({ type: 'video', uri: 'file:///video.mp4', durationMs: 1800 });
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/photos/presign',
      { album_id: 'album-uuid-123', content_type: 'video/mp4' }
    );
    expect(mockApi.post).toHaveBeenCalledWith(
      '/photos/presign',
      { album_id: 'album-uuid-123', content_type: 'image/jpeg' }
    );
    expect(mockApi.post).toHaveBeenCalledWith(
      '/photos',
      expect.objectContaining({ media_type: 'video', duration_ms: 1800 })
    );
  });
});
