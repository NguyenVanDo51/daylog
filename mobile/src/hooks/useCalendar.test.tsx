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
import { useCalendar } from '@/hooks/useCalendar';
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

describe('useCalendar', () => {
  test('fetches calendar data for given year/month', async () => {
    const calData = {
      '2025-06-03': { photo: true, capture: false },
      '2025-06-04': { photo: false, capture: true },
    };
    mockApi.get.mockResolvedValueOnce({ data: calData });

    const { result } = renderHook(() => useCalendar(2025, 6), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.get).toHaveBeenCalledWith('/albums/album-1/calendar', {
      params: { year: '2025', month: '6' },
    });
    expect(result.current.data).toEqual(calData);
  });

  test('does not fetch when albumId is null', async () => {
    mockAlbumId = null;
    const { result } = renderHook(() => useCalendar(2025, 6), { wrapper: makeWrapper() });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  test('returns empty object on successful fetch with no data', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useCalendar(2025, 6), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
  });
});
