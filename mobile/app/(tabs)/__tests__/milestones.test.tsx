jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (sel: any) =>
    sel({
      albumId: 'album-1',
      albumName: 'Test',
      childBirthdate: null,
      setAlbum: jest.fn(),
      clearAlbum: jest.fn(),
    }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: any) =>
    sel
      ? sel({
          user: { id: 'u1', display_name: 'Me', email: 'a@b.co', avatar_url: null },
          token: 'jwt',
          clearAuth: jest.fn(),
        })
      : { getState: () => ({ token: 'jwt' }) },
}));

jest.mock('@/hooks/useMilestones', () => ({ useMilestones: jest.fn() }));

import React from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Screen from '../milestones';
import { useMilestones } from '@/hooks/useMilestones';
import { MilestoneCard } from '@/components/ui/MilestoneCard';

const mockUseMilestones = useMilestones as unknown as jest.Mock;
const mockRouter = router as unknown as { push: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMilestones.mockReturnValue({ data: undefined, isLoading: false });
});

describe('MilestonesTab', () => {
  it('renders a loading spinner while loading', () => {
    mockUseMilestones.mockReturnValue({ data: undefined, isLoading: true });
    const { UNSAFE_getAllByType } = render(<Screen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('renders the empty state when there are no milestones', () => {
    mockUseMilestones.mockReturnValue({ data: [], isLoading: false });
    const { getByText } = render(<Screen />);
    expect(getByText(/No moments yet/i)).toBeTruthy();
  });

  it('renders the empty state when data is undefined and not loading', () => {
    mockUseMilestones.mockReturnValue({ data: undefined, isLoading: false });
    const { getByText } = render(<Screen />);
    expect(getByText(/No moments yet/i)).toBeTruthy();
  });

  it('renders a milestone list when milestones are present', () => {
    mockUseMilestones.mockReturnValue({
      data: [
        { id: 'ms1', title: 'First steps', note: null, occurred_at: '2026-01-01T00:00:00Z', cover_photo_id: null, icon: null },
        { id: 'ms2', title: 'First word',  note: 'Mama', occurred_at: '2026-02-01T00:00:00Z', cover_photo_id: null, icon: null },
      ],
      isLoading: false,
    });
    const { UNSAFE_getByType } = render(<Screen />);
    const list = UNSAFE_getByType(FlatList);
    expect(list.props.data).toHaveLength(2);
    // Trigger renderItem for each.
    const renderedFirst = list.props.renderItem({ item: list.props.data[0], index: 0, separators: {} as any });
    expect(renderedFirst.type).toBe(MilestoneCard);
    expect(renderedFirst.props.title).toBe('First steps');
    expect(list.props.keyExtractor(list.props.data[0])).toBe('ms1');
  });

  it('navigates to /milestone/<id> when a milestone is pressed', () => {
    mockUseMilestones.mockReturnValue({
      data: [
        { id: 'ms42', title: 'Crawl', note: null, occurred_at: '2026-01-01T00:00:00Z', cover_photo_id: null, icon: null },
      ],
      isLoading: false,
    });
    const { UNSAFE_getByType } = render(<Screen />);
    const list = UNSAFE_getByType(FlatList);
    const item = list.props.renderItem({ item: list.props.data[0], index: 0, separators: {} as any });
    // Fire the onPress prop the FlatList renderItem returns.
    item.props.onPress();
    expect(mockRouter.push).toHaveBeenCalledWith('/milestone/ms42');
  });

  it('FAB navigates to /milestone/new when pressed', () => {
    mockUseMilestones.mockReturnValue({ data: [], isLoading: false });
    const { UNSAFE_getAllByType } = render(<Screen />);
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    // The FAB is the (only) TouchableOpacity directly in the screen.
    const fab = buttons[buttons.length - 1];
    fireEvent.press(fab);
    expect(mockRouter.push).toHaveBeenCalledWith('/milestone/new');
  });

  it('renders heading text', () => {
    const { getByText } = render(<Screen />);
    expect(getByText(/Moments/)).toBeTruthy();
  });
});
