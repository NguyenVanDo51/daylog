import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { JoyfulHeader } from '../JoyfulHeader';

it('renders children', () => {
  const { getByText } = render(<JoyfulHeader><Text>Hi</Text></JoyfulHeader>);
  expect(getByText('Hi')).toBeTruthy();
});
