jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, style }: any) =>
      React.createElement(View, { style }, children),
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Pan: () => ({
        activeOffsetX: function () { return this; },
        onEnd: function () { return this; },
      }),
    },
  };
});
jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: any) => fn,
}));

jest.mock('@/components/timeline/DayPage', () => ({
  DayPage: ({ dateKey }: any) => {
    const { View, Text } = require('react-native');
    return <View testID={`day-page-${dateKey}`}><Text>{dateKey}</Text></View>;
  },
}));
jest.mock('@/components/timeline/MilestoneLabelInput', () => ({
  MilestoneLabelInput: () => null,
}));
jest.mock('@/hooks/useTimeline', () => ({ useTimeline: jest.fn(() => ({ data: { pages: [] } })) }));
jest.mock('@/hooks/useDayLabels', () => ({
  useDayLabelsRange: jest.fn(() => ({ data: [] })),
  useUpsertDayLabel: jest.fn(() => ({ mutate: jest.fn() })),
  useDeleteDayLabel: jest.fn(() => ({ mutate: jest.fn() })),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/stores/captureStore', () => ({
  useCaptureStore: { getState: () => ({ lastCaptureAt: null }) },
  getCooldownRemaining: () => 0,
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayPager } from './DayPager';
import { toDateKey } from '@/lib/dateKey';

test('lands on today by default', () => {
  const { getByTestId } = render(<DayPager />);
  const todayKey = toDateKey(new Date());
  expect(getByTestId(`day-page-${todayKey}`)).toBeTruthy();
});

test('lands on an initial date when given', () => {
  const { getByTestId } = render(<DayPager initialDateKey="2026-01-15" />);
  expect(getByTestId('day-page-2026-01-15')).toBeTruthy();
});

test('prev/next testIDs change the active date', () => {
  const { getByTestId } = render(<DayPager initialDateKey="2026-01-15" />);
  fireEvent.press(getByTestId('day-pager-prev'));
  expect(getByTestId('day-page-2026-01-14')).toBeTruthy();
  fireEvent.press(getByTestId('day-pager-next'));
  expect(getByTestId('day-page-2026-01-15')).toBeTruthy();
});

test('does not advance past today', () => {
  const todayKey = toDateKey(new Date());
  const { getByTestId } = render(<DayPager initialDateKey={todayKey} />);
  fireEvent.press(getByTestId('day-pager-next'));
  expect(getByTestId(`day-page-${todayKey}`)).toBeTruthy();
});
