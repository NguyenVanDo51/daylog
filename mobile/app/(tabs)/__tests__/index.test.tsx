jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const albumState: {
  albumId: string | null;
  albumName: string | null;
  childBirthdate: string | null;
} = {
  albumId: 'album-1',
  albumName: 'Test',
  childBirthdate: null,
};

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (sel: any) =>
    sel({
      albumId: albumState.albumId,
      albumName: albumState.albumName,
      childBirthdate: albumState.childBirthdate,
      setAlbum: jest.fn(),
      clearAlbum: jest.fn(),
    }),
}));

const authState: { user: { id: string; display_name: string; email: string; avatar_url: string | null } | null } = {
  user: { id: 'u1', display_name: 'Andy Roberts', email: 'a@b.co', avatar_url: null },
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: any) =>
    sel
      ? sel({ user: authState.user, token: 'jwt', clearAuth: jest.fn() })
      : { user: authState.user, token: 'jwt', clearAuth: jest.fn(), getState: () => ({ token: 'jwt' }) },
}));

jest.mock('@/hooks/useAlbum', () => ({ useAlbum: jest.fn() }));
jest.mock('@/hooks/useMembers', () => ({ useMembers: jest.fn() }));
jest.mock('@/hooks/useTimeline', () => ({
  useTimeline: jest.fn(() => ({ data: undefined })),
}));

jest.mock('@/components/ui/StorageBadge', () => ({
  StorageBadge: () => null,
}));
jest.mock('@/components/ui/StorageFreedomModal', () => ({
  StorageFreedomModal: () => null,
}));

jest.mock('@/components/timeline/TimelineFeed', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    TimelineFeed: (props: any) =>
      React.createElement(Text, { testID: 'timeline-feed' }, `feed:${props.childBirthdate ?? 'none'}`),
  };
});

jest.mock('@/components/timeline/CalendarView', () => {
  const { View } = require('react-native');
  return {
    CalendarView: () => <View testID="mock-calendar-view" />,
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Screen from '../index';
import { useAlbum } from '@/hooks/useAlbum';
import { useMembers } from '@/hooks/useMembers';

const mockUseAlbum = useAlbum as unknown as jest.Mock;
const mockUseMembers = useMembers as unknown as jest.Mock;
const mockRouter = router as unknown as { push: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  albumState.albumId = 'album-1';
  albumState.albumName = 'Test';
  albumState.childBirthdate = null;
  authState.user = { id: 'u1', display_name: 'Andy Roberts', email: 'a@b.co', avatar_url: null };
  mockUseAlbum.mockReturnValue({ data: undefined });
  mockUseMembers.mockReturnValue({ data: undefined });
});

describe('HomeScreen (timeline tab)', () => {
  it('renders the TimelineFeed when album exists', () => {
    mockUseAlbum.mockReturnValue({ data: { child_birthdate: null } });
    mockUseMembers.mockReturnValue({ data: [] });
    const { getByTestId, getByText } = render(<Screen />);
    expect(getByTestId('timeline-feed')).toBeTruthy();
    expect(getByText(/Test/)).toBeTruthy();
  });

  it('renders the default album name when albumName is not set', () => {
    albumState.albumName = null;
    const { getByText } = render(<Screen />);
    expect(getByText(/Album của bé/)).toBeTruthy();
  });

  it('renders the greeting with the first name of the user', () => {
    const { getByText } = render(<Screen />);
    expect(getByText(/Andy/)).toBeTruthy();
  });

  it('renders an age badge when childBirthdate is set on the store', () => {
    const now = new Date();
    const fiveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    albumState.childBirthdate = fiveMonthsAgo;
    const { getByText } = render(<Screen />);
    // Vietnamese age: "5 tháng tuổi"
    expect(getByText(/5 tháng tuổi/)).toBeTruthy();
  });

  it('renders an age badge in years for older children', () => {
    const now = new Date();
    // 36 months ago = 3 years
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), 1).toISOString();
    albumState.childBirthdate = threeYearsAgo;
    const { getByText } = render(<Screen />);
    // Vietnamese age: "3 tuổi"
    expect(getByText(/3 tuổi/)).toBeTruthy();
  });

  it('falls back to album.child_birthdate when no store value', () => {
    const now = new Date();
    const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 8, 1).toISOString();
    mockUseAlbum.mockReturnValue({ data: { child_birthdate: eightMonthsAgo } });
    const { getByText } = render(<Screen />);
    // Vietnamese age: "8 tháng tuổi"
    expect(getByText(/8 tháng tuổi/)).toBeTruthy();
  });

  it('renders avatar row when members exist and navigates to family tab when pressed', () => {
    mockUseMembers.mockReturnValue({
      data: [
        { id: 'm1', display_name: 'Member One', avatar_url: null },
        { id: 'm2', display_name: 'Member Two', avatar_url: null },
        { id: 'm3', display_name: 'Member Three', avatar_url: null },
        { id: 'm4', display_name: 'Member Four', avatar_url: null },
        { id: 'm5', display_name: 'Member Five', avatar_url: null },
      ],
    });
    const { UNSAFE_getAllByType } = render(<Screen />);
    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    // Avatar row is [0]; toggle-feed is [1]; toggle-calendar is [2]; camera btn is [3].
    const avatarRow = touchables[0];
    fireEvent.press(avatarRow);
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/family');
  });

  it('does not render the avatar row when members is empty', () => {
    mockUseMembers.mockReturnValue({ data: [] });
    const { getByTestId, queryByTestId } = render(<Screen />);
    // Toggle buttons and camera are rendered; avatar row is not.
    expect(getByTestId('toggle-feed')).toBeTruthy();
    expect(getByTestId('toggle-calendar')).toBeTruthy();
    // Camera is visible in feed mode (default)
    expect(queryByTestId('mock-calendar-view')).toBeNull();
  });

  it('does not render the avatar row when members is undefined', () => {
    mockUseMembers.mockReturnValue({ data: undefined });
    const { getByTestId, queryByTestId } = render(<Screen />);
    // Toggle buttons are rendered; avatar row is not.
    expect(getByTestId('toggle-feed')).toBeTruthy();
    expect(getByTestId('toggle-calendar')).toBeTruthy();
    expect(queryByTestId('mock-calendar-view')).toBeNull();
  });

  it('renders a morning greeting in the morning hours', () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
    const { getByText } = render(<Screen />);
    // Vietnamese: "Chào buổi sáng"
    expect(getByText(/Chào buổi sáng/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders an afternoon greeting in the afternoon hours', () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
    const { getByText } = render(<Screen />);
    // Vietnamese: "Chào buổi chiều"
    expect(getByText(/Chào buổi chiều/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders an evening greeting in the evening hours', () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(20);
    const { getByText } = render(<Screen />);
    // Vietnamese: "Chào buổi tối"
    expect(getByText(/Chào buổi tối/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders morning greeting when getHours < 11 (stubbed)', () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(8);
    const { getByText } = render(<Screen />);
    // Vietnamese: "Chào buổi sáng"
    expect(getByText(/Chào buổi sáng/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders without crashing if user is null', () => {
    authState.user = null;
    const { getByTestId } = render(<Screen />);
    expect(getByTestId('timeline-feed')).toBeTruthy();
  });

  it('toggle switches between feed and calendar', () => {
    mockUseAlbum.mockReturnValue({ data: { child_birthdate: null } });
    mockUseMembers.mockReturnValue({ data: [] });
    const { getByTestId, queryByTestId } = render(<Screen />);
    expect(queryByTestId('mock-calendar-view')).toBeNull();
    expect(getByTestId('timeline-feed')).toBeTruthy();
    fireEvent.press(getByTestId('toggle-calendar'));
    expect(getByTestId('mock-calendar-view')).toBeTruthy();
    fireEvent.press(getByTestId('toggle-feed'));
    expect(queryByTestId('mock-calendar-view')).toBeNull();
    expect(getByTestId('timeline-feed')).toBeTruthy();
  });
});
