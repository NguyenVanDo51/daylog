jest.mock('@/hooks/useMembers', () => ({
  useMembers: jest.fn(),
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));
jest.mock('@/components/family/MemberList', () => ({
  MemberList: ({ members }: { members: { id: string; display_name: string }[] }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(View, null, members.map((m: { id: string; display_name: string }) =>
      React.createElement(Text, { key: m.id }, m.display_name)
    ));
  },
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { MembersSheet } from '@/components/family/MembersSheet';
import { useMembers } from '@/hooks/useMembers';
import type { Member } from '@/hooks/useMembers';

const mockUseMembers = useMembers as jest.MockedFunction<typeof useMembers>;

const members: Member[] = [
  { id: 'm-1', display_name: 'Alice Admin', avatar_url: null, role: 'admin', joined_at: '2025-01-15T00:00:00.000Z' },
  { id: 'm-2', display_name: 'Bob Member', avatar_url: null, role: 'member', joined_at: '2025-02-20T00:00:00.000Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMembers.mockReturnValue({ data: members } as ReturnType<typeof useMembers>);
});

describe('MembersSheet', () => {
  it('renders a heading and all member display names when visible', () => {
    const { getByText } = render(<MembersSheet visible={true} onClose={jest.fn()} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Alice Admin')).toBeTruthy();
    expect(getByText('Bob Member')).toBeTruthy();
  });

  it('renders no members when data is undefined', () => {
    mockUseMembers.mockReturnValue({ data: undefined } as ReturnType<typeof useMembers>);
    const { queryByText } = render(<MembersSheet visible={true} onClose={jest.fn()} />);
    expect(queryByText('Alice Admin')).toBeNull();
  });
});
