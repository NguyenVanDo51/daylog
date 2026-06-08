import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Pan: () => ({
        activeOffsetX: () => ({ onEnd: () => ({}) }),
      }),
    },
  };
});

jest.mock('expo-router', () => {
  const existing = jest.requireActual('expo-router');
  return {
    ...existing,
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      dismissAll: jest.fn(),
      canGoBack: jest.fn(() => false),
    },
    useLocalSearchParams: jest.fn(() => ({ albumId: 'test-album', date: '2026-05-01' })),
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => '/'),
    useFocusEffect: jest.fn((cb: () => void) => {
      try { cb(); } catch {}
    }),
  };
});

jest.mock('@/hooks/useDayPhotos', () => ({
  useDayPhotos: jest.fn(() => ({
    data: [
      { id: 'p1', media_type: 'photo', taken_at: '2026-05-01T08:00:00Z', caption: null, uploaded_by: 'u1', duration_ms: null },
      { id: 'p2', media_type: 'photo', taken_at: '2026-05-01T12:00:00Z', caption: null, uploaded_by: 'u1', duration_ms: null },
    ],
    isLoading: false,
  })),
}));

jest.mock('@/hooks/useAlbumDays', () => ({
  useAlbumDays: jest.fn(() => ({ data: [{ date: '2026-05-01' }] })),
}));

jest.mock('@/hooks/useStoryExport', () => ({
  useStoryExport: jest.fn(() => ({ exporting: false, exportStory: jest.fn() })),
}));

import { router } from 'expo-router';
import StoryScreen from '../story/[albumId]/[date]';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('StoryScreen navigation', () => {
  it('loops back to first photo instead of closing when advancing past the last photo', () => {
    const { getByTestId } = render(<StoryScreen />);

    // Advance to last photo (index 1 of 2)
    fireEvent.press(getByTestId('story-next'));

    // Trigger goNext at last photo — should loop, not close
    fireEvent.press(getByTestId('story-next'));

    expect(router.back).not.toHaveBeenCalled();
  });

  it('does not render story-progress bar', () => {
    const { queryByTestId } = render(<StoryScreen />);
    expect(queryByTestId('story-progress')).toBeNull();
  });

  it('back button calls router.back', () => {
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('renders date chip with DD.MM.YYYY format', () => {
    const { getByTestId } = render(<StoryScreen />);
    // route param date is '2026-05-01', chip should show '01.05.2026'
    expect(getByTestId('story-date-chip').props.children).toBe('01.05.2026');
  });
});
