jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDayPhotos } from '@/hooks/useDayPhotos';
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

describe('useDayPhotos', () => {
  test('is idle when either albumId or date is null', async () => {
    const a = renderHook(() => useDayPhotos(null, '2026-06-13'), { wrapper: makeWrapper() });
    const b = renderHook(() => useDayPhotos('a-1', null), { wrapper: makeWrapper() });
    await waitFor(() => expect(a.result.current.fetchStatus).toBe('idle'));
    await waitFor(() => expect(b.result.current.fetchStatus).toBe('idle'));
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  test('fetches /albums/:id/days/:date/photos with both params', async () => {
    const photos = [
      { id: 'p1', media_type: 'photo', duration_ms: null, taken_at: '2026-06-13T08:00:00.000Z',
        caption: null, uploaded_by: 'u-1', photo_url: 'https://r2/p1', thumb_url: null },
    ];
    mockApi.get.mockResolvedValueOnce({ data: photos });
    const { result } = renderHook(() => useDayPhotos('a-1', '2026-06-13'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/albums/a-1/days/2026-06-13/photos');
    expect(result.current.data).toEqual(photos);
  });
});
