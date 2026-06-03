jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/useTimeline', () => ({
  useTimeline: jest.fn(),
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (sel: (s: { albumId: string | null }) => unknown) =>
    sel({ albumId: 'album-1' }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import React from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import PhotoViewerScreen from '../[id]';
import { useTimeline } from '@/hooks/useTimeline';

const mockUseTimeline = useTimeline as unknown as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as unknown as jest.Mock;
const mockRouter = router as unknown as { back: jest.Mock };

function photo(id: string, caption: string | null = null) {
  return {
    type: 'photo' as const,
    id,
    r2_key: `photos/${id}.webp`,
    thumbnail_key: `thumbs/${id}.webp`,
    taken_at: '2026-01-01T00:00:00Z',
    caption,
  };
}

function milestone(id: string) {
  return {
    type: 'milestone' as const,
    id,
    title: 'First steps',
    note: null,
    occurred_at: '2026-01-01T00:00:00Z',
    icon: null,
  };
}

function baseReturn() {
  return {
    data: undefined as
      | undefined
      | { pages: Array<{ items: any[]; nextCursor: string | null }> },
    isLoading: false,
  };
}

function makeReturn(overrides: Partial<ReturnType<typeof baseReturn>> = {}) {
  return { ...baseReturn(), ...overrides };
}

beforeEach(() => {
  mockUseTimeline.mockReset();
  mockUseLocalSearchParams.mockReset();
  mockRouter.back.mockReset();
  mockUseLocalSearchParams.mockReturnValue({ id: 'p1' });
});

describe('PhotoViewerScreen', () => {
  it('renders a loading spinner while the timeline is loading', () => {
    mockUseTimeline.mockReturnValue(makeReturn({ isLoading: true }));
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<PhotoViewerScreen />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    // The carousel FlatList should NOT be rendered while loading.
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });

  it('renders the "Photo not found" empty state when no photos exist', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [], nextCursor: null }] },
      }),
    );
    const { getByText, UNSAFE_queryByType } = render(<PhotoViewerScreen />);
    expect(getByText('Photo not found')).toBeTruthy();
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });

  it('renders the "Photo not found" empty state when data has only milestones (no photos)', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [milestone('m1')], nextCursor: null }] },
      }),
    );
    const { getByText, UNSAFE_queryByType } = render(<PhotoViewerScreen />);
    expect(getByText('Photo not found')).toBeTruthy();
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });

  it('renders the carousel with all photos when data is available', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('p1'), milestone('m1'), photo('p2'), photo('p3')],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    const data = list.props.data as Array<{ id: string }>;
    // Milestone should be filtered out; only photos remain.
    expect(data.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    // Carousel paging configuration.
    expect(list.props.horizontal).toBe(true);
    expect(list.props.pagingEnabled).toBe(true);
    // initialScrollIndex points at the requested photo id (p1 → index 0).
    expect(list.props.initialScrollIndex).toBe(0);
  });

  it('finds the requested photo by id when it is not the first photo', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'p3' });
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('p1'), photo('p2'), photo('p3'), photo('p4')],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType, queryByText } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    // initialScrollIndex should be the index of the requested photo.
    expect(list.props.initialScrollIndex).toBe(2);
    // No caption since the photo had none.
    expect(queryByText(/.+/)).toBeNull();
  });

  it('falls back to index 0 when the requested photo id is not in the list', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'does-not-exist' });
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            { items: [photo('p1'), photo('p2')], nextCursor: null },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    // findIndex returns -1 → clamped to 0.
    expect(list.props.initialScrollIndex).toBe(0);
  });

  it('renders the caption bar when the current photo has a caption', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            { items: [photo('p1', 'Hello world')], nextCursor: null },
          ],
        },
      }),
    );
    const { getByText } = render(<PhotoViewerScreen />);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('does not render the caption bar when the current photo has no caption', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            { items: [photo('p1', null)], nextCursor: null },
          ],
        },
      }),
    );
    const { queryByText } = render(<PhotoViewerScreen />);
    // No text node should be rendered (no caption, no empty state).
    expect(queryByText(/Photo not found/)).toBeNull();
    expect(queryByText(/Hello/)).toBeNull();
  });

  it('updates currentIndex on momentum scroll end and reflects new caption', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            {
              items: [photo('p1', 'first'), photo('p2', 'second')],
              nextCursor: null,
            },
          ],
        },
      }),
    );
    const { UNSAFE_getByType, getByText, queryByText } = render(<PhotoViewerScreen />);
    // Initially shows first caption.
    expect(getByText('first')).toBeTruthy();
    const list = UNSAFE_getByType(FlatList);
    // Simulate swiping to the second page; width is mocked → use a large
    // contentOffset.x so Math.round divides cleanly to index 1.
    const { width } = require('react-native').Dimensions.get('window');
    act(() => {
      list.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: width } },
      });
    });
    expect(queryByText('first')).toBeNull();
    expect(getByText('second')).toBeTruthy();
  });

  it('calls router.back when the close button is pressed', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [photo('p1')], nextCursor: null }] },
      }),
    );
    const { UNSAFE_getAllByType } = render(<PhotoViewerScreen />);
    // The close button is the only TouchableOpacity rendered by the screen.
    const closeBtn = UNSAFE_getAllByType(TouchableOpacity)[0];
    act(() => {
      closeBtn.props.onPress();
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('also exposes the close button on the loading state', () => {
    mockUseTimeline.mockReturnValue(makeReturn({ isLoading: true }));
    const { UNSAFE_getAllByType } = render(<PhotoViewerScreen />);
    const closeBtn = UNSAFE_getAllByType(TouchableOpacity)[0];
    act(() => {
      closeBtn.props.onPress();
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('renderItem returns an Image element for the photo at the given uri', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [photo('p1')], nextCursor: null }] },
      }),
    );
    const { UNSAFE_getByType } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    const element = list.props.renderItem({
      item: photo('p7'),
      index: 0,
      separators: {} as any,
    });
    // The page wrapper contains the Image; inspect children.
    const image = element.props.children;
    expect(image.props.source.uri).toMatch(/\/photos\/p7\/full$/);
    expect(image.props.contentFit).toBe('contain');
  });

  it('getItemLayout returns width-based geometry for each index', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [photo('p1'), photo('p2')], nextCursor: null }] },
      }),
    );
    const { UNSAFE_getByType } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    const { width } = require('react-native').Dimensions.get('window');
    expect(list.props.getItemLayout(null, 0)).toEqual({
      length: width,
      offset: 0,
      index: 0,
    });
    expect(list.props.getItemLayout(null, 2)).toEqual({
      length: width,
      offset: width * 2,
      index: 2,
    });
  });

  it('keyExtractor returns each photo id', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [photo('p1'), photo('p2')], nextCursor: null }] },
      }),
    );
    const { UNSAFE_getByType } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    expect(list.props.keyExtractor(photo('abc'))).toBe('abc');
  });

  it('flattens photos across multiple pages and skips milestones', () => {
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: {
          pages: [
            { items: [photo('p1'), milestone('m1')], nextCursor: 'c2' },
            { items: [milestone('m2'), photo('p2'), photo('p3')], nextCursor: null },
          ],
        },
      }),
    );
    const { UNSAFE_getByType } = render(<PhotoViewerScreen />);
    const list = UNSAFE_getByType(FlatList);
    const data = list.props.data as Array<{ id: string }>;
    expect(data.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('handles cold cache: starts with empty state, then renders carousel after data resolves', () => {
    // First render: data is undefined (cold cache, still loading).
    mockUseTimeline.mockReturnValue(makeReturn({ isLoading: true }));
    const { rerender, UNSAFE_queryByType, UNSAFE_getByType } = render(<PhotoViewerScreen />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(UNSAFE_queryByType(FlatList)).toBeNull();

    // Now data resolves.
    mockUseTimeline.mockReturnValue(
      makeReturn({
        data: { pages: [{ items: [photo('p1')], nextCursor: null }] },
      }),
    );
    rerender(<PhotoViewerScreen />);
    expect(UNSAFE_getByType(FlatList)).toBeTruthy();
  });
});
