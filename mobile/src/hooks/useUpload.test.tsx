jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));
jest.mock('@/lib/compression', () => ({
  compressToWebP: jest.fn(),
}));
jest.mock('@/lib/exif', () => ({
  extractTakenAt: jest.fn(),
}));
jest.mock('@/lib/uploadFile', () => ({
  putLocalFile: jest.fn(),
}));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useUpload, type UploadAsset } from '@/hooks/useUpload';
import { usePendingUploadStore } from '@/stores/pendingUploadStore';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { compressToWebP } from '@/lib/compression';
import { extractTakenAt } from '@/lib/exif';
import { putLocalFile } from '@/lib/uploadFile';

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;
const mockCompress = compressToWebP as jest.MockedFunction<typeof compressToWebP>;
const mockExtractTakenAt = extractTakenAt as jest.MockedFunction<typeof extractTakenAt>;
const mockPutLocalFile = putLocalFile as jest.MockedFunction<typeof putLocalFile>;
const mockLaunchImageLibrary =
  ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
    typeof ImagePicker.launchImageLibraryAsync
  >;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function installUploadMock(opts: { putOk?: boolean; putReject?: boolean; size?: number } = {}) {
  const { putOk = true, putReject = false, size = 1234 } = opts;
  if (putReject) {
    mockPutLocalFile.mockRejectedValue(new Error('network failure'));
  } else if (!putOk) {
    mockPutLocalFile.mockRejectedValue(new Error('Upload failed: 500'));
  } else {
    mockPutLocalFile.mockResolvedValue(size);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  usePendingUploadStore.setState({ pendingPhotos: [] });
  mockUseAlbumStore.mockImplementation(
    (selector: (s: { albumId: string | null }) => unknown) =>
      selector({ albumId: 'album-42' }),
  );
  mockCompress.mockResolvedValue('file://compressed.webp');
  mockExtractTakenAt.mockReturnValue('2025-01-01T00:00:00.000Z');
  mockPutLocalFile.mockReset();
});

describe('useUpload', () => {
  test('successful single upload calls presign, PUT, and registers photo', async () => {
    installUploadMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://signed/x', key: 'photos/abc.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-1' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    const asset: UploadAsset = {
      uri: 'file://input.jpg',
      localAssetId: 'asset-1',
      takenAt: '2025-03-04T05:06:07.000Z',
    };

    await act(async () => { await result.current.uploadImages([asset], 'hello'); });

    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign', { album_id: 'album-42' });
    expect(mockCompress).toHaveBeenCalledWith('file://input.jpg');
    expect(mockPutLocalFile).toHaveBeenCalledWith(
      'https://signed/x',
      'file://compressed.webp',
      'image/webp',
    );
    expect(mockApi.post).toHaveBeenCalledWith('/photos', {
      album_id: 'album-42',
      r2_key: 'photos/abc.webp',
      taken_at: '2025-03-04T05:06:07.000Z',
      caption: 'hello',
      local_asset_id: 'asset-1',
    });
    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.progress).toBe(1);
  });

  test('caption defaults to null and takenAt falls back to now when asset.takenAt is null', async () => {
    installUploadMock({ putOk: true });
    const fixedNow = '2030-06-01T12:00:00.000Z';
    const dateSpy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedNow);
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://signed/y', key: 'photos/def.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-2' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://x.jpg', takenAt: null }]);
    });

    expect(mockApi.post).toHaveBeenCalledWith('/photos', {
      album_id: 'album-42',
      r2_key: 'photos/def.webp',
      taken_at: fixedNow,
      caption: null,
      local_asset_id: null,
    });
    dateSpy.mockRestore();
  });

  test('compressed uri is fed to upload (not the raw asset uri)', async () => {
    installUploadMock({ putOk: true });
    mockCompress.mockResolvedValueOnce('file://compressed-special.webp');
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://signed/c', key: 'photos/c.webp' } })
      .mockResolvedValueOnce({ data: { id: 'photo-3' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://original.heic', takenAt: null }]);
    });

    expect(mockCompress).toHaveBeenCalledWith('file://original.heic');
    expect(mockPutLocalFile).toHaveBeenCalledWith(
      'https://signed/c',
      'file://compressed-special.webp',
      'image/webp',
    );
    expect(mockPutLocalFile).not.toHaveBeenCalledWith(
      expect.any(String),
      'file://original.heic',
      expect.any(String),
    );
  });

  test('presign failure increments failedCount — upload resolves, does not throw', async () => {
    installUploadMock({ putOk: true });
    mockApi.post.mockRejectedValue(new Error('presign failed'));

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://a.jpg', takenAt: null }]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
    expect(result.current.progress).toBe(1);
  });

  test('PUT failure increments failedCount — upload resolves, does not throw', async () => {
    installUploadMock({ putReject: true });
    mockApi.post.mockResolvedValue({ data: { url: 'https://s/z', key: 'photos/z.webp' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://b.jpg', takenAt: null }]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
  });

  test('register failure increments failedCount — upload resolves, does not throw', async () => {
    installUploadMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({ data: { url: 'https://s/q', key: 'photos/q.webp' } })
      .mockRejectedValueOnce(new Error('register failed'));

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([{ uri: 'file://c.jpg', takenAt: null }]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
  });

  test('failed assets do not stop successful assets from uploading', async () => {
    installUploadMock({ putOk: true });
    let presignCount = 0;
    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') {
        presignCount++;
        if (presignCount === 1) throw new Error('first presign fails');
        return { data: { url: 'https://s/ok', key: 'photos/ok.webp' } };
      }
      return { data: { id: 'photo-ok' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://fail.jpg', takenAt: null },
        { uri: 'file://ok.jpg', takenAt: null },
      ]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.failedCount).toBe(1);
    expect(mockApi.post).toHaveBeenCalledWith('/photos', expect.objectContaining({ r2_key: 'photos/ok.webp' }));
  });

  test('all assets are processed and progress reaches 1 regardless of failures', async () => {
    installUploadMock({ putReject: true });
    mockApi.post.mockResolvedValue({ data: { url: 'https://s/x', key: 'photos/x.webp' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://1.jpg', takenAt: null },
        { uri: 'file://2.jpg', takenAt: null },
        { uri: 'file://3.jpg', takenAt: null },
      ]);
    });

    await waitFor(() => expect(result.current.progress).toBe(1));
    expect(result.current.failedCount).toBe(3);
    expect(result.current.uploading).toBe(false);
  });

  test('multiple successful assets: each presigned, uploaded, and registered', async () => {
    installUploadMock({ putOk: true });
    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') return { data: { url: 'https://s/upload', key: 'photos/out.webp' } };
      return { data: { id: 'new-photo' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    const assets: UploadAsset[] = [
      { uri: 'file://1.jpg', takenAt: '2025-01-01T00:00:00.000Z' },
      { uri: 'file://2.jpg', takenAt: '2025-01-02T00:00:00.000Z' },
      { uri: 'file://3.jpg', takenAt: '2025-01-03T00:00:00.000Z' },
    ];

    await act(async () => { await result.current.uploadImages(assets); });

    expect(mockApi.post.mock.calls.filter((c) => c[0] === '/photos/presign')).toHaveLength(3);
    expect(mockApi.post.mock.calls.filter((c) => c[0] === '/photos')).toHaveLength(3);
    expect(mockPutLocalFile).toHaveBeenCalledTimes(3);

    await waitFor(() => expect(result.current.progress).toBe(1));
    expect(result.current.uploading).toBe(false);
    expect(result.current.failedCount).toBe(0);
  });

  test('addPending is called with all assets before any upload starts', async () => {
    installUploadMock({ putOk: true });

    const originalAddPending = usePendingUploadStore.getState().addPending;
    const addPendingSpy = jest.fn((...args: Parameters<typeof originalAddPending>) => {
      return originalAddPending(...args);
    });
    usePendingUploadStore.setState({ addPending: addPendingSpy } as any);

    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') return { data: { url: 'https://s/x', key: 'k.webp' } };
      return { data: { id: 'p' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://a.jpg', takenAt: null },
        { uri: 'file://b.jpg', takenAt: null },
      ]);
    });

    expect(addPendingSpy).toHaveBeenCalledTimes(1);
    const addPendingArg = addPendingSpy.mock.calls[0][0] as Array<{ localUri: string }>;
    expect(addPendingArg.map((p) => p.localUri)).toEqual(['file://a.jpg', 'file://b.jpg']);
  });

  test('markDone is called for each successful asset, markError for each failed asset', async () => {
    installUploadMock({ putOk: true });
    let presignCount = 0;
    mockApi.post.mockImplementation(async (path: string) => {
      if (path === '/photos/presign') {
        presignCount++;
        if (presignCount === 2) throw new Error('fail');
        return { data: { url: 'https://s/x', key: 'k.webp' } };
      }
      return { data: { id: 'p' } };
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://a.jpg', takenAt: null },
        { uri: 'file://b.jpg', takenAt: null },
        { uri: 'file://c.jpg', takenAt: null },
      ]);
    });

    await waitFor(() => expect(result.current.uploading).toBe(false));

    const photos = usePendingUploadStore.getState().pendingPhotos;
    const doneCount = photos.filter((p) => p.status === 'done').length;
    const errorCount = photos.filter((p) => p.status === 'error').length;
    expect(doneCount).toBe(2);
    expect(errorCount).toBe(1);
  });

  test('pickImages returns mapped assets from ImagePicker result', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file://p1.jpg', assetId: 'aid-1', exif: { DateTimeOriginal: '2024:10:15 14:30:00' } },
        { uri: 'file://p2.jpg', assetId: null, exif: null },
      ],
    } as unknown as ImagePicker.ImagePickerResult);
    mockExtractTakenAt
      .mockReturnValueOnce('2024-10-15T14:30:00.000Z')
      .mockReturnValueOnce(null);

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    let picked: UploadAsset[] = [];
    await act(async () => { picked = await result.current.pickImages(); });

    expect(picked).toEqual([
      { uri: 'file://p1.jpg', localAssetId: 'aid-1', takenAt: '2024-10-15T14:30:00.000Z' },
      { uri: 'file://p2.jpg', localAssetId: undefined, takenAt: null },
    ]);
  });

  test('pickImages returns empty array when picker is canceled', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: true,
    } as unknown as ImagePicker.ImagePickerResult);

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    let picked: UploadAsset[] = [{ uri: 'sentinel', takenAt: null }];
    await act(async () => { picked = await result.current.pickImages(); });
    expect(picked).toEqual([]);
  });
});
