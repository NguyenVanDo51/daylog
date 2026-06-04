jest.mock('@/components/timeline/DayPager', () => ({
  DayPager: ({ initialDateKey }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="day-pager-mock"><Text>{initialDateKey ?? 'today'}</Text></View>;
  },
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { CalendarView } from './CalendarView';

test('renders DayPager', () => {
  const { getByTestId } = render(<CalendarView />);
  expect(getByTestId('day-pager-mock')).toBeTruthy();
});

test('forwards initialDateKey when provided', () => {
  const { getByText } = render(<CalendarView initialDateKey="2026-01-15" />);
  expect(getByText('2026-01-15')).toBeTruthy();
});
