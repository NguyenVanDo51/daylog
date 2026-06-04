import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors } from '@/constants/theme';

describe('LoadingSpinner', () => {
  it('renders an ActivityIndicator', () => {
    const { UNSAFE_getByType } = render(<LoadingSpinner />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('uses size="large" and the pink theme color', () => {
    const { UNSAFE_getByType } = render(<LoadingSpinner />);
    const indicator = UNSAFE_getByType(ActivityIndicator);
    expect(indicator.props.size).toBe('large');
    expect(indicator.props.color).toBe(colors.pink);
  });

  it('wraps the indicator in a centered, flex:1 container', () => {
    const { UNSAFE_getByType, toJSON } = render(<LoadingSpinner />);
    // first rendered node is the wrapper <View>; inspect its style.
    const tree = toJSON();
    expect(tree).toBeTruthy();
    // ActivityIndicator should be a descendant.
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    const wrapperStyle = Array.isArray((tree as any).props.style)
      ? Object.assign({}, ...(tree as any).props.style.flat().filter(Boolean))
      : (tree as any).props.style;
    expect(wrapperStyle.flex).toBe(1);
    expect(wrapperStyle.alignItems).toBe('center');
    expect(wrapperStyle.justifyContent).toBe('center');
  });
});
