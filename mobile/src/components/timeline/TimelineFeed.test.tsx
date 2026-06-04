jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/useTimeline', () => ({
  useTimeline: jest.fn(),
}));

jest.mock('@/hooks/useDayLabels', () => ({
  useDayLabelsRange: jest.fn(() => ({ data: [] })),
}));

jest.mock('@/hooks/useReactions', () => ({
  useReactions: () => ({ data: [] }),
  useReact: () => ({ add: { mutate: jest.fn() } }),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));

jest.mock('@/components/timeline/MasonryBlock', () => {
  const { View } = require('react-native');
  return {
    MasonryBlock: ({ block }: any) => <View testID="masonry-block" />,
    distributeMasonry: jest.fn((photos: any[]) => ({
      left: photos.map((p: any) => ({ photo: p, tileHeight: 100 })),
      right: [],
    })),
  };
});

import React from 'react';
import { FlatList } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { useTimeline } from '@/hooks/useTimeline';

const mockUseTimeline = useTimeline as unknown as jest.Mock;

function photo(id: string, takenAt: string, caption: string | null = null) {
  return {
    type: 'photo' as const,
    id,
    r2_key: `photos/${id}.webp`,
    thumbnail_key: `thumbs/${id}.webp`,
    taken_at: takenAt,
    caption,
    media_type: 'photo' as const,
    source: 'upload' as const,
    duration_ms: null,
    width: null,
    height: null,
  };
}

function makeReturn(overrides: Partial<ReturnType<typeof baseReturn>> = {}) {
  return { ...baseReturn(), ...overrides };
}

function baseReturn() {
  return {
    data: undefined as undefined | { pages: Array<{ items: any[]; nextCursor: string | null }> },
    isLoading: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    refetch: jest.fn(),
    isRefetching: false,
  };
}

beforeEach(() => {
  mockUseTimeline.mockReset();
});

describe('TimelineFeed', () => {
  it('renders skeleton rows while loading (no FlatList)', () => {
    mockUseTimeline.mockReturnValue(makeReturn({ isLoading: true }));
    const { UNSAFE_queryByType } = render(<TimelineFeed />);
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });

  it('renders the empty state when there are no items', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({ data: { pages: [{ items: [], nextCursor: null }] } }),
    );
    const { getByText } = render(<TimelineFeed />);
    expect(getByText(/chưa có ảnh/i)).toBeTruthy();
  });

  it('renders the empty state when data is undefined (no pages)', () => {
    mockUseTimeline.mockReturnValue(makeReturn({ data: undefined }));
    const { getByText } = render(<TimelineFeed />);
    expect(getByText(/chưa có ảnh/i)).toBeTruthy();
  });

  it('shows a day header for each distinct day', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-15T00:00:00Z'),
                photo('b', '2026-01-16T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { getAllByTestId } = render(<TimelineFeed />);
    const headers = getAllByTestId(/^day-heading-/);
    expect(headers).toHaveLength(2);
  });

  it('shows a single day header when photos are on the same day', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-15T00:00:00Z'),
                photo('b', '2026-01-15T06:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { getAllByTestId } = render(<TimelineFeed />);
    const headers = getAllByTestId(/^day-heading-/);
    expect(headers).toHaveLength(1);
  });

  it('renders a masonry block for photos on each day', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-15T00:00:00Z'),
                photo('b', '2026-01-15T01:00:00Z'),
                photo('c', '2026-01-16T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { getAllByTestId } = render(<TimelineFeed />);
    // day 15 photos flush when day 16 starts, day 16 photo flushes at end → 2 blocks
    expect(getAllByTestId('masonry-block')).toHaveLength(2);
  });

  it('flattens items across multiple pages', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            { items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: 'c2' },
            { items: [photo('b', '2026-01-01T01:00:00Z')], nextCursor: null },
          ],
        },
      }),
    );
    const { getAllByTestId } = render(<TimelineFeed />);
    // both photos same day → 1 day header, 1 masonry block
    expect(getAllByTestId(/^day-heading-/)).toHaveLength(1);
    expect(getAllByTestId('masonry-block')).toHaveLength(1);
  });

  it('calls fetchNextPage when end is reached and hasNextPage is true', () => {
    const fetchNextPage = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [{ items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: 'c2' }],
        },
        hasNextPage: true,
        fetchNextPage,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not call fetchNextPage when hasNextPage is false', () => {
    const fetchNextPage = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [{ items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: null }],
        },
        hasNextPage: false,
        fetchNextPage,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not call fetchNextPage when already fetching the next page', () => {
    const fetchNextPage = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [{ items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: 'c2' }],
        },
        hasNextPage: true,
        isFetchingNextPage: true,
        fetchNextPage,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('wires refetch up to the RefreshControl onRefresh', () => {
    const refetch = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [{ items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: null }],
        },
        refetch,
        isRefetching: false,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    const refreshControl = list.props.refreshControl;
    expect(refreshControl).toBeTruthy();
    expect(refreshControl.props.refreshing).toBe(false);
    refreshControl.props.onRefresh();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('reflects isRefetching=true on the RefreshControl', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [{ items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: null }],
        },
        isRefetching: true,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    expect(list.props.refreshControl.props.refreshing).toBe(true);
  });

  it('keyExtractor returns each item\'s unique key', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [{ items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: null }],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    const items = list.props.data as Array<{ key: string }>;
    for (const item of items) {
      expect(list.props.keyExtractor(item)).toBe(item.key);
    }
  });

  it('renders the correct renderItem element for each item type', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-01T00:00:00Z'),
                photo('b', '2026-01-10T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed />);
    const list = UNSAFE_getByType(FlatList);
    const listItems = list.props.data as Array<any>;

    const types = new Set<string>();
    for (const item of listItems) {
      list.props.renderItem({ item, index: 0, separators: {} as any });
      types.add(item.type);
    }
    expect(types).toEqual(new Set(['dayHeader', 'masonryBlock']));
  });

  it('tapping day heading calls onJumpToDay with the dateKey', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-06-04T10:00:00Z')],
              nextCursor: null,
            },
          ],
        },
      }),
    );

    const onJump = jest.fn();
    const { getByTestId } = render(<TimelineFeed onJumpToDay={onJump} />);
    fireEvent.press(getByTestId('day-heading-2026-06-04'));
    expect(onJump).toHaveBeenCalledWith('2026-06-04');
  });

  it('day heading shows day label when present', () => {
    const { useDayLabelsRange } = require('@/hooks/useDayLabels');
    useDayLabelsRange.mockReturnValue({
      data: [{ date: '2026-06-04', label: 'Sinh nhật', updated_at: '', updated_by: '' }],
    });

    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-06-04T10:00:00Z')],
              nextCursor: null,
            },
          ],
        },
      }),
    );

    const { getByText } = render(<TimelineFeed />);
    expect(getByText(/Sinh nhật/)).toBeTruthy();
  });
});
