jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MilestoneRow } from '@/components/timeline/MilestoneRow';
import { router } from 'expo-router';

beforeEach(() => {
  jest.clearAllMocks();
});

const milestone = {
  type: 'milestone' as const,
  id: 'ms1',
  title: 'Bé biết đi!',
  note: 'Hôm nay là ngày đặc biệt',
  occurred_at: '2026-06-04T09:00:00Z',
  icon: null,
};

test('renders milestone title', () => {
  const { getByText } = render(<MilestoneRow milestone={milestone} />);
  expect(getByText('Bé biết đi!')).toBeTruthy();
});

test('navigates to milestone detail on press', () => {
  const { getByTestId } = render(<MilestoneRow milestone={milestone} />);
  fireEvent.press(getByTestId('milestone-row'));
  expect(router.push).toHaveBeenCalledWith('/milestone/ms1');
});
