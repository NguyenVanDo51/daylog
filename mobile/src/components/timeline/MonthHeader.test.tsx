import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MonthHeader } from '@/components/timeline/MonthHeader';

describe('MonthHeader', () => {
  it('renders the label uppercased', () => {
    const { getByText, queryByText } = render(<MonthHeader label="january · 2026" />);
    expect(getByText('JANUARY · 2026')).toBeTruthy();
    expect(queryByText('january · 2026')).toBeNull();
  });

  it('keeps already-uppercased labels intact', () => {
    const { getByText } = render(<MonthHeader label="MARCH · 5 MONTHS" />);
    expect(getByText('MARCH · 5 MONTHS')).toBeTruthy();
  });

  it('handles an empty label without throwing', () => {
    const { UNSAFE_getByType } = render(<MonthHeader label="" />);
    const node = UNSAFE_getByType(Text);
    expect(node.props.children).toBe('');
  });

  it('renders a single Text node with style applied', () => {
    const { UNSAFE_getByType } = render(<MonthHeader label="feb" />);
    const node = UNSAFE_getByType(Text);
    expect(node.props.children).toBe('FEB');
    const flatStyle = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.flat().filter(Boolean))
      : node.props.style;
    // marginTop and marginBottom come from spacing tokens; just verify presence.
    expect(typeof flatStyle.marginTop).toBe('number');
    expect(typeof flatStyle.marginBottom).toBe('number');
  });

  it('uppercases mixed-case unicode-ish labels', () => {
    const { getByText } = render(<MonthHeader label="Décembre · 12 months" />);
    // Note: toUpperCase() on the ASCII subset uppercases the parts we control.
    expect(getByText('DÉCEMBRE · 12 MONTHS')).toBeTruthy();
  });
});
