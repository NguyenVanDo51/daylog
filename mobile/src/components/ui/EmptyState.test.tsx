import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders the emoji and message', () => {
    const { getByText } = render(
      <EmptyState emoji="📭" message="Nothing here yet" />,
    );
    expect(getByText('📭')).toBeTruthy();
    expect(getByText('Nothing here yet')).toBeTruthy();
  });

  it('renders different content when props change', () => {
    const { getByText } = render(
      <EmptyState emoji="🎉" message="All caught up!" />,
    );
    expect(getByText('🎉')).toBeTruthy();
    expect(getByText('All caught up!')).toBeTruthy();
  });

  it('still renders even with empty strings', () => {
    const { UNSAFE_root } = render(<EmptyState emoji="" message="" />);
    expect(UNSAFE_root).toBeTruthy();
  });
});
