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
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAlbumStore.mockImplementation((selector: (s: { isPrivate: boolean | null }) => unknown) =>
    selector({ isPrivate: false }),
  );
});

describe('AlbumMenuSheet', () => {
  it('renders both menu row labels', () => {
    const { getByText, queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Mời thành viên')).toBeTruthy();
    expect(queryByText('Quét mã QR')).toBeNull();
  });

  it('calls onOpenMembers when Thành viên row is pressed', () => {
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Thành viên'));
    expect(defaultProps.onOpenMembers).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenInvite when Mời thành viên row is pressed', () => {
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Mời thành viên'));
    expect(defaultProps.onOpenInvite).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a row is pressed', () => {
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Thành viên'));
    fireEvent.press(getByText('Mời thành viên'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('hides the invite row when the album is private', () => {
    mockUseAlbumStore.mockImplementation((selector: (s: { isPrivate: boolean | null }) => unknown) =>
      selector({ isPrivate: true }),
    );
    const { getByText, queryByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(queryByText('Mời thành viên')).toBeNull();
  });
});
