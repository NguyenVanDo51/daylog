jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(() => ({ albumId: 'album-1' })),
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

test('useAlbum fetches album data', async () => {
  mockApi.get.mockResolvedValueOnce({ data: { id: 'album-1', name: "Emma's Album", child_birthdate: '2025-04-01' } });
  const { result } = renderHook(() => useAlbum(), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data?.name).toBe("Emma's Album");
});
