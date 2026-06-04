jest.mock('@/hooks/useReactions', () => ({
  useReactions: () => ({ data: [] }),
  useReact: () => ({ add: { mutate: jest.fn() } }),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image, TouchableOpacity } from 'react-native';
import { PhotoCell } from '@/components/ui/PhotoCell';

const flattenStyle = (s: unknown): Record<string, unknown> =>
  Array.isArray(s)
    ? Object.assign({}, ...s.flat().filter(Boolean))
    : ((s ?? {}) as Record<string, unknown>);

describe('PhotoCell', () => {
  it('renders an image with the given uri', () => {
    const { UNSAFE_getByType } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={80} />
    );
    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://example.com/photo.jpg' });
    expect(image.props.resizeMode).toBe('cover');
  });

  it('does not render a caption when caption prop is omitted', () => {
    const { queryByText } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={80} />
    );
    // No text descendants at all when no caption.
    expect(queryByText(/.+/)).toBeNull();
  });

  it('does not render a caption when caption is null', () => {
    const { queryByText } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={80} caption={null} />
    );
    expect(queryByText(/.+/)).toBeNull();
  });

  it('does not render a caption when caption is an empty string', () => {
    const { queryByText } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={80} caption="" />
    );
    expect(queryByText(/.+/)).toBeNull();
  });

  it('renders the caption text when provided', () => {
    const { getByText } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={80} caption="Hello" />
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders caption with numberOfLines=1 (truncated)', () => {
    const { getByText } = render(
      <PhotoCell
        uri="https://example.com/photo.jpg"
        size={80}
        caption="A really long caption that should be truncated"
      />
    );
    const captionNode = getByText('A really long caption that should be truncated');
    expect(captionNode.props.numberOfLines).toBe(1);
  });

  it('applies the size prop to width and height', () => {
    const { UNSAFE_getByType } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={120} />
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flat = flattenStyle(touchable.props.style);
    expect(flat.width).toBe(120);
    expect(flat.height).toBe(120);
  });

  it('merges custom style prop with internal styles', () => {
    const { UNSAFE_getByType } = render(
      <PhotoCell
        uri="https://example.com/photo.jpg"
        size={80}
        style={{ margin: 5 }}
      />
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flat = flattenStyle(touchable.props.style);
    expect(flat.margin).toBe(5);
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <PhotoCell
        uri="https://example.com/photo.jpg"
        size={80}
        onPress={onPress}
      />
    );
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not crash when pressed without onPress', () => {
    const { UNSAFE_getByType } = render(
      <PhotoCell uri="https://example.com/photo.jpg" size={80} />
    );
    expect(() => fireEvent.press(UNSAFE_getByType(TouchableOpacity))).not.toThrow();
  });
});
