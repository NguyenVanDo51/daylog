jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Tap: () => ({ runOnJS: () => ({ onStart: () => ({}) }) }),
      LongPress: () => ({ minDuration: () => ({ runOnJS: () => ({ onStart: () => ({ onEnd: () => ({ onFinalize: () => ({}) }) }) }) }) }),
      Exclusive: () => ({}),
    },
  };
});

jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: { PORTRAIT_UP: 'PORTRAIT_UP' },
}));

jest.mock('@/stores/photoReviewStore', () => ({
  usePhotoReviewStore: { getState: () => ({ setAssets: jest.fn() }) },
}));

// Pretend hint was already seen so setShowHint never fires async state updates
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('1'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CameraPage } from '../CameraPage';
import * as ScreenOrientation from 'expo-screen-orientation';

const setup = (onTabPress = jest.fn()) =>
  render(<CameraPage onTabPress={onTabPress} />);

describe('CameraPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not render orientation toggle button', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('orientation-toggle')).toBeNull();
  });

  it('renders close button', () => {
    const { getByTestId } = setup();
    expect(getByTestId('close-btn')).toBeTruthy();
  });

  it('calls onTabPress(1) when close button is pressed', () => {
    const onTabPress = jest.fn();
    const { getByTestId } = setup(onTabPress);
    fireEvent.press(getByTestId('close-btn'));
    expect(onTabPress).toHaveBeenCalledWith(1);
    expect(onTabPress).toHaveBeenCalledTimes(1);
  });

  it('renders clock display with HH:mm format', () => {
    const { getByTestId } = setup();
    const clock = getByTestId('clock-display');
    expect(clock.props.children).toMatch(/^\d{2}:\d{2}$/);
  });

  it('locks orientation to portrait on mount', async () => {
    setup();
    await waitFor(() => {
      expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
    });
  });
});
