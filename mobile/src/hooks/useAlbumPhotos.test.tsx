jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlbumPhotos } from '@/hooks/useAlbumPhotos';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => {
  mockApi.get.mockReset();
});

describe('useAlbumPhotos', () => {
  test('is idle when albumId is null', async () => {
    const { result } = renderHook(() => useAlbumPhotos(null), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  test('fetches /albums/:id/photos when albumId is set', async () => {
    const payload = [
      {
        date: '2026-06-13',
        photos: [
          {
            id: 'p1', media_type: 'photo', duration_ms: null, taken_at: '2026-06-13T08:00:00.000Z',
            caption: null, uploaded_by: 'u-1', width: 1024, height: 768, date: '2026-06-13',
            photo_url: 'https://r2/photos/p1.webp', thumb_url: null,
          },
        ],
      },
    ];
    mockApi.get.mockResolvedValueOnce({ data: payload });
    const { result } = renderHook(() => useAlbumPhotos('a-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/albums/a-1/photos');
    expect(result.current.data).toEqual(payload);
  });
});
