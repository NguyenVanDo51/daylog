import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StickerButton } from './StickerButton';
import { theme } from '@/constants/theme';

jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));

describe('StickerButton', () => {
  it('renders the label', () => {
    const { getByText } = render(<StickerButton label="Save" onPress={() => {}} />);
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<StickerButton label="Tap" onPress={onPress} />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<StickerButton label="x" onPress={onPress} disabled testID="b" />);
    fireEvent.press(getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<StickerButton label="x" onPress={onPress} loading testID="b" />);
    fireEvent.press(getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['primary'], ['secondary'], ['inverted'], ['surface'], ['danger'], ['ghost'],
  ] as const)('applies %s variant from theme.components.stickerButton', (variant) => {
    const { getByTestId } = render(<StickerButton label="x" onPress={() => {}} variant={variant} testID="b" />);
    const styles = getByTestId('b').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.components.stickerButton[variant].backgroundColor);
  });

  it('uses stickerHeavy shadow when shadow="heavy"', () => {
    const { getByTestId } = render(<StickerButton label="x" onPress={() => {}} shadow="heavy" testID="b" />);
    const styles = getByTestId('b').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.shadowOffset).toEqual(theme.shadows.stickerHeavy.shadowOffset);
  });
});
