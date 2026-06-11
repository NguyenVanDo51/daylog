import React from 'react';
import { render } from '@testing-library/react-native';
import { MemberList } from '@/components/family/MemberList';
import type { Member } from '@/hooks/useMembers';

jest.mock('expo-image', () => ({ Image: 'Image' }));

const members: Member[] = [
  {
    id: 'm-1',
    display_name: 'Alice Admin',
    avatar_url: 'https://cdn.example.com/alice.png',
    role: 'admin',
    joined_at: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'm-2',
    display_name: 'Bob Member',
    avatar_url: null,
    role: 'member',
    joined_at: '2025-02-20T00:00:00.000Z',
  },
];

describe('MemberList', () => {
  it('renders every member display name', () => {
    const { getByText } = render(<MemberList members={members} />);
    expect(getByText('Alice Admin')).toBeTruthy();
    expect(getByText('Bob Member')).toBeTruthy();
  });

  it('renders an Image avatar when avatar_url is provided and mascot fallback otherwise', () => {
    const { UNSAFE_getAllByType, getAllByText } = render(<MemberList members={members} />);
    // expo-image is mocked as host component string 'Image' (see jest.mock above).
    const images = UNSAFE_getAllByType('Image' as unknown as React.ComponentType);
    // Alice has an avatar_url → one expo-image; Bob falls back to the mascot.
    expect(images.length).toBe(1);
    expect(images[0].props.source).toEqual({ uri: 'https://cdn.example.com/alice.png' });
    // Bob has no avatar_url → mascot emoji is rendered as fallback.
    expect(getAllByText('🐱').length).toBe(1);
  });

  it('renders the admin badge for admin role and member badge for member role', () => {
    const { getByText } = render(<MemberList members={members} />);
    // Vietnamese role labels
    expect(getByText('Chủ album')).toBeTruthy();
    expect(getByText('Thành viên')).toBeTruthy();
  });

  it('renders a Vietnamese joined date for each row', () => {
    const { getAllByText } = render(<MemberList members={members} />);
    // Both members have joined dates → multiple elements match /tham gia ngày/
    const dates = getAllByText(/tham gia ngày/);
    expect(dates.length).toBe(2);
  });

  it('renders nothing visible when the list is empty', () => {
    const { queryByText } = render(<MemberList members={[]} />);
    expect(queryByText('Chủ album')).toBeNull();
    expect(queryByText('Thành viên')).toBeNull();
  });
});
