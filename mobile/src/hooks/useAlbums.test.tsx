jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlbums, type Album } from '@/hooks/useAlbums';
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

describe('useAlbums', () => {
  test('fetches /albums and returns the array', async () => {
    const albums: Album[] = [
      {
        id: 'a-1',
        name: 'Em bé',
        child_birthdate: '2024-01-15',
        cover_photo_id: null,
        cover_thumb_url: null,
        created_by: 'u-1',
        created_at: '2026-06-01T00:00:00Z',
        is_private: false,
        my_role: 'admin',
        archived_at: null,
      },
    ];
    mockApi.get.mockResolvedValueOnce({ data: albums });

    const { result } = renderHook(() => useAlbums(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/albums');
    expect(result.current.data).toEqual(albums);
  });

  test('surfaces errors as isError', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('500'));
    const { result } = renderHook(() => useAlbums(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
