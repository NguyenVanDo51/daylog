import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

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

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));

import { FeedbackSheet } from '../FeedbackSheet';
import { api } from '@/lib/api';

const mockedPost = api.post as jest.Mock;

describe('FeedbackSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('submit button is disabled before a rating is selected', () => {
    const { getByTestId } = render(
      <FeedbackSheet visible={true} onClose={jest.fn()} />
    );
    expect(getByTestId('feedback-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('selecting a rating enables submit and shows the rating label', () => {
    const { getByTestId, getByText } = render(
      <FeedbackSheet visible={true} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('feedback-rating-4'));
    expect(getByText('Tốt')).toBeTruthy();
    expect(getByTestId('feedback-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('tapping a different emoji updates the selected label', () => {
    const { getByTestId, getByText, queryByText } = render(
      <FeedbackSheet visible={true} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('feedback-rating-2'));
    expect(getByText('Tệ')).toBeTruthy();
    fireEvent.press(getByTestId('feedback-rating-5'));
    expect(getByText('Rất tốt')).toBeTruthy();
    expect(queryByText('Tệ')).toBeNull();
  });

  it('successful submit posts payload, alerts, and calls onClose', async () => {
    mockedPost.mockResolvedValue({ status: 204 });
    const onClose = jest.fn();
    const { getByTestId } = render(
      <FeedbackSheet visible={true} onClose={onClose} />
    );
    fireEvent.press(getByTestId('feedback-rating-4'));
    fireEvent.changeText(getByTestId('feedback-message'), 'love it');
    await act(async () => { fireEvent.press(getByTestId('feedback-submit')); });
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    expect(mockedPost).toHaveBeenCalledWith('/feedback', {
      rating: 4,
      message: 'love it',
      app_version: '0.1.0',
      platform: expect.any(String),
    });
    expect(Alert.alert).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('omits message from payload when input is blank', async () => {
    mockedPost.mockResolvedValue({ status: 204 });
    const { getByTestId } = render(
      <FeedbackSheet visible={true} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('feedback-rating-3'));
    await act(async () => { fireEvent.press(getByTestId('feedback-submit')); });
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    const payload = mockedPost.mock.calls[0][1];
    expect(payload).not.toHaveProperty('message');
    expect(payload.rating).toBe(3);
  });

  it('on API failure: keeps sheet open and shows inline error', async () => {
    mockedPost.mockRejectedValue(new Error('network'));
    const onClose = jest.fn();
    const { getByTestId, findByText } = render(
      <FeedbackSheet visible={true} onClose={onClose} />
    );
    fireEvent.press(getByTestId('feedback-rating-1'));
    await act(async () => { fireEvent.press(getByTestId('feedback-submit')); });
    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(await findByText('Không gửi được. Thử lại nhé.')).toBeTruthy();
  });
});
