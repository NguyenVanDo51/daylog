jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

let mockAlbumId: string | null = 'album-1';
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: mockAlbumId }),
}));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTimeline } from '@/hooks/useTimeline';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => {
  mockAlbumId = 'album-1';
  mockApi.get.mockReset();
});

describe('useTimeline', () => {
  test('initial fetch returns first page and exposes loading then success', async () => {
    const page = {
      items: [
        {
          type: 'photo',
          id: 'p1',
          r2_key: 'photos/p1.webp',
          thumbnail_key: 'thumbs/p1.webp',
          taken_at: '2026-01-01T00:00:00Z',
          caption: null,
        },
      ],
      nextCursor: 'cursor-2',
    };
    mockApi.get.mockResolvedValueOnce({ data: page });

    const { result } = renderHook(() => useTimeline(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/albums/album-1/timeline', {
      params: { limit: '20' },
    });
    expect(result.current.data?.pages[0]).toEqual(page);
    expect(result.current.hasNextPage).toBe(true);
  });

  test('fetchNextPage accumulates pages and sends cursor param on second call', async () => {
    const page1 = {
      items: [
        {
          type: 'photo',
          id: 'p1',
          r2_key: 'p1.webp',
          thumbnail_key: null,
          taken_at: '2026-01-01T00:00:00Z',
          caption: null,
        },
      ],
      nextCursor: 'cursor-2',
    };
    const page2 = {
      items: [
        {
          type: 'milestone',
          id: 'm1',
          title: 'First steps',
          note: null,
          occurred_at: '2026-02-01T00:00:00Z',
          icon: null,
        },
      ],
      nextCursor: null,
    };
    mockApi.get
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 });

    const { result } = renderHook(() => useTimeline(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    expect(mockApi.get).toHaveBeenCalledTimes(2);
    expect(mockApi.get).toHaveBeenNthCalledWith(1, '/albums/album-1/timeline', {
      params: { limit: '20' },
    });
    expect(mockApi.get).toHaveBeenNthCalledWith(2, '/albums/album-1/timeline', {
      params: { limit: '20', cursor: 'cursor-2' },
    });
    expect(result.current.data?.pages[1]).toEqual(page2);
    expect(result.current.hasNextPage).toBe(false);
  });

  test('surfaces error when api.get rejects', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useTimeline(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('network down');
  });

  test('does not fire query when albumId is null', async () => {
    mockAlbumId = null;

    const { result } = renderHook(() => useTimeline(), { wrapper: makeWrapper() });

    // Give react-query a tick to potentially schedule the query.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
  });

  test('handles empty timeline (no items, null cursor)', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { items: [], nextCursor: null } });

    const { result } = renderHook(() => useTimeline(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0].items).toEqual([]);
    expect(result.current.data?.pages[0].nextCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
  });
});
