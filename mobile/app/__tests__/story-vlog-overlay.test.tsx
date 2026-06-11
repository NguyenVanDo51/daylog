import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('phosphor-react-native', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));

import { VlogOverlay } from '../story/[albumId]/_components/VlogOverlay';
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

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();
});

describe('VlogOverlay — static rendering', () => {
  it('time text is rendered with the photo time', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto()} currentIndex={0} total={1} />,
    );
    expect(getByTestId('media-caption-time')).toBeTruthy();
  });

  it('does not render caption element when caption is null', () => {
    const { queryByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: null })} currentIndex={0} total={1} />,
    );
    expect(queryByTestId('media-caption-text')).toBeNull();
  });

  it('does not render caption element when caption is empty string', () => {
    const { queryByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: '' })} currentIndex={0} total={1} />,
    );
    expect(queryByTestId('media-caption-text')).toBeNull();
  });

  it('renders caption element when caption is present (after animation starts)', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Buổi sáng' })} currentIndex={0} total={1} />,
    );
    // capAvailableMs=1000, 2 words → interval=500ms per word; advance past first tick
    act(() => { jest.advanceTimersByTime(600); });
    expect(getByTestId('media-caption-text')).toBeTruthy();
  });
});

describe('VlogOverlay — typewriter animation', () => {
  it('time text is non-empty on mount (static from photo.taken_at)', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto()} currentIndex={0} total={1} />,
    );
    expect(getByTestId('media-caption-time').props.children).not.toBe('');
  });

  it('caption node is absent on mount (animation has not started yet)', () => {
    const { queryByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Xin chào' })} currentIndex={0} total={1} />,
    );
    // MediaCaption only renders the Text node when caption is truthy;
    // displayedCaption starts as '' so the node should not be present yet.
    expect(queryByTestId('media-caption-text')).toBeNull();
  });

  it('caption reaches full text after enough time', () => {
    // time: 5 chars × 70ms = 350ms + 100ms gap + 8 chars × 35ms = 730ms → use 1200ms
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Xin chào' })} currentIndex={0} total={1} />,
    );
    act(() => { jest.advanceTimersByTime(1200); });
    expect(getByTestId('media-caption-text').props.children).toBe('Xin chào');
  });
});
