import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDayLabelsRange, useUpsertDayLabel, useDeleteDayLabel } from './useDayLabels';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (sel: any) => sel({ albumId: 'album-1' }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

test('useDayLabelsRange fetches labels in range', async () => {
  (api.get as jest.Mock).mockResolvedValue({
    data: [{ date: '2026-06-04', label: 'X', updated_at: '...', updated_by: 'u1' }],
  });

  const { result } = renderHook(
    () => useDayLabelsRange('2026-06-01', '2026-06-30'),
    { wrapper }
  );

  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(api.get).toHaveBeenCalledWith(
    '/albums/album-1/day-labels?from=2026-06-01&to=2026-06-30'
  );
  expect(result.current.data).toHaveLength(1);
});

test('useUpsertDayLabel PUTs and invalidates', async () => {
  (api.put as jest.Mock).mockResolvedValue({ data: { date: '2026-06-04', label: 'X' } });
  const { result } = renderHook(() => useUpsertDayLabel(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ date: '2026-06-04', label: 'X' });
  });

  expect(api.put).toHaveBeenCalledWith('/albums/album-1/day-labels/2026-06-04', { label: 'X' });
});

test('useDeleteDayLabel DELETEs', async () => {
  (api.delete as jest.Mock).mockResolvedValue({ status: 204 });
  const { result } = renderHook(() => useDeleteDayLabel(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ date: '2026-06-04' });
  });

  expect(api.delete).toHaveBeenCalledWith('/albums/album-1/day-labels/2026-06-04');
});
