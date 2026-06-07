jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, top: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomTabBar } from '../CustomTabBar';

const setup = (activePage = 1) => {
  const onTabPress = jest.fn();
  const utils = render(<CustomTabBar activePage={activePage} onTabPress={onTabPress} />);
  return { ...utils, onTabPress };
};

describe('CustomTabBar', () => {
  it('renders camera tab with correct testID', () => {
    const { getByTestId } = setup();
    expect(getByTestId('tab-camera')).toBeTruthy();
  });

  it('renders albums tab with correct testID', () => {
    const { getByTestId } = setup();
    expect(getByTestId('tab-albums')).toBeTruthy();
  });

  it('renders Vietnamese label for camera tab', () => {
    const { getByText } = setup();
    expect(getByText('Chụp ảnh')).toBeTruthy();
  });

  it('renders Vietnamese label for albums tab', () => {
    const { getByText } = setup();
    expect(getByText('Nhật ký')).toBeTruthy();
  });

  it('calls onTabPress(0) when camera tab is pressed', () => {
    const { getByTestId, onTabPress } = setup();
    fireEvent.press(getByTestId('tab-camera'));
    expect(onTabPress).toHaveBeenCalledWith(0);
    expect(onTabPress).toHaveBeenCalledTimes(1);
  });

  it('calls onTabPress(1) when albums tab is pressed', () => {
    const { getByTestId, onTabPress } = setup();
    fireEvent.press(getByTestId('tab-albums'));
    expect(onTabPress).toHaveBeenCalledWith(1);
    expect(onTabPress).toHaveBeenCalledTimes(1);
  });
});
