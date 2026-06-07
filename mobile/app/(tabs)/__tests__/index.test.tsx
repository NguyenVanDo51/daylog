jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  const PagerView = React.forwardRef(({ children, onPageSelected }: any, ref: any) => {
    const cbRef = React.useRef(onPageSelected);
    React.useEffect(() => { cbRef.current = onPageSelected; });
    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn((page: number) => {
        cbRef.current?.({ nativeEvent: { position: page } });
      }),
    }));
    return React.createElement(View, { testID: 'pager-view' }, children);
  });
  return { __esModule: true, default: PagerView };
});

jest.mock('@/components/tabs/CameraPage', () => ({
  CameraPage: ({ onTabPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    const React = require('react');
    return React.createElement(
      View,
      { testID: 'camera-page' },
      React.createElement(TouchableOpacity, {
        testID: 'camera-close-btn',
        onPress: () => onTabPress(1),
      }),
    );
  },
}));

jest.mock('@/components/tabs/AlbumsPage', () => ({
  AlbumsPage: ({ onCameraPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    const React = require('react');
    return React.createElement(
      View,
      { testID: 'albums-page' },
      React.createElement(TouchableOpacity, {
        testID: 'camera-pill-btn',
        onPress: onCameraPress,
      }),
    );
  },
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MainScreen from '../index';

beforeEach(() => jest.clearAllMocks());

describe('MainScreen', () => {
  it('renders PagerView with camera and albums pages', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('pager-view')).toBeTruthy();
    expect(getByTestId('camera-page')).toBeTruthy();
    expect(getByTestId('albums-page')).toBeTruthy();
  });

  it('camera pill navigates to camera page', async () => {
    const { getByTestId } = render(<MainScreen />);
    fireEvent.press(getByTestId('camera-pill-btn'));
    await waitFor(() => expect(getByTestId('camera-page')).toBeTruthy());
  });

  it('close button on camera navigates back to albums', async () => {
    const { getByTestId } = render(<MainScreen />);
    fireEvent.press(getByTestId('camera-pill-btn'));
    fireEvent.press(getByTestId('camera-close-btn'));
    await waitFor(() => expect(getByTestId('albums-page')).toBeTruthy());
  });
});
