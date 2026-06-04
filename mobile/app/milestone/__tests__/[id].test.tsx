// Mocks must be declared before imports of the modules they replace.
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
  it('renders null when data is loading (no isLoading destructured)', () => {
    // Component only destructures data, not isLoading; so undefined data = null render
    mockUseMilestones.mockReturnValue({ data: undefined, isLoading: true });

    const { toJSON } = render(<MilestoneDetailScreen />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing (returns null) when the milestone id is not found', () => {
    mockUseMilestones.mockReturnValue({ data: SAMPLE, isLoading: false });
    mockUseLocalSearchParams.mockReturnValue({ id: 'missing' });

    const { toJSON, queryByText } = render(<MilestoneDetailScreen />);

    expect(toJSON()).toBeNull();
    expect(queryByText('First Steps')).toBeNull();
  });

  it('renders the milestone title, Vietnamese formatted date, and note', () => {
    mockUseMilestones.mockReturnValue({ data: SAMPLE, isLoading: false });
    mockUseLocalSearchParams.mockReturnValue({ id: 'm-1' });

    const { getByText } = render(<MilestoneDetailScreen />);

    expect(getByText('First Steps')).toBeTruthy();
    expect(getByText('In the living room')).toBeTruthy();

    // Vietnamese date format: "1 Th9 · Tháng 9 2025"
    expect(getByText(/Tháng 9/)).toBeTruthy();
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
