import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { colors, spacing } from '@/constants/theme';

describe('HeaderGradient', () => {
  it('renders its children inside the gradient wrapper', () => {
    const { getByText } = render(
      <HeaderGradient>
        <Text>Header child</Text>
      </HeaderGradient>,
    );
    expect(getByText('Header child')).toBeTruthy();
  });

  it('renders the mocked LinearGradient with the theme gradient colors', () => {
    const { UNSAFE_getByType } = render(
      <HeaderGradient>
        <Text>x</Text>
      </HeaderGradient>,
    );
    // expo-linear-gradient is mocked to the host-component string 'LinearGradient' in jest.setup.js
    const gradient = UNSAFE_getByType('LinearGradient' as unknown as React.ComponentType);
    expect(gradient).toBeTruthy();
    expect(gradient.props.colors).toEqual([colors.gradientStart, colors.gradientEnd]);
    expect(gradient.props.start).toEqual({ x: 0, y: 0 });
    expect(gradient.props.end).toEqual({ x: 1, y: 1 });
  });

  it('applies paddingTop = safe-area inset top + spacing.lg', () => {
    // jest.setup.js mocks useSafeAreaInsets to { top: 0, ... }
    const { UNSAFE_getByType } = render(
      <HeaderGradient>
        <Text>x</Text>
      </HeaderGradient>,
    );
    const gradient = UNSAFE_getByType('LinearGradient' as unknown as React.ComponentType);
    const styles = Array.isArray(gradient.props.style)
      ? Object.assign({}, ...gradient.props.style.flat().filter(Boolean))
      : gradient.props.style;
    expect(styles.paddingTop).toBe(0 + spacing.lg);
    expect(styles.paddingHorizontal).toBe(spacing['2xl']);
    expect(styles.paddingBottom).toBe(spacing['2xl']);
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <HeaderGradient>
        <Text>first</Text>
        <Text>second</Text>
      </HeaderGradient>,
    );
    expect(getByText('first')).toBeTruthy();
    expect(getByText('second')).toBeTruthy();
  });
});
