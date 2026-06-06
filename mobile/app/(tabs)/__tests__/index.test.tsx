jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  const PagerView = React.forwardRef(({ children, onPageSelected, initialPage }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ setPage: jest.fn() }));
    return React.createElement(View, { testID: 'pager-view' }, children);
  });
  return { __esModule: true, default: PagerView };
});

jest.mock('@/components/tabs/CameraPage', () => ({
  CameraPage: () => {
    const { View } = require('react-native');
    return require('react').createElement(View, { testID: 'camera-page' });
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
    return React.createElement(View, { testID: 'custom-tab-bar' },
      React.createElement(TouchableOpacity, { testID: 'tab-camera', onPress: () => onTabPress(0) }),
      React.createElement(TouchableOpacity, { testID: 'tab-albums', onPress: () => onTabPress(1) }),
    );
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MainScreen from '../index';

beforeEach(() => jest.clearAllMocks());

describe('MainScreen', () => {
  it('renders PagerView with camera and albums pages', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('pager-view')).toBeTruthy();
    expect(getByTestId('camera-page')).toBeTruthy();
    expect(getByTestId('albums-page')).toBeTruthy();
  });

  it('renders custom tab bar', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('custom-tab-bar')).toBeTruthy();
  });

  it('tab bar renders camera and albums tabs', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('tab-camera')).toBeTruthy();
    expect(getByTestId('tab-albums')).toBeTruthy();
  });
});
