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

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useUpload, type UploadAsset } from '@/hooks/useUpload';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { compressToWebP } from '@/lib/compression';
import { extractTakenAt } from '@/lib/exif';

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;
const mockCompress = compressToWebP as jest.MockedFunction<typeof compressToWebP>;
const mockExtractTakenAt = extractTakenAt as jest.MockedFunction<typeof extractTakenAt>;
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

const fakeBlob = { size: 1234, type: 'image/webp' } as unknown as Blob;

/**
 * The hook calls `fetch(compressedUri).then(r => r.blob())` first, then
 * `fetch(presign.url, { method: 'PUT', ... })`. This helper installs a
 * jest.fn() that handles both calls based on whether the second arg is given.
 */
function installFetchMock(opts: { putOk?: boolean; putReject?: boolean } = {}) {
  const { putOk = true, putReject = false } = opts;
  const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (!init) {
      // Initial fetch for the local file → blob.
      return Promise.resolve({
        blob: () => Promise.resolve(fakeBlob),
        ok: true,
        status: 200,
      });
    }
    // PUT to R2.
    if (putReject) return Promise.reject(new Error('network failure'));
    return Promise.resolve({ ok: putOk, status: putOk ? 200 : 500 });
  });
  // @ts-expect-error: assigning to global.fetch for tests.
  global.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAlbumStore.mockImplementation(
    (selector: (s: { albumId: string | null }) => unknown) =>
      selector({ albumId: 'album-42' }),
  );
  mockCompress.mockResolvedValue('file://compressed.webp');
  mockExtractTakenAt.mockReturnValue('2025-01-01T00:00:00.000Z');
});

describe('useUpload', () => {
  test('successful upload calls /photos/presign, PUTs to signed URL, then POSTs /photos', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({
        data: { url: 'https://signed/x', key: 'photos/abc.webp' },
      })
      .mockResolvedValueOnce({ data: { id: 'photo-1' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    const asset: UploadAsset = {
      uri: 'file://input.jpg',
      localAssetId: 'asset-1',
      takenAt: '2025-03-04T05:06:07.000Z',
    };

    await act(async () => {
      await result.current.uploadImages([asset], 'hello');
    });

    // Presign call
    expect(mockApi.post).toHaveBeenNthCalledWith(1, '/photos/presign');
    // Compression call uses the asset uri
    expect(mockCompress).toHaveBeenCalledWith('file://input.jpg');
    // Two fetch calls: one to read the compressed file as blob, one PUT to signed URL.
    expect(fetchMock).toHaveBeenCalledWith('file://compressed.webp');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed/x',
      expect.objectContaining({
        method: 'PUT',
        body: fakeBlob,
        headers: { 'Content-Type': 'image/webp' },
      }),
    );
    // Register photo
    expect(mockApi.post).toHaveBeenNthCalledWith(2, '/photos', {
      album_id: 'album-42',
      r2_key: 'photos/abc.webp',
      taken_at: '2025-03-04T05:06:07.000Z',
      caption: 'hello',
      local_asset_id: 'asset-1',
    });

    // uploading flag returns to false; progress hits 1.
    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.progress).toBe(1);
  });

  test('upload defaults: caption null and taken_at falls back to now when asset.takenAt is null', async () => {
    installFetchMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({
        data: { url: 'https://signed/y', key: 'photos/def.webp' },
      })
      .mockResolvedValueOnce({ data: { id: 'photo-2' } });

    const fixedNow = '2030-06-01T12:00:00.000Z';
    const dateSpy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedNow);

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://x.jpg', takenAt: null },
      ]);
    });

    expect(mockApi.post).toHaveBeenNthCalledWith(2, '/photos', {
      album_id: 'album-42',
      r2_key: 'photos/def.webp',
      taken_at: fixedNow,
      caption: null,
      local_asset_id: null,
    });

    dateSpy.mockRestore();
  });

  test('presign failure rejects and does NOT call /photos', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockApi.post.mockRejectedValueOnce(new Error('presign failed'));

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(
        result.current.uploadImages([
          { uri: 'file://a.jpg', takenAt: null },
        ]),
      ).rejects.toThrow('presign failed');
    });

    // Only the presign call was made.
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign');
    // No PUT happened (fetch may have been called 0 or 1 time for blob — but never as PUT).
    const putCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT');
    expect(putCalls).toHaveLength(0);

    // uploading returns to false even on failure (finally block).
    await waitFor(() => expect(result.current.uploading).toBe(false));
  });

  test('PUT to R2 rejecting causes upload to fail and /photos NOT called', async () => {
    installFetchMock({ putReject: true });
    mockApi.post.mockResolvedValueOnce({
      data: { url: 'https://signed/z', key: 'photos/zzz.webp' },
    });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(
        result.current.uploadImages([
          { uri: 'file://b.jpg', takenAt: null },
        ]),
      ).rejects.toThrow('network failure');
    });

    // Only the presign was called; /photos registration was NOT.
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(mockApi.post).toHaveBeenCalledWith('/photos/presign');
    await waitFor(() => expect(result.current.uploading).toBe(false));
  });

  test('photo registration failure surfaces as a rejection', async () => {
    installFetchMock({ putOk: true });
    mockApi.post
      .mockResolvedValueOnce({
        data: { url: 'https://signed/q', key: 'photos/q.webp' },
      })
      .mockRejectedValueOnce(new Error('register failed'));

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(
        result.current.uploadImages([
          { uri: 'file://c.jpg', takenAt: null },
        ]),
      ).rejects.toThrow('register failed');
    });

    expect(mockApi.post).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.uploading).toBe(false));
  });

  test('compression is used: the compressed uri is fed to fetch (not the raw asset uri)', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockCompress.mockResolvedValueOnce('file://compressed-special.webp');
    mockApi.post
      .mockResolvedValueOnce({
        data: { url: 'https://signed/c', key: 'photos/c.webp' },
      })
      .mockResolvedValueOnce({ data: { id: 'photo-3' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.uploadImages([
        { uri: 'file://original.heic', takenAt: null },
      ]);
    });

    expect(mockCompress).toHaveBeenCalledWith('file://original.heic');
    // The blob-fetch should target the COMPRESSED uri, not the original.
    expect(fetchMock).toHaveBeenCalledWith('file://compressed-special.webp');
    expect(fetchMock).not.toHaveBeenCalledWith('file://original.heic');
  });

  test('multiple assets: each is presigned, uploaded, and registered; progress advances', async () => {
    const fetchMock = installFetchMock({ putOk: true });
    mockApi.post
      // asset 1
      .mockResolvedValueOnce({ data: { url: 'https://signed/1', key: 'photos/1.webp' } })
      .mockResolvedValueOnce({ data: { id: 'p1' } })
      // asset 2
      .mockResolvedValueOnce({ data: { url: 'https://signed/2', key: 'photos/2.webp' } })
      .mockResolvedValueOnce({ data: { id: 'p2' } })
      // asset 3
      .mockResolvedValueOnce({ data: { url: 'https://signed/3', key: 'photos/3.webp' } })
      .mockResolvedValueOnce({ data: { id: 'p3' } });

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    const assets: UploadAsset[] = [
      { uri: 'file://1.jpg', takenAt: '2025-01-01T00:00:00.000Z' },
      { uri: 'file://2.jpg', takenAt: '2025-01-02T00:00:00.000Z' },
      { uri: 'file://3.jpg', takenAt: '2025-01-03T00:00:00.000Z' },
    ];

    await act(async () => {
      await result.current.uploadImages(assets);
    });

    // 3 presign + 3 register = 6 api.post calls.
    expect(mockApi.post).toHaveBeenCalledTimes(6);
    expect(
      mockApi.post.mock.calls.filter((c) => c[0] === '/photos/presign'),
    ).toHaveLength(3);
    const registerCalls = mockApi.post.mock.calls.filter((c) => c[0] === '/photos');
    expect(registerCalls).toHaveLength(3);
    expect(registerCalls.map((c) => (c[1] as { r2_key: string }).r2_key)).toEqual([
      'photos/1.webp',
      'photos/2.webp',
      'photos/3.webp',
    ]);
    // PUT was called for each signed URL.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed/1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed/2',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed/3',
      expect.objectContaining({ method: 'PUT' }),
    );

    await waitFor(() => expect(result.current.progress).toBe(1));
    expect(result.current.uploading).toBe(false);
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
    await act(async () => {
      picked = await result.current.pickImages();
    });

    expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
    expect(picked).toEqual([
      {
        uri: 'file://p1.jpg',
        localAssetId: 'aid-1',
        takenAt: '2024-10-15T14:30:00.000Z',
      },
      {
        uri: 'file://p2.jpg',
        localAssetId: undefined,
        takenAt: null,
      },
    ]);
  });

  test('pickImages returns empty array when picker is canceled', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: true,
    } as unknown as ImagePicker.ImagePickerResult);

    const { result } = renderHook(() => useUpload(), { wrapper: makeWrapper() });

    let picked: UploadAsset[] = [{ uri: 'sentinel', takenAt: null }];
    await act(async () => {
      picked = await result.current.pickImages();
    });

    expect(picked).toEqual([]);
  });
});
