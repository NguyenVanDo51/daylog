import React from 'react';
import { render } from '@testing-library/react-native';
import { Mascot } from './Mascot';

describe('Mascot', () => {
  it('renders the mascot image source', () => {
    const { getByTestId } = render(<Mascot testID="m" />);
    expect(getByTestId('m').props.source).toBeTruthy();
  });

  it('applies the requested size to width and height', () => {
    const { getByTestId } = render(<Mascot size={64} testID="m" />);
    expect(getByTestId('m').props.style).toEqual(
      expect.objectContaining({ width: 64, height: 64 }),
    );
  });

  it('rotates by the playful magnitude when tilt="playful"', () => {
    const { getByTestId } = render(<Mascot tilt="playful" testID="m" />);
    expect(getByTestId('m').props.style).toEqual(
      expect.objectContaining({ transform: [{ rotate: '2deg' }] }),
    );
  });

  it('flips the rotation sign when flip is true', () => {
    const { getByTestId } = render(<Mascot tilt="default" flip testID="m" />);
    expect(getByTestId('m').props.style).toEqual(
      expect.objectContaining({ transform: [{ rotate: '-1deg' }] }),
    );
  });

  it('omits transform when tilt="none"', () => {
    const { getByTestId } = render(<Mascot testID="m" />);
    expect(getByTestId('m').props.style).not.toHaveProperty('transform');
  });
});
