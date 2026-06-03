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

jest.mock('@/hooks/useMembers', () => ({ useMembers: jest.fn() }));

jest.mock('@/components/family/MemberList', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    MemberList: ({ members }: any) =>
      React.createElement(
        View,
        { testID: 'member-list' },
        members.map((m: any) => React.createElement(Text, { key: m.id }, m.display_name)),
      ),
  };
});

jest.mock('@/components/family/InviteSheet', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    InviteSheet: ({ visible, onClose }: any) =>
      visible
        ? React.createElement(
            TouchableOpacity,
            { testID: 'invite-sheet', onPress: onClose },
            React.createElement(Text, null, 'Invite Sheet Open'),
          )
        : null,
  };
});

jest.mock('@/components/family/QRSheet', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    QRSheet: ({ visible, onClose }: any) =>
      visible
        ? React.createElement(
            TouchableOpacity,
            { testID: 'qr-sheet', onPress: onClose },
            React.createElement(Text, null, 'QR Sheet Open'),
          )
        : null,
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Screen from '../family';
import { useMembers } from '@/hooks/useMembers';

const mockUseMembers = useMembers as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMembers.mockReturnValue({ data: undefined, isLoading: false });
});

describe('FamilyTab', () => {
  it('renders the family heading', () => {
    const { getByText } = render(<Screen />);
    expect(getByText(/Family/)).toBeTruthy();
  });

  it('renders a loading spinner while members are loading', () => {
    mockUseMembers.mockReturnValue({ data: undefined, isLoading: true });
    const { UNSAFE_getAllByType } = render(<Screen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('renders the member list when members are returned', () => {
    mockUseMembers.mockReturnValue({
      data: [
        { id: 'm1', display_name: 'Alice', avatar_url: null, role: 'admin', joined_at: '2026-01-01T00:00:00Z' },
        { id: 'm2', display_name: 'Bob', avatar_url: null, role: 'member', joined_at: '2026-01-02T00:00:00Z' },
      ],
      isLoading: false,
    });
    const { getByText, getByTestId } = render(<Screen />);
    expect(getByTestId('member-list')).toBeTruthy();
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });

  it('renders Invite section headers and buttons', () => {
    const { getByText } = render(<Screen />);
    expect(getByText('MEMBERS')).toBeTruthy();
    expect(getByText('INVITE FAMILY')).toBeTruthy();
    expect(getByText('Copy Invite Link')).toBeTruthy();
    expect(getByText('Scan QR Code')).toBeTruthy();
  });

  it('opens the InviteSheet when "Copy Invite Link" is pressed', () => {
    const { getByText, queryByTestId } = render(<Screen />);
    expect(queryByTestId('invite-sheet')).toBeNull();
    fireEvent.press(getByText('Copy Invite Link'));
    expect(queryByTestId('invite-sheet')).toBeTruthy();
  });

  it('opens the QRSheet when "Scan QR Code" is pressed', () => {
    const { getByText, queryByTestId } = render(<Screen />);
    expect(queryByTestId('qr-sheet')).toBeNull();
    fireEvent.press(getByText('Scan QR Code'));
    expect(queryByTestId('qr-sheet')).toBeTruthy();
  });

  it('closes the InviteSheet when its onClose is called', () => {
    const { getByText, getByTestId, queryByTestId } = render(<Screen />);
    fireEvent.press(getByText('Copy Invite Link'));
    expect(queryByTestId('invite-sheet')).toBeTruthy();
    fireEvent.press(getByTestId('invite-sheet'));
    expect(queryByTestId('invite-sheet')).toBeNull();
  });

  it('closes the QRSheet when its onClose is called', () => {
    const { getByText, getByTestId, queryByTestId } = render(<Screen />);
    fireEvent.press(getByText('Scan QR Code'));
    expect(queryByTestId('qr-sheet')).toBeTruthy();
    fireEvent.press(getByTestId('qr-sheet'));
    expect(queryByTestId('qr-sheet')).toBeNull();
  });
});
