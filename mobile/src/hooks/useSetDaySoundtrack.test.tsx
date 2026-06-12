jest.mock('@/lib/api', () => ({ api: { put: jest.fn(), delete: jest.fn() } }));

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetDaySoundtrack } from '@/hooks/useSetDaySoundtrack';
import { api } from '@/lib/api';

const mockApi = api as unknown as { put: jest.Mock; delete: jest.Mock };

function makeWrapper(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { qc, Wrapper: ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children) };
}

beforeEach(() => { mockApi.put.mockReset(); mockApi.delete.mockReset(); });

describe('useSetDaySoundtrack', () => {
  test('calls PUT when given a soundtrack id', async () => {
    mockApi.put.mockResolvedValueOnce({ data: {} });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetDaySoundtrack('a1', '2026-06-15'), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync('track-1'); });
    expect(mockApi.put).toHaveBeenCalledWith('/albums/a1/days/2026-06-15/soundtrack', { soundtrack_id: 'track-1' });
  });

  test('calls DELETE when given null', async () => {
    mockApi.delete.mockResolvedValueOnce({ data: {} });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetDaySoundtrack('a1', '2026-06-15'), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync(null); });
    expect(mockApi.delete).toHaveBeenCalledWith('/albums/a1/days/2026-06-15/soundtrack');
  });

  test('invalidates day-soundtrack cache on success', async () => {
    mockApi.put.mockResolvedValueOnce({ data: {} });
    const { qc, Wrapper } = makeWrapper();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSetDaySoundtrack('a1', '2026-06-15'), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync('t1'); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['day-soundtrack', 'a1', '2026-06-15'] });
  });
});
