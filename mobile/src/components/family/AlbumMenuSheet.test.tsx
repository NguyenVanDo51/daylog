import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onOpenMembers: jest.fn(),
  onOpenInvite: jest.fn(),
  onOpenQR: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('AlbumMenuSheet', () => {
  it('renders all three menu row labels', () => {
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    expect(getByText('Thành viên')).toBeTruthy();
    expect(getByText('Mời thành viên')).toBeTruthy();
    expect(getByText('Quét mã QR')).toBeTruthy();
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

  it('calls onOpenQR when Quét mã QR row is pressed', () => {
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Quét mã QR'));
    expect(defaultProps.onOpenQR).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a row is pressed', () => {
    const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
    fireEvent.press(getByText('Thành viên'));
    fireEvent.press(getByText('Mời thành viên'));
    fireEvent.press(getByText('Quét mã QR'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
