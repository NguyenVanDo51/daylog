jest.mock('@/lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('@/lib/compression', () => ({ compressToWebP: jest.fn().mockResolvedValue('file:///compressed.webp') }));
jest.mock('@/lib/uploadFile', () => ({ putLocalFile: jest.fn().mockResolvedValue(1024) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('expo-video-thumbnails', () => ({ getThumbnailAsync: jest.fn().mockResolvedValue({ uri: 'file:///thumb.jpg' }) }));

import { renderHook, act } from '@testing-library/react-native';
import { useCapture, type UploadResult } from './useCapture';
import { api } from '@/lib/api';
import { putLocalFile } from '@/lib/uploadFile';

const mockApi = api as jest.Mocked<typeof api>;
const mockPut = putLocalFile as jest.MockedFunction<typeof putLocalFile>;

const photoAsset = {
  uri: 'file:///photo.jpg',
  type: 'photo' as const,
  source: 'camera' as const,
  takenAt: '2026-05-21T10:00:00Z',
};

const videoAsset = {
  uri: 'file:///video.mp4',
  type: 'video' as const,
  source: 'camera' as const,
  takenAt: '2026-05-21T10:00:00Z',
  durationMs: 4200,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
});
afterEach(() => jest.restoreAllMocks());

describe('startBackgroundUpload — photo', () => {
  it('presigns without album_id, compresses, uploads, returns r2Key', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { url: 'https://r2/put', key: 'photos/abc.webp' } });
    const { result } = renderHook(() => useCapture());
    let uploadResult: UploadResult | undefined;
    await act(async () => {
      uploadResult = await result.current.startBackgroundUpload(photoAsset);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { content_type: 'image/webp' });
    expect(uploadResult).toEqual({ r2Key: 'photos/abc.webp' });
  });

  it('retries up to 3 times on failure then throws', async () => {
    mockApi.post.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await expect(result.current.startBackgroundUpload(photoAsset)).rejects.toThrow('network');
    });
    expect(mockApi.post).toHaveBeenCalledTimes(3);
  });

  it('resolves on second attempt after one transient failure', async () => {
    mockApi.post
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ data: { url: 'https://r2/put', key: 'photos/retry.webp' } });
    const { result } = renderHook(() => useCapture());
    let uploadResult: UploadResult | undefined;
    await act(async () => {
      uploadResult = await result.current.startBackgroundUpload(photoAsset);
    });
    expect(mockApi.post).toHaveBeenCalledTimes(2);
    expect(uploadResult).toEqual({ r2Key: 'photos/retry.webp' });
  });
});

describe('startBackgroundUpload — video', () => {
  it('presigns video and thumbnail in parallel, uploads both, returns r2Key and thumbnailR2Key', async () => {
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://r2/video', key: 'photos/vid.mp4' } })
      .mockResolvedValueOnce({ data: { url: 'https://r2/thumb', key: 'photos/thumb.jpeg' } });
    const { result } = renderHook(() => useCapture());
    let uploadResult: UploadResult | undefined;
    await act(async () => {
      uploadResult = await result.current.startBackgroundUpload(videoAsset);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { content_type: 'video/mp4' });
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { content_type: 'image/jpeg' });
    expect(mockPut).toHaveBeenCalledWith('https://r2/video', 'file:///video.mp4', 'video/mp4');
    expect(mockPut).toHaveBeenCalledWith('https://r2/thumb', 'file:///thumb.jpg', 'image/jpeg');
    expect(uploadResult).toEqual({ r2Key: 'photos/vid.mp4', thumbnailR2Key: 'photos/thumb.jpeg' });
  });
});

describe('finishCapture', () => {
  it('posts /photos with r2Key, albumIds, and photo metadata', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'photo-1' } });
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.finishCapture({ r2Key: 'photos/abc.webp' }, photoAsset, ['album-1', 'album-2']);
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos', expect.objectContaining({
      album_ids: ['album-1', 'album-2'],
      r2_key: 'photos/abc.webp',
      media_type: 'photo',
      source: 'capture',
    }));
  });

  it('includes thumbnail_r2_key and duration_ms for video', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'photo-2' } });
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.finishCapture(
        { r2Key: 'photos/vid.mp4', thumbnailR2Key: 'photos/thumb.jpeg' },
        videoAsset,
        ['album-1'],
      );
    });
    expect(mockApi.post).toHaveBeenCalledWith('/photos', expect.objectContaining({
      media_type: 'video',
      thumbnail_r2_key: 'photos/thumb.jpeg',
      duration_ms: 4200,
    }));
  });
});
