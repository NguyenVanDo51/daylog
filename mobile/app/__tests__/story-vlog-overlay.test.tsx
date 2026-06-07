import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function VlogOverlay({ photo }: { photo: { taken_at: string; caption: string | null } }) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 }}
      pointerEvents="none"
    >
      <Text testID="vlog-date">{dateStr}</Text>
      <Text testID="vlog-time">▶ {timeStr}</Text>
      {photo.caption?.trim() ? <Text testID="vlog-caption">{photo.caption}</Text> : null}
    </LinearGradient>
  );
}

describe('VlogOverlay', () => {
  it('renders formatted date from taken_at', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: null };
    const { getByTestId } = render(<VlogOverlay photo={photo} />);

    expect(getByTestId('vlog-date').props.children).toMatch(/2025\.12\.25/);
  });

  it('renders caption when present', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: 'Bữa sáng gia đình' };
    const { getByTestId } = render(<VlogOverlay photo={photo} />);

    expect(getByTestId('vlog-caption').props.children).toBe('Bữa sáng gia đình');
  });

  it('does not render caption when null', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: null };
    const { queryByTestId } = render(<VlogOverlay photo={photo} />);

    expect(queryByTestId('vlog-caption')).toBeNull();
  });

  it('does not render caption when empty string', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: '' };
    const { queryByTestId } = render(<VlogOverlay photo={photo} />);

    expect(queryByTestId('vlog-caption')).toBeNull();
  });
});
