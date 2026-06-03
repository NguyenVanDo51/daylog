jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMilestones, useCreateMilestone } from '@/hooks/useMilestones';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

const mockApi = api as jest.Mocked<typeof api>;

function makeWrapperWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const SAMPLE_MILESTONES = [
  {
    id: 'm-1',
    title: 'First Steps',
    note: 'In the living room',
    occurred_at: '2025-09-01',
    cover_photo_id: 'p-1',
    icon: 'foot',
  },
  {
    id: 'm-2',
    title: 'First Word',
    note: null,
    occurred_at: '2025-10-15',
    cover_photo_id: null,
    icon: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Default: an active album so queries are enabled.
  useAlbumStore.setState({
    albumId: 'album-1',
    albumName: "Emma's Album",
    childBirthdate: '2025-04-01',
  });
});

afterEach(() => {
  // Reset album store between tests.
  useAlbumStore.setState({ albumId: null, albumName: null, childBirthdate: null });
});

describe('useMilestones (list query)', () => {
  test('isSuccess with milestones array and hits the right endpoint', async () => {
    mockApi.get.mockResolvedValueOnce({ data: SAMPLE_MILESTONES });
    const { wrapper } = makeWrapperWithClient();

    const { result } = renderHook(() => useMilestones(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SAMPLE_MILESTONES);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/albums/album-1/milestones');
  });

  test('isError when the request rejects', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('boom'));
    const { wrapper } = makeWrapperWithClient();

    const { result } = renderHook(() => useMilestones(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('boom');
  });

  test('is disabled when albumId is null (queryFn is not called)', async () => {
    useAlbumStore.setState({ albumId: null, albumName: null, childBirthdate: null });
    const { wrapper } = makeWrapperWithClient();

    const { result } = renderHook(() => useMilestones(), { wrapper });

    // With enabled: false, the query stays in pending+disabled state and fetchStatus is 'idle'.
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.isLoading).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('useCreateMilestone (mutation)', () => {
  test('calls api.post with the expected URL and body', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: {
        id: 'm-new',
        title: 'First Smile',
        note: null,
        occurred_at: '2025-05-10',
        cover_photo_id: null,
        icon: null,
      },
    });
    const { wrapper } = makeWrapperWithClient();

    const { result } = renderHook(() => useCreateMilestone(), { wrapper });

    const body = { title: 'First Smile', occurred_at: '2025-05-10' };
    await act(async () => {
      await result.current.mutateAsync(body);
    });

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(mockApi.post).toHaveBeenCalledWith('/albums/album-1/milestones', body);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'm-new', title: 'First Smile' });
  });

  test('invalidates the milestones + timeline queries on success', async () => {
    // Seed both caches so we can observe them flipping to stale.
    mockApi.get.mockResolvedValueOnce({ data: SAMPLE_MILESTONES });
    const { qc, wrapper } = makeWrapperWithClient();

    // Prime the milestones cache via the list hook.
    const listHook = renderHook(() => useMilestones(), { wrapper });
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true));

    // Also seed a fake timeline entry so we can confirm it's invalidated.
    qc.setQueryData(['timeline', 'album-1'], [{ id: 't-1' }]);

    // Pre-check: both caches start fresh (not stale).
    const milestonesState = qc.getQueryState(['milestones', 'album-1']);
    const timelineState = qc.getQueryState(['timeline', 'album-1']);
    expect(milestonesState?.isInvalidated).toBe(false);
    expect(timelineState?.isInvalidated).toBe(false);

    // Spy on invalidateQueries to verify the exact keys the mutation invalidates.
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    mockApi.post.mockResolvedValueOnce({
      data: {
        id: 'm-new',
        title: 'New One',
        note: null,
        occurred_at: '2025-11-01',
        cover_photo_id: null,
        icon: null,
      },
    });
    // For the refetch that invalidation triggers on the active milestones observer.
    mockApi.get.mockResolvedValueOnce({ data: SAMPLE_MILESTONES });

    const mutationHook = renderHook(() => useCreateMilestone(), { wrapper });
    await act(async () => {
      await mutationHook.result.current.mutateAsync({
        title: 'New One',
        occurred_at: '2025-11-01',
      });
    });

    // The mutation should have invalidated both query keys.
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['milestones', 'album-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['timeline', 'album-1'] });
    });

    // The timeline query has no active observer, so after invalidation its
    // cache entry remains marked invalidated (RQ only refetches active queries
    // by default). That's a concrete signal the cache was made stale.
    const timelineAfter = qc.getQueryState(['timeline', 'album-1']);
    expect(timelineAfter?.isInvalidated).toBe(true);
  });

  test('isError when the create request rejects', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('create failed'));
    const { wrapper } = makeWrapperWithClient();

    const { result } = renderHook(() => useCreateMilestone(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ title: 'x', occurred_at: '2025-01-01' }),
      ).rejects.toThrow('create failed');
    });

    expect(result.current.isError).toBe(true);
  });
});
