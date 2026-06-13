jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReactions, useReact } from '@/hooks/useReactions';
import { api } from '@/lib/api';

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock; delete: jest.Mock };

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  mockApi.delete.mockReset();
});

describe('useReactions', () => {
  test('returns null/idle when photoId is empty (enabled=false)', async () => {
    const { result } = renderHook(() => useReactions(''), {
      wrapper: makeWrapper(freshClient()),
    });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  test('fetches reactions for a photo', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ emoji: '😍', count: 3 }] });
    const { result } = renderHook(() => useReactions('p-1'), {
      wrapper: makeWrapper(freshClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.get).toHaveBeenCalledWith('/photos/p-1/reactions');
    expect(result.current.data).toEqual([{ emoji: '😍', count: 3 }]);
  });
});

describe('useReact', () => {
  test('add mutation POSTs the emoji and invalidates reactions query', async () => {
    const qc = freshClient();
    qc.setQueryData(['reactions', 'p-1'], [{ emoji: '😍', count: 0 }]);
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    mockApi.post.mockResolvedValueOnce({ data: undefined });
    const { result } = renderHook(() => useReact('p-1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.add.mutateAsync('🎉');
    });

    expect(mockApi.post).toHaveBeenCalledWith('/photos/p-1/reactions', { emoji: '🎉' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reactions', 'p-1'] });
  });

  test('remove mutation DELETEs and invalidates reactions query', async () => {
    const qc = freshClient();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    mockApi.delete.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useReact('p-9'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.remove.mutateAsync();
    });

    expect(mockApi.delete).toHaveBeenCalledWith('/photos/p-9/reactions');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reactions', 'p-9'] });
  });
});
