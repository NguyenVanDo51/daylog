import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MilestoneLabelInput } from './MilestoneLabelInput';

jest.mock('@lodev09/react-native-true-sheet', () => {
  const React = require('react');
  const resolvedFn = jest.fn(() => Promise.resolve());
  return {
    TrueSheet: React.forwardRef(({ children, ...props }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: resolvedFn, dismiss: resolvedFn }), []);
      return React.createElement('TrueSheet', props, children);
    }),
  };
});

const noop = () => {};

test('renders current label as input default', () => {
  const { getByTestId } = render(
    <MilestoneLabelInput
      visible
      date="2026-06-04"
      initialLabel="Sinh nhật"
      onSave={noop}
      onClear={noop}
      onClose={noop}
    />
  );
  expect(getByTestId('label-input').props.value).toBe('Sinh nhật');
});

test('save triggers onSave with new value', () => {
  const onSave = jest.fn();
  const { getByTestId } = render(
    <MilestoneLabelInput
      visible date="2026-06-04" initialLabel="" onSave={onSave} onClear={noop} onClose={noop}
    />
  );
  fireEvent.changeText(getByTestId('label-input'), 'Sinh nhật');
  fireEvent.press(getByTestId('label-save'));
  expect(onSave).toHaveBeenCalledWith('Sinh nhật');
});

test('clear triggers onClear when there is an initial label', () => {
  const onClear = jest.fn();
  const { getByTestId } = render(
    <MilestoneLabelInput
      visible date="2026-06-04" initialLabel="X" onSave={noop} onClear={onClear} onClose={noop}
    />
  );
  fireEvent.press(getByTestId('label-clear'));
  expect(onClear).toHaveBeenCalled();
});

test('clear button hidden when no initial label', () => {
  const { queryByTestId } = render(
    <MilestoneLabelInput
      visible date="2026-06-04" initialLabel="" onSave={noop} onClear={noop} onClose={noop}
    />
  );
  expect(queryByTestId('label-clear')).toBeNull();
});
