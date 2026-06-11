import React from 'react';
import { render } from '@testing-library/react-native';
import { StickerChip } from './StickerChip';
import { theme } from '@/constants/theme';

describe('StickerChip', () => {
  it('renders the label text', () => {
    const { getByText } = render(<StickerChip label="128" />);
    expect(getByText('128')).toBeTruthy();
  });

  it('uses the yellow variant by default', () => {
    const { getByTestId } = render(<StickerChip label="x" testID="c" />);
    const styles = getByTestId('c').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.components.stickerChip.yellow.backgroundColor);
  });

  it.each([
    ['yellow'], ['pink'], ['mint'], ['sky'], ['white'], ['ink'],
  ] as const)('renders %s variant with the matching theme preset', (variant) => {
    const { getByTestId } = render(<StickerChip label="x" variant={variant} testID="c" />);
    const styles = getByTestId('c').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.components.stickerChip[variant].backgroundColor);
    expect(flat.borderColor).toBe(theme.components.stickerChip[variant].borderColor);
  });

  it('applies tilt and flip', () => {
    const { getByTestId } = render(<StickerChip label="x" tilt="default" flip testID="c" />);
    const styles = getByTestId('c').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.transform).toEqual([{ rotate: '-1deg' }]);
  });
});
