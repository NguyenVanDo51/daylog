// Updated mock: setPage now fires onPageSelected so activePage state updates in tests
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

// Updated mock: exposes onTabPress via a test button so close-btn flow is testable
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
  AlbumsPage: () => {
    const { View } = require('react-native');
    return require('react').createElement(View, { testID: 'albums-page' });
  },
}));

jest.mock('@/components/tabs/CustomTabBar', () => ({
  CustomTabBar: ({ activePage, onTabPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    const React = require('react');
    return React.createElement(
      View,
      { testID: 'custom-tab-bar' },
      React.createElement(TouchableOpacity, { testID: 'tab-camera', onPress: () => onTabPress(0) }),
      React.createElement(TouchableOpacity, { testID: 'tab-albums', onPress: () => onTabPress(1) }),
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

  it('renders tab bar when albums page is active (default)', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('custom-tab-bar')).toBeTruthy();
  });

  it('tab bar renders camera and albums tabs', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('tab-camera')).toBeTruthy();
    expect(getByTestId('tab-albums')).toBeTruthy();
  });

  it('hides tab bar when camera page becomes active', async () => {
    const { queryByTestId, getByTestId } = render(<MainScreen />);
    expect(queryByTestId('custom-tab-bar')).toBeTruthy();
    fireEvent.press(getByTestId('tab-camera'));
    await waitFor(() => expect(queryByTestId('custom-tab-bar')).toBeNull());
  });

  it('shows tab bar again when navigating back to albums via close btn', async () => {
    const { queryByTestId, getByTestId } = render(<MainScreen />);
    fireEvent.press(getByTestId('tab-camera'));
    await waitFor(() => expect(queryByTestId('custom-tab-bar')).toBeNull());
    fireEvent.press(getByTestId('camera-close-btn'));
    await waitFor(() => expect(queryByTestId('custom-tab-bar')).toBeTruthy());
  });

  it('passes onTabPress to CameraPage', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('camera-close-btn')).toBeTruthy();
  });
});
