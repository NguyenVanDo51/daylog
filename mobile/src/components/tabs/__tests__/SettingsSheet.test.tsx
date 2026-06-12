import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@lodev09/react-native-true-sheet', () => {
  const ReactLib = require('react');
  const TrueSheet = ReactLib.forwardRef((props: any, ref: any) => {
    ReactLib.useImperativeHandle(ref, () => ({
      present: jest.fn(() => Promise.resolve()),
      dismiss: jest.fn(() => Promise.resolve()),
    }));
    return ReactLib.createElement('TrueSheet', props, props.children);
  });
  return { TrueSheet };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

import { SettingsSheet } from '../SettingsSheet';
import { router } from 'expo-router';

describe('SettingsSheet', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('does not render the logout row', () => {
    const { queryByTestId } = render(
      <SettingsSheet visible={true} onClose={jest.fn()} onOpenFeedback={jest.fn()} />
    );
    expect(queryByTestId('menu-logout')).toBeNull();
  });

  it('renders the feedback row', () => {
    const { getByTestId } = render(
      <SettingsSheet visible={true} onClose={jest.fn()} onOpenFeedback={jest.fn()} />
    );
    expect(getByTestId('menu-feedback')).toBeTruthy();
  });

  it('tapping settings row calls router.push and onClose', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SettingsSheet visible={true} onClose={onClose} onOpenFeedback={jest.fn()} />
    );
    fireEvent.press(getByTestId('menu-settings'));
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('tapping feedback row calls onClose then onOpenFeedback', () => {
    const onClose = jest.fn();
    const onOpenFeedback = jest.fn();
    const { getByTestId } = render(
      <SettingsSheet visible={true} onClose={onClose} onOpenFeedback={onOpenFeedback} />
    );
    fireEvent.press(getByTestId('menu-feedback'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenFeedback).toHaveBeenCalled();
  });
});
