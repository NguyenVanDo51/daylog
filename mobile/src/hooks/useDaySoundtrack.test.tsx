jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDaySoundtrack } from '@/hooks/useDaySoundtrack';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => mockApi.get.mockReset());

describe('useDaySoundtrack', () => {
  test('fetches per-day soundtrack', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { id: 't1', key: 'lullaby_01', title: 'Mây trắng', duration_ms: 30000, is_active: true },
    });
    const { result } = renderHook(() => useDaySoundtrack('a1', '2026-06-15'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/albums/a1/days/2026-06-15/soundtrack');
    expect(result.current.data?.key).toBe('lullaby_01');
  });

  test('returns null body as null data', async () => {
    mockApi.get.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useDaySoundtrack('a1', '2026-06-15'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  test('does not fetch when albumId or date is null', async () => {
    const { result } = renderHook(() => useDaySoundtrack(null, '2026-06-15'), { wrapper: makeWrapper() });
    await act(async () => { await Promise.resolve(); });
    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
