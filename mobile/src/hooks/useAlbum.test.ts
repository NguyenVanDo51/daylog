jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

let mockAlbumId: string | null = 'album-1';
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: mockAlbumId }),
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlbum } from '@/hooks/useAlbum';
import { api } from '@/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockAlbumId = 'album-1';
  mockApi.get.mockReset();
});

test('useAlbum fetches album data from /albums/:id', async () => {
  mockApi.get.mockResolvedValueOnce({ data: { id: 'album-1', name: "Emma's Album", child_birthdate: '2025-04-01' } });
  const { result } = renderHook(() => useAlbum(), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data?.name).toBe("Emma's Album");
  expect(mockApi.get).toHaveBeenCalledWith('/albums/album-1');
});

test('useAlbum does not fire query when albumId is null', () => {
  mockAlbumId = null;
  const { result } = renderHook(() => useAlbum(), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
  expect(mockApi.get).not.toHaveBeenCalled();
});
