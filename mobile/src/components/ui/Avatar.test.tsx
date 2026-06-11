import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from './Avatar';
import { theme } from '@/constants/theme';

jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('Avatar', () => {
  it('renders the mascot fallback when src is null', () => {
    const { getByText } = render(<Avatar />);
    expect(getByText('🐱')).toBeTruthy();
  });

  it('renders the image when src is provided', () => {
    const { queryByText, getByTestId } = render(
      <Avatar src="https://x/avatar.jpg" testID="a" />,
    );
    expect(queryByText('🐱')).toBeNull();
    expect(getByTestId('a-image')).toBeTruthy();
  });

  it('respects the size prop on the outer container', () => {
    const { getByTestId } = render(<Avatar size={60} testID="a" />);
    const styles = getByTestId('a').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.width).toBe(60);
    expect(flat.height).toBe(60);
    expect(flat.borderRadius).toBe(30);
  });

  it('applies the requested theme color as background when no image', () => {
    const { getByTestId } = render(<Avatar bgColor="accent2" testID="a" />);
    const styles = getByTestId('a').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.colors.accent2);
  });

  it('renders the camera overlay when withCameraOverlay is true', () => {
    const { getByTestId } = render(<Avatar withCameraOverlay testID="a" />);
    expect(getByTestId('a-camera-overlay')).toBeTruthy();
  });
});
