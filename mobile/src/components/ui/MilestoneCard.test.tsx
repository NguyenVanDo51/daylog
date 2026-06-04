import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MilestoneCard } from '@/components/ui/MilestoneCard';

describe('MilestoneCard', () => {
  it('renders the title', () => {
    const { getByText } = render(
      <MilestoneCard title="First step" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    expect(getByText('First step')).toBeTruthy();
  });

  it('renders a Vietnamese formatted date', () => {
    const { getByText } = render(
      <MilestoneCard title="First step" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    // Component formats as "D ThM · Tháng M YYYY"
    expect(getByText(/Tháng 9/)).toBeTruthy();
  });

  it('renders the note when provided', () => {
    const { getByText } = render(
      <MilestoneCard
        title="Walked"
        note="took three steps"
        occurredAt="2025-09-01T00:00:00.000Z"
      />,
    );
    expect(getByText('took three steps')).toBeTruthy();
  });

  it('does not render a note when note is undefined', () => {
    const { queryByText } = render(
      <MilestoneCard title="Walked" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    expect(queryByText('took three steps')).toBeNull();
  });

  it('does not render a note when note is null', () => {
    const { queryByText } = render(
      <MilestoneCard title="Walked" note={null} occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    expect(queryByText('Walked')).toBeTruthy();
  });

  it('does not render a note when note is an empty string', () => {
    const { queryAllByText } = render(
      <MilestoneCard title="Walked" note="" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    expect(queryAllByText('').length).toBe(0);
  });

  it('fires onPress when the card is tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <MilestoneCard
        title="Tap me"
        occurredAt="2025-09-01T00:00:00.000Z"
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not crash when tapped without an onPress handler', () => {
    const { getByText } = render(
      <MilestoneCard title="Tap me" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    expect(() => fireEvent.press(getByText('Tap me'))).not.toThrow();
  });
});
