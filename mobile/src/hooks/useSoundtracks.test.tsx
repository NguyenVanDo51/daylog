jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSoundtracks } from '@/hooks/useSoundtracks';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => mockApi.get.mockReset());

describe('useSoundtracks', () => {
  test('fetches /soundtracks and returns the list', async () => {
    const data = [
      { id: 't1', key: 'lullaby_01', title: 'Mây trắng', artist: null, duration_ms: 30000 },
    ];
    mockApi.get.mockResolvedValueOnce({ data });
    const { result } = renderHook(() => useSoundtracks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/soundtracks');
    expect(result.current.data).toEqual(data);
  });
});
