import React from 'react';
import { Image } from 'react-native';
import { render } from '@testing-library/react-native';
import { MemberList } from '@/components/family/MemberList';
import type { Member } from '@/hooks/useMembers';

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

  it('renders an Image avatar when avatar_url is provided', () => {
    const { UNSAFE_getAllByType } = render(<MemberList members={members} />);
    const images = UNSAFE_getAllByType(Image);
    // Alice has an avatar_url; Bob renders initials fallback (no Image).
    expect(images.length).toBe(1);
    expect(images[0].props.source).toEqual({ uri: 'https://cdn.example.com/alice.png' });
  });

  it('renders initials for members without an avatar_url', () => {
    const { getByText } = render(<MemberList members={members} />);
    // Bob Member -> "BM"
    expect(getByText('BM')).toBeTruthy();
  });

  it('renders the admin badge for admin role and member badge for member role', () => {
    const { getByText } = render(<MemberList members={members} />);
    expect(getByText('admin')).toBeTruthy();
    expect(getByText('member')).toBeTruthy();
  });

  it('renders a localized joined date for each row', () => {
    const { getByText } = render(<MemberList members={members} />);
    const aliceDate = new Date('2025-01-15T00:00:00.000Z').toLocaleDateString();
    const bobDate = new Date('2025-02-20T00:00:00.000Z').toLocaleDateString();
    expect(getByText(`Joined ${aliceDate}`)).toBeTruthy();
    expect(getByText(`Joined ${bobDate}`)).toBeTruthy();
  });

  it('renders nothing visible when the list is empty', () => {
    const { queryByText } = render(<MemberList members={[]} />);
    expect(queryByText('admin')).toBeNull();
    expect(queryByText('member')).toBeNull();
  });
});
