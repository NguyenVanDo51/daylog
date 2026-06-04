// Mocks must be declared before imports of the modules they replace.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'blur-view', ...props }, children),
  };
});

jest.mock('@/lib/sharedElement', () => ({
  useSharedTransition: jest.fn(() => ({})),
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
import { TouchableOpacity } from 'react-native';
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

beforeEach(() => {
  mockUseTimeline.mockReset();
  mockUseLocalSearchParams.mockReset();
  mockRouter.back.mockReset();
  mockUseLocalSearchParams.mockReturnValue({ id: 'p1' });
});

describe('PhotoViewerScreen', () => {
  it('renders null when data is undefined (no photo found)', () => {
    mockUseTimeline.mockReturnValue({ data: undefined, isLoading: false });
    const { toJSON } = render(<PhotoViewerScreen />);
    expect(toJSON()).toBeNull();
  });

  it('renders null when there are no photos in the timeline', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
    });
    const { toJSON } = render(<PhotoViewerScreen />);
    expect(toJSON()).toBeNull();
  });

  it('renders null when data has only milestones (no photos)', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [milestone('m1')], nextCursor: null }] },
      isLoading: false,
    });
    const { toJSON } = render(<PhotoViewerScreen />);
    expect(toJSON()).toBeNull();
  });

  it('renders null when the requested photo id is not in the list', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'does-not-exist' });
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [photo('p1'), photo('p2')], nextCursor: null }] },
      isLoading: false,
    });
    const { toJSON } = render(<PhotoViewerScreen />);
    expect(toJSON()).toBeNull();
  });

  it('renders the photo viewer when the photo is found', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [photo('p1')], nextCursor: null }] },
      isLoading: false,
    });
    const { toJSON } = render(<PhotoViewerScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders the caption when the photo has one', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [photo('p1', 'Hello world')], nextCursor: null }] },
      isLoading: false,
    });
    const { getByText } = render(<PhotoViewerScreen />);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('does not render caption text when the photo has no caption', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [photo('p1', null)], nextCursor: null }] },
      isLoading: false,
    });
    const { queryByText } = render(<PhotoViewerScreen />);
    expect(queryByText('Hello world')).toBeNull();
  });

  it('renders a counter showing position within all photos', () => {
    mockUseTimeline.mockReturnValue({
      data: {
        pages: [
          {
            items: [photo('p1'), milestone('m1'), photo('p2'), photo('p3')],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
    });
    // p1 is at index 0 of 3 photos — counter is "1 / 3" inside a Text that also has the date
    const { getByText } = render(<PhotoViewerScreen />);
    expect(getByText(/1 \/ 3/)).toBeTruthy();
  });

  it('renders the correct counter when the requested photo is not the first', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'p3' });
    mockUseTimeline.mockReturnValue({
      data: {
        pages: [
          { items: [photo('p1'), photo('p2'), photo('p3')], nextCursor: null },
        ],
      },
      isLoading: false,
    });
    const { getByText } = render(<PhotoViewerScreen />);
    expect(getByText(/3 \/ 3/)).toBeTruthy();
  });

  it('renders Vietnamese formatted date (formatVnDate: "d Thm")', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [photo('p1')], nextCursor: null }] },
      isLoading: false,
    });
    const { getByText } = render(<PhotoViewerScreen />);
    // taken_at is 2026-01-01, formatVnDate = "1 Th1"
    expect(getByText(/Th1/)).toBeTruthy();
  });

  it('calls router.back when the close button is pressed', () => {
    mockUseTimeline.mockReturnValue({
      data: { pages: [{ items: [photo('p1')], nextCursor: null }] },
      isLoading: false,
    });
    const { UNSAFE_getAllByType } = render(<PhotoViewerScreen />);
    const closeBtn = UNSAFE_getAllByType(TouchableOpacity)[0];
    act(() => {
      closeBtn.props.onPress();
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('flattens photos across multiple pages and skips milestones', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'p2' });
    mockUseTimeline.mockReturnValue({
      data: {
        pages: [
          { items: [photo('p1'), milestone('m1')], nextCursor: 'c2' },
          { items: [milestone('m2'), photo('p2'), photo('p3')], nextCursor: null },
        ],
      },
      isLoading: false,
    });
    // p2 is at index 1 of 3 photos
    const { getByText } = render(<PhotoViewerScreen />);
    expect(getByText(/2 \/ 3/)).toBeTruthy();
  });
});
