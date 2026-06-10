jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
import { useAlbumStore } from '@/stores/albumStore';

const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onOpenMembers: jest.fn(),
  onOpenInvite: jest.fn(),
  onRename: jest.fn(),
  onArchive: jest.fn(),
  onDelete: jest.fn(),
  onLeave: jest.fn(),
};

function mockStore(overrides: { isPrivate?: boolean; myRole?: 'admin' | 'member'; archivedAt?: string | null }) {
  mockUseAlbumStore.mockImplementation((selector: (s: any) => unknown) =>
    selector({
      isPrivate: overrides.isPrivate ?? false,
      myRole: overrides.myRole ?? 'admin',
      archivedAt: overrides.archivedAt ?? null,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore({});
});

describe('AlbumMenuSheet — admin, active album', () => {
  it('shows rename, members, invite, archive, delete', () => {
    mockStore({ myRole: 'admin', archivedAt: null });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Đổi tên')).toBeTruthy();
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Mời thành viên')).toBeTruthy();
    expect(getByText('Lưu trữ album')).toBeTruthy();
    expect(getByText('Xóa album')).toBeTruthy();
  });

  it('hides invite for private album', () => {
    mockStore({ myRole: 'admin', isPrivate: true, archivedAt: null });
    const { queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(queryByText('Mời thành viên')).toBeNull();
  });

  it('calls onRename when Đổi tên is pressed', () => {
    mockStore({ myRole: 'admin' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Đổi tên'));
    expect(defaultProps.onRename).toHaveBeenCalledTimes(1);
  });

  it('calls onArchive when Lưu trữ album is pressed', () => {
    mockStore({ myRole: 'admin' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Lưu trữ album'));
    expect(defaultProps.onArchive).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Xóa album is pressed', () => {
    mockStore({ myRole: 'admin' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Xóa album'));
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('AlbumMenuSheet — admin, archived album', () => {
  it('shows only members and delete', () => {
    mockStore({ myRole: 'admin', archivedAt: '2026-06-10T00:00:00Z' });
    const { getByText, queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Xóa album')).toBeTruthy();
    expect(queryByText('Đổi tên')).toBeNull();
    expect(queryByText('Lưu trữ album')).toBeNull();
    expect(queryByText('Mời thành viên')).toBeNull();
  });
});

describe('AlbumMenuSheet — member', () => {
  it('shows members and leave album only', () => {
    mockStore({ myRole: 'member', archivedAt: null });
    const { getByText, queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Rời album')).toBeTruthy();
    expect(queryByText('Đổi tên')).toBeNull();
    expect(queryByText('Lưu trữ album')).toBeNull();
    expect(queryByText('Xóa album')).toBeNull();
  });

  it('calls onLeave when Rời album is pressed', () => {
    mockStore({ myRole: 'member' });
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Rời album'));
    expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
  });
});
