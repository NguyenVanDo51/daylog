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

jest.mock('@/components/timeline/TimelineFeed', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    TimelineFeed: (props: any) =>
      React.createElement(Text, { testID: 'timeline-feed' }, `feed:${props.childBirthdate ?? 'none'}`),
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
    expect(getByText(/Our Album/)).toBeTruthy();
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
    expect(getByText(/5 months old/)).toBeTruthy();
  });

  it('renders an age badge in years for older children', () => {
    const now = new Date();
    // 36 months ago = 3 years
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), 1).toISOString();
    albumState.childBirthdate = threeYearsAgo;
    const { getByText } = render(<Screen />);
    expect(getByText(/3 years old/)).toBeTruthy();
  });

  it('falls back to album.child_birthdate when no store value', () => {
    const now = new Date();
    const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 8, 1).toISOString();
    mockUseAlbum.mockReturnValue({ data: { child_birthdate: eightMonthsAgo } });
    const { getByText } = render(<Screen />);
    expect(getByText(/8 months old/)).toBeTruthy();
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
    // The avatar row is a TouchableOpacity; press it.
    const avatarRow = touchables[0];
    fireEvent.press(avatarRow);
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/family');
  });

  it('does not render the avatar row when members is empty', () => {
    mockUseMembers.mockReturnValue({ data: [] });
    const { UNSAFE_queryAllByType } = render(<Screen />);
    const { TouchableOpacity } = require('react-native');
    expect(UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it('does not render the avatar row when members is undefined', () => {
    mockUseMembers.mockReturnValue({ data: undefined });
    const { UNSAFE_queryAllByType } = render(<Screen />);
    const { TouchableOpacity } = require('react-native');
    expect(UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it('renders "Good morning" in the morning hours', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T09:00:00Z').getTime() + new Date().getTimezoneOffset() * 60 * 1000);
    const { getByText } = render(<Screen />);
    expect(getByText(/Good morning/)).toBeTruthy();
    jest.useRealTimers();
  });

  it('renders "Good afternoon" in the afternoon hours', () => {
    // Use a Date.prototype.getHours stub instead of fake-timers so we don't
    // have to fight timezone math.
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
    const { getByText } = render(<Screen />);
    expect(getByText(/Good afternoon/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders "Good evening" in the evening hours', () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(20);
    const { getByText } = render(<Screen />);
    expect(getByText(/Good evening/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders "Good morning" when getHours < 12 (stubbed)', () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(8);
    const { getByText } = render(<Screen />);
    expect(getByText(/Good morning/)).toBeTruthy();
    spy.mockRestore();
  });

  it('renders without crashing if user is null', () => {
    authState.user = null;
    const { getByTestId } = render(<Screen />);
    expect(getByTestId('timeline-feed')).toBeTruthy();
  });
});
