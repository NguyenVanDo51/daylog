import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { QuietHeader } from '../QuietHeader';

it('renders children', () => {
  const { getByText } = render(<QuietHeader><Text>Hi</Text></QuietHeader>);
  expect(getByText('Hi')).toBeTruthy();
});
