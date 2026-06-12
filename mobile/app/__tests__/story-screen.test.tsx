import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Pan: () => ({
        activeOffsetX: () => ({ runOnJS: () => ({ onEnd: () => ({}) }) }),
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

jest.mock('@/hooks/useDaySoundtrack', () => ({
  useDaySoundtrack: jest.fn(() => ({ data: null })),
}));

jest.mock('@/hooks/useSoundtrackCache', () => ({
  ensureSoundtrackCached: jest.fn(() => Promise.resolve('file://soundtrack.mp3')),
}));

jest.mock('@/hooks/useStoryExport', () => ({
  useStoryExport: jest.fn(() => ({ status: 'idle', error: null, exportStory: jest.fn(), reset: jest.fn() })),
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

  it('menu is hidden by default', () => {
    const { queryByTestId } = render(<StoryScreen />);
    expect(queryByTestId('story-menu-dropdown')).toBeNull();
  });

  it('menu opens when menu button is pressed', () => {
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-menu-btn'));
    expect(getByTestId('story-menu-dropdown')).toBeTruthy();
  });

  it('Kho ảnh navigates to library screen', () => {
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-menu-btn'));
    fireEvent.press(getByTestId('story-menu-library'));
    expect(router.push).toHaveBeenCalledWith('/library/test-album');
  });

  it('Lưu về máy calls exportStory', () => {
    const exportStoryMock = jest.fn();
    const { useStoryExport } = require('@/hooks/useStoryExport');
    useStoryExport.mockReturnValue({ status: 'idle', error: null, exportStory: exportStoryMock, reset: jest.fn() });
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-menu-btn'));
    fireEvent.press(getByTestId('story-menu-export'));
    expect(exportStoryMock).toHaveBeenCalledTimes(1);
  });

  it('backdrop tap closes the menu', () => {
    const { getByTestId, queryByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-menu-btn'));
    fireEvent.press(getByTestId('story-menu-backdrop'));
    expect(queryByTestId('story-menu-dropdown')).toBeNull();
  });

  it('renders correct number of progress dots', () => {
    const { getAllByTestId, getByTestId } = render(<StoryScreen />);
    // 2 photos in the mock → 1 active + 1 inactive = 2 total
    const inactive = getAllByTestId('story-dot');
    const active = getByTestId('story-dot-active');
    expect(inactive.length + 1).toBe(2); // 1 inactive + 1 active
    expect(active).toBeTruthy();
  });

  it('first dot is marked active by testID at initial index 0', () => {
    const { getByTestId, queryByTestId } = render(<StoryScreen />);
    // dot index 0 is active at start
    expect(getByTestId('story-dot-active')).toBeTruthy();
    // only one active dot
    expect(queryByTestId('story-dot-active')).not.toBeNull();
  });

  it('renders a centre pause button', () => {
    const { getByTestId } = render(<StoryScreen />);
    expect(getByTestId('story-pause-btn')).toBeTruthy();
  });

  it('tapping centre twice does not crash', () => {
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-pause-btn'));
    fireEvent.press(getByTestId('story-pause-btn'));
    expect(getByTestId('story-pause-btn')).toBeTruthy();
  });

  it('tapping next while paused does not crash', () => {
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-pause-btn'));
    fireEvent.press(getByTestId('story-next'));
    expect(getByTestId('story-pause-btn')).toBeTruthy();
  });

  it('tapping prev while paused does not crash', () => {
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-next'));
    fireEvent.press(getByTestId('story-pause-btn'));
    fireEvent.press(getByTestId('story-prev'));
    expect(getByTestId('story-pause-btn')).toBeTruthy();
  });

  it('renders progress line', () => {
    const { getByTestId } = render(<StoryScreen />);
    expect(getByTestId('story-progress-line')).toBeTruthy();
  });

  it('Xoá ảnh shows alert placeholder', () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<StoryScreen />);
    fireEvent.press(getByTestId('story-menu-btn'));
    fireEvent.press(getByTestId('story-menu-delete'));
    expect(alertSpy).toHaveBeenCalledWith('Xoá ảnh', expect.any(String));
    alertSpy.mockRestore();
  });
});
