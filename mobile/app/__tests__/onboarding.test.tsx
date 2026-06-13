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

const mockSetItemAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';

beforeEach(() => {
  mockReplace.mockClear();
  mockSetItemAsync.mockClear();
  useOnboardingStore.setState({ seen: false });
});

describe('OnboardingScreen', () => {
  it('renders page 1 title and skip button', () => {
    const { getByText, getByTestId } = render(<OnboardingScreen />);
    expect(getByText('Chào mừng đến Daylog!')).toBeTruthy();
    expect(getByTestId('onboarding-skip')).toBeTruthy();
    expect(getByTestId('onboarding-next')).toBeTruthy();
  });

  it('skip button persists seen and navigates to /(auth)', async () => {
    const { getByTestId } = render(<OnboardingScreen />);
    fireEvent.press(getByTestId('onboarding-skip'));
    await waitFor(() => expect(mockSetItemAsync).toHaveBeenCalledWith('onboarding.seen', '1'));
    expect(useOnboardingStore.getState().seen).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });

  it('next button advances the page', () => {
    const { getByTestId, getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByTestId('onboarding-next'));
    expect(getByText('Ghi lại mọi khoảnh khắc đáng nhớ')).toBeTruthy();
  });

  it('last page CTA finishes onboarding', async () => {
    const { getByTestId } = render(<OnboardingScreen />);
    // Advance 3 times to land on page 4
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-start'));
    await waitFor(() => expect(mockSetItemAsync).toHaveBeenCalledWith('onboarding.seen', '1'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });
});
