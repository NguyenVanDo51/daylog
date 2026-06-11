import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { StickerCard } from './StickerCard';
import { theme } from '@/constants/theme';

describe('StickerCard', () => {
  it('renders children inside the card', () => {
    const { getByText } = render(<StickerCard><Text>Hi</Text></StickerCard>);
    expect(getByText('Hi')).toBeTruthy();
  });

  it('uses the stickerCard preset from theme.components', () => {
    const { getByTestId } = render(<StickerCard testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.backgroundColor).toBe(theme.components.stickerCard.backgroundColor);
    expect(flat.borderWidth).toBe(theme.components.stickerCard.borderWidth);
    expect(flat.borderColor).toBe(theme.components.stickerCard.borderColor);
    expect(flat.borderRadius).toBe(theme.components.stickerCard.borderRadius);
  });

  it('rotates by theme.tilts.subtle when tilt="subtle"', () => {
    const { getByTestId } = render(<StickerCard tilt="subtle" testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.transform).toEqual([{ rotate: '0.5deg' }]);
  });

  it('flips the rotation when flip is true', () => {
    const { getByTestId } = render(<StickerCard tilt="default" flip testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.transform).toEqual([{ rotate: '-1deg' }]);
  });

  it('uses stickerHeavy shadow when shadow="heavy"', () => {
    const { getByTestId } = render(<StickerCard shadow="heavy" testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.shadowOffset).toEqual(theme.shadows.stickerHeavy.shadowOffset);
  });
});
