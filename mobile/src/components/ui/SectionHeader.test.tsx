import React from 'react';
import { render } from '@testing-library/react-native';
import { SectionHeader } from '@/components/ui/SectionHeader';

describe('SectionHeader', () => {
  it('renders the title uppercased', () => {
    const { getByText, queryByText } = render(<SectionHeader title="Recent" />);
    expect(getByText('RECENT')).toBeTruthy();
    // Original-case should not be present.
    expect(queryByText('Recent')).toBeNull();
  });

  it('uppercases mixed-case titles', () => {
    const { getByText } = render(<SectionHeader title="Hello World" />);
    expect(getByText('HELLO WORLD')).toBeTruthy();
  });

  it('handles an empty title without crashing', () => {
    const { toJSON } = render(<SectionHeader title="" />);
    expect(toJSON()).toBeTruthy();
  });

  it('keeps already-uppercase titles unchanged', () => {
    const { getByText } = render(<SectionHeader title="ALREADY" />);
    expect(getByText('ALREADY')).toBeTruthy();
  });

  it('preserves non-letter characters', () => {
    const { getByText } = render(<SectionHeader title="part 1 / 2" />);
    expect(getByText('PART 1 / 2')).toBeTruthy();
  });
});
