import React from 'react';
import { render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';

describe('Avatar', () => {
  it('renders initials when no uri is provided', () => {
    const { getByText } = render(<Avatar name="Alice Smith" />);
    expect(getByText('AS')).toBeTruthy();
  });

  it('uppercases initials and limits to two characters', () => {
    const { getByText } = render(<Avatar name="john ronald reuel tolkien" />);
    // takes first letter of first two words: 'j' + 'r' -> 'JR'
    expect(getByText('JR')).toBeTruthy();
  });

  it('falls back gracefully for a single-word name', () => {
    const { getByText } = render(<Avatar name="Cher" />);
    expect(getByText('C')).toBeTruthy();
  });

  it('renders an Image when uri is provided', () => {
    const { UNSAFE_getByType, queryByText } = render(
      <Avatar uri="https://cdn.example.com/me.png" name="Alice Smith" />,
    );
    const img = UNSAFE_getByType(Image);
    expect(img).toBeTruthy();
    // initials should NOT be rendered when image path is taken
    expect(queryByText('AS')).toBeNull();
    // image source uses the provided uri
    expect(img.props.source).toEqual({ uri: 'https://cdn.example.com/me.png' });
  });

  it('treats null uri the same as undefined (falls back to initials)', () => {
    const { getByText } = render(<Avatar uri={null} name="Bob Builder" />);
    expect(getByText('BB')).toBeTruthy();
  });

  it('respects a custom size prop on the fallback circle', () => {
    const { getByText } = render(<Avatar name="Eve" size={60} />);
    const initialsNode = getByText('E');
    // initials font scales with size (60 * 0.36 = 21.6)
    const flatStyle = Array.isArray(initialsNode.props.style)
      ? Object.assign({}, ...initialsNode.props.style.flat().filter(Boolean))
      : initialsNode.props.style;
    expect(flatStyle.fontSize).toBeCloseTo(60 * 0.36);
  });

  it('uses the default size when none is provided (image variant)', () => {
    const { UNSAFE_getByType } = render(
      <Avatar uri="https://cdn.example.com/me.png" name="Alice Smith" />,
    );
    const img = UNSAFE_getByType(Image);
    const flatStyle = Array.isArray(img.props.style)
      ? Object.assign({}, ...img.props.style.flat().filter(Boolean))
      : img.props.style;
    // default size is 36
    expect(flatStyle.width).toBe(36);
    expect(flatStyle.height).toBe(36);
    expect(flatStyle.borderRadius).toBe(18);
  });
});
