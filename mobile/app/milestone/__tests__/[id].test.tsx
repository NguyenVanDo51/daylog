// Mocks must be declared before imports of the modules they replace.
// @expo/vector-icons pulls in expo-font/expo-asset transitively which is not
// installed for jest. Replace the Ionicons set with a lightweight host string.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const mockUseMilestones = jest.fn();
jest.mock('@/hooks/useMilestones', () => ({
  useMilestones: () => mockUseMilestones(),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MilestoneDetailScreen from '../[id]';
import { fireEvent } from '@testing-library/react-native';

const mockRouter = router as jest.Mocked<typeof router>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

const SAMPLE = [
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
  mockUseLocalSearchParams.mockReturnValue({ id: 'm-1' });
});

describe('MilestoneDetailScreen', () => {
  it('renders LoadingSpinner while milestones are loading', () => {
    mockUseMilestones.mockReturnValue({ data: undefined, isLoading: true });

    const { UNSAFE_queryAllByType, queryByText } = render(<MilestoneDetailScreen />);

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(queryByText('Moment')).toBeNull();
  });

  it('renders nothing (returns null) when the milestone id is not found', () => {
    mockUseMilestones.mockReturnValue({ data: SAMPLE, isLoading: false });
    mockUseLocalSearchParams.mockReturnValue({ id: 'missing' });

    const { toJSON, queryByText } = render(<MilestoneDetailScreen />);

    expect(toJSON()).toBeNull();
    expect(queryByText('Moment')).toBeNull();
  });

  it('renders the milestone title, formatted date, and note', () => {
    mockUseMilestones.mockReturnValue({ data: SAMPLE, isLoading: false });
    mockUseLocalSearchParams.mockReturnValue({ id: 'm-1' });

    const { getByText } = render(<MilestoneDetailScreen />);

    expect(getByText('Moment')).toBeTruthy();
    expect(getByText('First Steps')).toBeTruthy();
    expect(getByText('In the living room')).toBeTruthy();

    // Date is formatted via toLocaleDateString — recompute the expected string
    // so the assertion is locale-stable in the test environment.
    const expected = new Date('2025-09-01').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(getByText(expected)).toBeTruthy();
  });

  it('omits the note section when milestone.note is null', () => {
    mockUseMilestones.mockReturnValue({ data: SAMPLE, isLoading: false });
    mockUseLocalSearchParams.mockReturnValue({ id: 'm-2' });

    const { getByText, queryByText } = render(<MilestoneDetailScreen />);

    expect(getByText('First Word')).toBeTruthy();
    expect(queryByText('In the living room')).toBeNull();
  });

  it('calls router.back when the back chevron is pressed', () => {
    mockUseMilestones.mockReturnValue({ data: SAMPLE, isLoading: false });

    const { UNSAFE_getAllByType } = render(<MilestoneDetailScreen />);

    // The first TouchableOpacity in the header is the back button.
    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThan(0);
    fireEvent.press(touchables[0]);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('returns null when milestones data is undefined (no loading, no data)', () => {
    mockUseMilestones.mockReturnValue({ data: undefined, isLoading: false });

    const { toJSON } = render(<MilestoneDetailScreen />);
    expect(toJSON()).toBeNull();
  });
});
