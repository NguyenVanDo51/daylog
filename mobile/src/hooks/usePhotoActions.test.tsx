jest.mock('@/lib/api', () => ({
  api: { delete: jest.fn(), patch: jest.fn() },
}));

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { api } from '@/lib/api';

const mockApi = api as unknown as { delete: jest.Mock; patch: jest.Mock };

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
  mockApi.delete.mockReset();
  mockApi.patch.mockReset();
});

describe('useDeletePhoto', () => {
  test('DELETEs /photos/:id and invalidates day-photos, album-days, album-photos for the album', async () => {
    const qc = freshClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    mockApi.delete.mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeletePhoto('a-1', '2026-06-13'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('p-9');
    });

    expect(mockApi.delete).toHaveBeenCalledWith('/photos/p-9');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['day-photos', 'a-1', '2026-06-13'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['album-days', 'a-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['album-photos', 'a-1'] });
  });
});

describe('useUpdateCaption', () => {
  test('PATCHes /photos/:id with the caption and invalidates day-photos + album-photos', async () => {
    const qc = freshClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    mockApi.patch.mockResolvedValueOnce({ data: { id: 'p-1', caption: 'new caption' } });

    const { result } = renderHook(() => useUpdateCaption('a-1', '2026-06-13'), { wrapper: makeWrapper(qc) });
    const ret = await act(async () => {
      return await result.current.mutateAsync({ photoId: 'p-1', caption: 'new caption' });
    });

    expect(mockApi.patch).toHaveBeenCalledWith('/photos/p-1', { caption: 'new caption' });
    expect(ret).toEqual({ id: 'p-1', caption: 'new caption' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['day-photos', 'a-1', '2026-06-13'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['album-photos', 'a-1'] });
  });

  test('accepts null caption to clear', async () => {
    const qc = freshClient();
    mockApi.patch.mockResolvedValueOnce({ data: { id: 'p-2', caption: null } });
    const { result } = renderHook(() => useUpdateCaption('a-1', '2026-06-13'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ photoId: 'p-2', caption: null });
    });
    expect(mockApi.patch).toHaveBeenCalledWith('/photos/p-2', { caption: null });
  });
});
