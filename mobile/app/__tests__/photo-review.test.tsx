import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, { ...props, ref, testID: props.testID ?? label }),
    );
  return { Ionicons: makeIcon('Ionicons') };
});

const mockStartBackgroundUpload = jest.fn();
const mockFinishCapture = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/useCapture', () => ({
  useCapture: jest.fn(() => ({
    startBackgroundUpload: mockStartBackgroundUpload,
    finishCapture: mockFinishCapture,
  })),
}));

jest.mock('@/hooks/useAlbums', () => ({
  useAlbums: jest.fn(() => ({
    data: [
      { id: 'album-1', name: 'Gia đình', is_private: false, cover_photo_id: null },
      { id: 'album-2', name: 'Bạn bè', is_private: false, cover_photo_id: null },
    ],
  })),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn(), success: jest.fn() }));

jest.mock('@/components/ui/Confetti', () => {
  const React = require('react');
  return { Confetti: () => React.createElement('View', { testID: 'confetti' }) };
});

jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ label, onPress, disabled, testID }: any) =>
      React.createElement(TouchableOpacity, { testID: testID ?? 'button', onPress, disabled },
        React.createElement(Text, null, label)),
  };
});

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({ loop: false, muted: false, play: jest.fn() })),
}));

import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { router } from 'expo-router';
import PhotoReviewScreen from '../photo-review';

const photoAsset = {
  uri: 'file:///photo.jpg',
  type: 'photo' as const,
  source: 'camera' as const,
  takenAt: '2026-05-21T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  usePhotoReviewStore.setState({ assets: [photoAsset] });
  mockStartBackgroundUpload.mockResolvedValue({ r2Key: 'photos/abc.webp' });
});

describe('PhotoReview', () => {
  it('starts background upload on mount', () => {
    render(<PhotoReviewScreen />);
    expect(mockStartBackgroundUpload).toHaveBeenCalledWith(photoAsset);
  });

  it('shows album checkboxes', () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    expect(getByTestId('album-checkbox-album-1')).toBeTruthy();
    expect(getByTestId('album-checkbox-album-2')).toBeTruthy();
  });

  it('save button disabled until album selected', () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    const saveBtn = getByTestId('review-save');
    const isDisabled = saveBtn.props.disabled ?? saveBtn.props.accessibilityState?.disabled;
    expect(isDisabled).toBeTruthy();
  });

  it('pressing save calls finishCapture with selected album ids', async () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('album-checkbox-album-1'));
    fireEvent.press(getByTestId('album-checkbox-album-2'));
    await act(async () => { fireEvent.press(getByTestId('review-save')); });
    expect(mockFinishCapture).toHaveBeenCalledWith(
      { r2Key: 'photos/abc.webp' },
      photoAsset,
      expect.arrayContaining(['album-1', 'album-2']),
    );
  });

  it('shows error alert when background upload failed after retries', async () => {
    mockStartBackgroundUpload.mockRejectedValue(new Error('upload failed'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('album-checkbox-album-1'));
    await act(async () => { fireEvent.press(getByTestId('review-save')); });
    expect(alertSpy).toHaveBeenCalledWith('Lỗi', expect.any(String));
    expect(mockFinishCapture).not.toHaveBeenCalled();
  });

  it('shows error alert when finishCapture throws', async () => {
    mockFinishCapture.mockRejectedValueOnce(new Error('server error'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('album-checkbox-album-1'));
    await act(async () => { fireEvent.press(getByTestId('review-save')); });
    expect(alertSpy).toHaveBeenCalledWith('Lỗi', expect.any(String));
  });

  it('close button discards and navigates back', () => {
    const { getByTestId } = render(<PhotoReviewScreen />);
    fireEvent.press(getByTestId('review-close'));
    expect(router.back).toHaveBeenCalled();
  });

  it('navigates back when assets is empty on mount', () => {
    usePhotoReviewStore.setState({ assets: [] });
    render(<PhotoReviewScreen />);
    expect(router.back).toHaveBeenCalled();
  });
});
