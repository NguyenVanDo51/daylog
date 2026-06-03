jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/useTimeline', () => ({
  useTimeline: jest.fn(),
}));

import React from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { useTimeline } from '@/hooks/useTimeline';
import { MonthHeader } from '@/components/timeline/MonthHeader';
import { PhotoRow } from '@/components/timeline/PhotoRow';
import { MilestoneCard } from '@/components/ui/MilestoneCard';

const mockUseTimeline = useTimeline as unknown as jest.Mock;
const mockRouter = router as unknown as { push: jest.Mock };

function photo(id: string, takenAt: string, caption: string | null = null) {
  return {
    type: 'photo' as const,
    id,
    r2_key: `photos/${id}.webp`,
    thumbnail_key: `thumbs/${id}.webp`,
    taken_at: takenAt,
    caption,
  };
}

function milestone(id: string, occurredAt: string, title = 'First steps', note: string | null = null) {
  return {
    type: 'milestone' as const,
    id,
    title,
    note,
    occurred_at: occurredAt,
    icon: null,
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
  mockRouter.push.mockReset();
});

describe('TimelineFeed', () => {
  it('renders a loading spinner while loading', () => {
    mockUseTimeline.mockReturnValue(makeReturn({ isLoading: true }));
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(
      <TimelineFeed childBirthdate={null} />,
    );
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });

  it('renders the empty state when there are no items', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({ data: { pages: [{ items: [], nextCursor: null }] } }),
    );
    const { getByText } = render(<TimelineFeed childBirthdate={null} />);
    expect(getByText(/No photos yet/i)).toBeTruthy();
  });

  it('renders the empty state when data is undefined (no pages)', () => {
    mockUseTimeline.mockReturnValue(makeReturn({ data: undefined }));
    const { getByText } = render(<TimelineFeed childBirthdate={null} />);
    expect(getByText(/No photos yet/i)).toBeTruthy();
  });

  it('groups items by month and renders a MonthHeader per month (no birthdate)', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-15T00:00:00Z'),
                photo('b', '2026-02-10T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getAllByType } = render(<TimelineFeed childBirthdate={null} />);
    const headers = UNSAFE_getAllByType(MonthHeader);
    expect(headers).toHaveLength(2);
    expect(headers[0].props.label).toMatch(/JANUARY · 2026/);
    expect(headers[1].props.label).toMatch(/FEBRUARY · 2026/);
  });

  it('shows months-since-birth in the header when childBirthdate is provided', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-06-15T00:00:00Z')],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(
      <TimelineFeed childBirthdate="2026-01-01T00:00:00Z" />,
    );
    const header = UNSAFE_getByType(MonthHeader);
    expect(header.props.label).toMatch(/JUNE · 5 MONTHS/);
  });

  it('packs photos into rows of up to 3', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-01T00:00:00Z'),
                photo('b', '2026-01-02T00:00:00Z'),
                photo('c', '2026-01-03T00:00:00Z'),
                photo('d', '2026-01-04T00:00:00Z'),
                photo('e', '2026-01-05T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getAllByType } = render(<TimelineFeed childBirthdate={null} />);
    const rows = UNSAFE_getAllByType(PhotoRow);
    // 5 photos => one row of 3 + one row of 2.
    expect(rows).toHaveLength(2);
    expect(rows[0].props.photos.map((p: any) => p.id)).toEqual(['a', 'b', 'c']);
    expect(rows[1].props.photos.map((p: any) => p.id)).toEqual(['d', 'e']);
  });

  it('renders milestones using MilestoneCard, separate from photo rows', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-01T00:00:00Z'),
                milestone('m1', '2026-01-10T00:00:00Z', 'First word'),
                photo('b', '2026-01-15T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getAllByType } = render(<TimelineFeed childBirthdate={null} />);
    const cards = UNSAFE_getAllByType(MilestoneCard);
    expect(cards).toHaveLength(1);
    expect(cards[0].props.title).toBe('First word');
    const rows = UNSAFE_getAllByType(PhotoRow);
    expect(rows).toHaveLength(2);
  });

  it('navigates to /milestone/<id> when a milestone card is pressed', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [milestone('m42', '2026-01-10T00:00:00Z')],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const card = UNSAFE_getByType(MilestoneCard);
    card.props.onPress();
    expect(mockRouter.push).toHaveBeenCalledWith('/milestone/m42');
  });

  it('starts a new month section when month boundary changes mid-stream', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-31T00:00:00Z'),
                photo('b', '2026-02-01T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getAllByType } = render(<TimelineFeed childBirthdate={null} />);
    expect(UNSAFE_getAllByType(MonthHeader)).toHaveLength(2);
    expect(UNSAFE_getAllByType(PhotoRow)).toHaveLength(2);
  });

  it('flattens items across multiple pages', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            { items: [photo('a', '2026-01-01T00:00:00Z')], nextCursor: 'c2' },
            { items: [photo('b', '2026-01-02T00:00:00Z')], nextCursor: null },
          ],
        },
      }),
    );
    const { UNSAFE_getAllByType } = render(<TimelineFeed childBirthdate={null} />);
    // Both photos are in the same month → one row containing both.
    const rows = UNSAFE_getAllByType(PhotoRow);
    expect(rows).toHaveLength(1);
    expect(rows[0].props.photos.map((p: any) => p.id)).toEqual(['a', 'b']);
  });

  it('calls fetchNextPage when end is reached and hasNextPage is true', () => {
    const fetchNextPage = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-01-01T00:00:00Z')],
              nextCursor: 'c2',
            },
          ],
        },
        hasNextPage: true,
        fetchNextPage,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const list = UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not call fetchNextPage when hasNextPage is false', () => {
    const fetchNextPage = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-01-01T00:00:00Z')],
              nextCursor: null,
            },
          ],
        },
        hasNextPage: false,
        fetchNextPage,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const list = UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not call fetchNextPage when already fetching the next page', () => {
    const fetchNextPage = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-01-01T00:00:00Z')],
              nextCursor: 'c2',
            },
          ],
        },
        hasNextPage: true,
        isFetchingNextPage: true,
        fetchNextPage,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const list = UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('wires refetch up to the RefreshControl onRefresh', () => {
    const refetch = jest.fn();
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-01-01T00:00:00Z')],
              nextCursor: null,
            },
          ],
        },
        refetch,
        isRefetching: false,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
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
          pages: [
            {
              items: [photo('a', '2026-01-01T00:00:00Z')],
              nextCursor: null,
            },
          ],
        },
        isRefetching: true,
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const list = UNSAFE_getByType(FlatList);
    expect(list.props.refreshControl.props.refreshing).toBe(true);
  });

  it('renders the correct renderItem element for each row type', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [
                photo('a', '2026-01-01T00:00:00Z'),
                milestone('m1', '2026-01-10T00:00:00Z'),
              ],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const list = UNSAFE_getByType(FlatList);
    const items = list.props.data as Array<any>;

    // Exercise renderItem for every row type and assert it returns the
    // expected element. This makes sure all three branches are executed.
    const types = new Set<string>();
    for (const item of items) {
      const element = list.props.renderItem({ item, index: 0, separators: {} as any });
      types.add(item.type);
      if (item.type === 'month') {
        expect(element.type).toBe(MonthHeader);
        expect(element.props.label).toBe(item.label);
      } else if (item.type === 'photoRow') {
        expect(element.type).toBe(PhotoRow);
        expect(element.props.photos).toEqual(item.photos);
      } else if (item.type === 'milestone') {
        expect(element.type).toBe(MilestoneCard);
        expect(element.props.title).toBe(item.milestone.title);
      }
    }
    expect(types).toEqual(new Set(['month', 'photoRow', 'milestone']));
  });

  it('keyExtractor returns each item’s unique key', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('a', '2026-01-01T00:00:00Z')],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<TimelineFeed childBirthdate={null} />);
    const list = UNSAFE_getByType(FlatList);
    const items = list.props.data as Array<{ key: string }>;
    for (const item of items) {
      expect(list.props.keyExtractor(item)).toBe(item.key);
    }
  });
});
