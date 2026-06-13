jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlbumDays, type AlbumDay } from '@/hooks/useAlbumDays';
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

describe('useAlbumDays', () => {
  test('does not fetch when albumId is null (enabled=false)', async () => {
    const { result } = renderHook(() => useAlbumDays(null), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  test('fetches /albums/:id/days when albumId is provided', async () => {
    const days: AlbumDay[] = [
      { date: '2026-06-13', thumb_url: 'https://r2/x.webp', has_video: true, photo_count: 4 },
      { date: '2026-06-12', thumb_url: null, has_video: false, photo_count: 1 },
    ];
    mockApi.get.mockResolvedValueOnce({ data: days });
    const { result } = renderHook(() => useAlbumDays('album-123'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/albums/album-123/days');
    expect(result.current.data).toEqual(days);
  });
});
