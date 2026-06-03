import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { colors } from '@/constants/theme';

function flatten(style: any): any {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat().filter(Boolean));
  }
  return style;
}

describe('Badge', () => {
  it('renders the label', () => {
    const { getByText } = render(<Badge label="NEW" />);
    expect(getByText('NEW')).toBeTruthy();
  });

  it('defaults to the pink color', () => {
    const { getByText, UNSAFE_getByType } = render(<Badge label="PINK" />);
    const text = getByText('PINK');
    const textStyle = flatten(text.props.style);
    // Text color should be ink (dark)
    expect(textStyle.color).toBe(colors.ink);

    const container = UNSAFE_getByType(View);
    const containerStyle = flatten(container.props.style);
    // Default color is pink with dashed border
    expect(containerStyle.backgroundColor).toBe(colors.pink);
    expect(containerStyle.borderWidth).toBe(1.5);
    expect(containerStyle.borderStyle).toBe('dashed');
    expect(containerStyle.borderColor).toBe(colors.ink);
  });

  it('renders with yellow color', () => {
    const { UNSAFE_getByType } = render(<Badge label="YELLOW" color="yellow" />);
    const container = UNSAFE_getByType(View);
    const containerStyle = flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(colors.yellow);
  });

  it('renders with mint color', () => {
    const { UNSAFE_getByType } = render(<Badge label="MINT" color="mint" />);
    const container = UNSAFE_getByType(View);
    const containerStyle = flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(colors.mint);
  });

  it('renders with peach color', () => {
    const { UNSAFE_getByType } = render(<Badge label="PEACH" color="peach" />);
    const container = UNSAFE_getByType(View);
    const containerStyle = flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(colors.peach);
  });

  it('renders with sky color', () => {
    const { UNSAFE_getByType } = render(<Badge label="SKY" color="sky" />);
    const container = UNSAFE_getByType(View);
    const containerStyle = flatten(container.props.style);
    expect(containerStyle.backgroundColor).toBe(colors.sky);
  });
});
