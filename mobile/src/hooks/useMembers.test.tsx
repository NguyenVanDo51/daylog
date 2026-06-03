jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMembers, type Member } from '@/hooks/useMembers';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const sampleMembers: Member[] = [
  {
    id: 'm-1',
    display_name: 'Alice',
    avatar_url: null,
    role: 'admin',
    joined_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'm-2',
    display_name: 'Bob',
    avatar_url: 'https://cdn.example.com/bob.png',
    role: 'member',
    joined_at: '2025-02-01T00:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Default: an albumId is selected.
  mockUseAlbumStore.mockImplementation((selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: 'album-42' }),
  );
});

test('useMembers is loading initially, then succeeds with member data', async () => {
  let resolveGet: ((v: { data: Member[] }) => void) | undefined;
  mockApi.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveGet = resolve;
      }),
  );

  const { result } = renderHook(() => useMembers(), { wrapper: makeWrapper() });

  expect(result.current.isLoading).toBe(true);
  expect(result.current.isSuccess).toBe(false);
  expect(result.current.data).toBeUndefined();

  resolveGet!({ data: sampleMembers });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(sampleMembers);
  expect(result.current.isLoading).toBe(false);
});

test('useMembers returns isError when api.get rejects', async () => {
  mockApi.get.mockRejectedValueOnce(new Error('network down'));

  const { result } = renderHook(() => useMembers(), { wrapper: makeWrapper() });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(result.current.error).toBeInstanceOf(Error);
});

test('useMembers hits /albums/:albumId/members with the right id', async () => {
  mockApi.get.mockResolvedValueOnce({ data: sampleMembers });

  const { result } = renderHook(() => useMembers(), { wrapper: makeWrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockApi.get).toHaveBeenCalledTimes(1);
  expect(mockApi.get).toHaveBeenCalledWith('/albums/album-42/members');
});

test('useMembers is disabled when albumId is null and does not call api', async () => {
  mockUseAlbumStore.mockImplementation((selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: null }),
  );

  const { result } = renderHook(() => useMembers(), { wrapper: makeWrapper() });

  // Disabled queries report isLoading=false and stay in a "pending/idle" state.
  expect(result.current.fetchStatus).toBe('idle');
  expect(result.current.isLoading).toBe(false);
  expect(result.current.data).toBeUndefined();
  expect(mockApi.get).not.toHaveBeenCalled();
});
