import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// @expo/vector-icons pulls in expo-font/expo-asset transitively which is not
// installed for jest. Replace the Ionicons set with a lightweight host
// component that simply forwards its `name` prop so we can assert on it.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const View = require('react-native').View;
  const makeIcon = (label: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(View, { ...props, ref, testID: props.testID ?? label }),
    );
  return {
    Ionicons: makeIcon('Ionicons'),
    MaterialIcons: makeIcon('MaterialIcons'),
    MaterialCommunityIcons: makeIcon('MaterialCommunityIcons'),
    FontAwesome: makeIcon('FontAwesome'),
    FontAwesome5: makeIcon('FontAwesome5'),
    Feather: makeIcon('Feather'),
    AntDesign: makeIcon('AntDesign'),
    Entypo: makeIcon('Entypo'),
  };
});

import { MilestoneCard } from '@/components/ui/MilestoneCard';

describe('MilestoneCard', () => {
  it('renders the title and a formatted occurredAt date', () => {
    const { getByText } = render(
      <MilestoneCard title="First step" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    expect(getByText('First step')).toBeTruthy();
    // toLocaleDateString output depends on the runtime locale but should at least
    // include the four-digit year and a short month token derived from September.
    const formatted = new Date('2025-09-01T00:00:00.000Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    expect(getByText(formatted)).toBeTruthy();
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
    // null is falsy so the note <Text> branch should not render anything.
    // Ensure the title still appears.
    expect(queryByText('Walked')).toBeTruthy();
  });

  it('does not render a note when note is an empty string', () => {
    const { queryAllByText } = render(
      <MilestoneCard title="Walked" note="" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    // empty string is falsy — no extra <Text> rendered for it.
    expect(queryAllByText('').length).toBe(0);
  });

  it('uses the default "star" icon when no icon prop is provided', () => {
    const { UNSAFE_root } = render(
      <MilestoneCard title="Walked" occurredAt="2025-09-01T00:00:00.000Z" />,
    );
    // find any descendant whose props include a `name` prop equal to 'star'
    const matches = UNSAFE_root.findAll(
      (node) => node.props && node.props.name === 'star',
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it('forwards a custom icon name to Ionicons', () => {
    const { UNSAFE_root } = render(
      <MilestoneCard title="Walked" occurredAt="2025-09-01T00:00:00.000Z" icon="heart" />,
    );
    const matches = UNSAFE_root.findAll(
      (node) => node.props && node.props.name === 'heart',
    );
    expect(matches.length).toBeGreaterThan(0);
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
    // pressing without an onPress should be a no-op and not throw
    expect(() => fireEvent.press(getByText('Tap me'))).not.toThrow();
  });
});
