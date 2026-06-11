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

  it('renders caption element on mount when caption is present', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Buổi sáng' })} currentIndex={0} total={1} />,
    );
    // All words rendered from mount to reserve centered layout; opacity staggers in.
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

  it('caption collapses to plain string after stagger completes', () => {
    // 2 words → stagger 1*160ms + fade 280ms = 440ms; advance well past.
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Xin chào' })} currentIndex={0} total={1} />,
    );
    act(() => { jest.advanceTimersByTime(1200); });
    expect(getByTestId('media-caption-text').props.children).toBe('Xin chào');
  });

  it('does not complete caption reveal while paused', () => {
    const { getByTestId } = render(
      <VlogOverlay
        photo={makePhoto({ caption: 'Xin chào' })}
        currentIndex={0}
        total={1}
        isPaused
      />,
    );
    act(() => { jest.advanceTimersByTime(2000); });
    // While paused, the done-timer never fires, so it stays as the array of TypingChar nodes
    // rather than collapsing to the plain caption string.
    expect(getByTestId('media-caption-text').props.children).not.toBe('Xin chào');
  });

  it('resumes caption reveal after unpausing', () => {
    const photo = makePhoto({ caption: 'Xin chào' });
    const { getByTestId, rerender } = render(
      <VlogOverlay photo={photo} currentIndex={0} total={1} isPaused />,
    );
    act(() => { jest.advanceTimersByTime(500); });
    rerender(
      <VlogOverlay photo={photo} currentIndex={0} total={1} isPaused={false} />,
    );
    act(() => { jest.advanceTimersByTime(2000); });
    expect(getByTestId('media-caption-text').props.children).toBe('Xin chào');
  });
});
