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

import { VlogOverlay } from '@/components/story/VlogOverlay';
import { DayPhoto } from '@/hooks/useDayPhotos';

const makePhoto = (overrides: Partial<DayPhoto> = {}): DayPhoto => ({
  id: 'p1',
  media_type: 'photo',
  duration_ms: null,
  taken_at: '2025-12-25T13:42:00Z',
  caption: null,
  uploaded_by: 'u1',
  ...overrides,
});

describe('VlogOverlay — static rendering', () => {
  it('time text is rendered with the photo time', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto()} currentIndex={0} total={1} />,
    );
    expect(getByTestId('media-caption-time')).toBeTruthy();
    expect(getByTestId('media-caption-time').props.children).not.toBe('');
  });

  it('renders empty caption Text when caption is null', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: null })} currentIndex={0} total={1} />,
    );
    expect(getByTestId('media-caption-text').props.children).toBe('');
  });

  it('renders empty caption Text when caption is empty string', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: '' })} currentIndex={0} total={1} />,
    );
    expect(getByTestId('media-caption-text').props.children).toBe('');
  });

  it('renders full caption string immediately when caption is present', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Xin chào' })} currentIndex={0} total={1} />,
    );
    expect(getByTestId('media-caption-text').props.children).toBe('Xin chào');
  });
});
