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

jest.mock('@/hooks/useCapture', () => ({
  useCapture: jest.fn(() => ({
    capture: jest.fn().mockResolvedValue({}),
    canCapture: true,
    nextAvailableAt: null,
    capturing: false,
  })),
}));

jest.mock('@/hooks/useUpload', () => ({
  useUpload: jest.fn(() => ({
    pickImages: jest.fn(),
    uploadImages: jest.fn().mockResolvedValue(0),
    uploading: false,
    progress: 0,
    failedCount: 0,
  })),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn(), success: jest.fn() }));

jest.mock('@/components/ui/Confetti', () => {
  const React = require('react');
  return { Confetti: () => React.createElement('View', { testID: 'confetti' }) };
});

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({ loop: false, muted: false, play: jest.fn() })),
}));

import { useCapture } from '@/hooks/useCapture';
import { useUpload } from '@/hooks/useUpload';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { router } from 'expo-router';
import PhotoReviewScreen from '../photo-review';

function setStoreAssets(assets: any[]) {
  usePhotoReviewStore.setState({ assets });
}

beforeEach(() => {
  jest.clearAllMocks();
  usePhotoReviewStore.setState({ assets: [] });
});

describe('PhotoReview — single camera asset', () => {
  beforeEach(() => {
    setStoreAssets([{ uri: 'file://shot.jpg', type: 'photo', source: 'camera', takenAt: new Date().toISOString() }]);
  });

  it('renders polaroid card with note input', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...')).toBeTruthy();
  });

  it('shows Chụp lại button for camera source', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByText('Chụp lại')).toBeTruthy();
  });

  it('shows Gửi button', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByText('Gửi')).toBeTruthy();
  });

  it('pressing Gửi calls useCapture.capture with the asset and caption', async () => {
    const captureMock = jest.fn().mockResolvedValue({});
    (useCapture as jest.Mock).mockReturnValue({ capture: captureMock, canCapture: true, nextAvailableAt: null, capturing: false });
    const utils = render(<PhotoReviewScreen />);
    fireEvent.changeText(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...'), 'hello');
    await act(async () => { fireEvent.press(utils.getByText('Gửi')); });
    await waitFor(() => expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file://shot.jpg', source: 'camera' }),
      'hello',
    ));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('pressing Chụp lại calls router.back', () => {
    const utils = render(<PhotoReviewScreen />);
    fireEvent.press(utils.getByText('Chụp lại'));
    expect(router.back).toHaveBeenCalled();
  });

  it('shows cooldown Alert when canCapture is false and user presses Gửi', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (useCapture as jest.Mock).mockReturnValue({
      capture: jest.fn(),
      canCapture: false,
      nextAvailableAt: new Date(Date.now() + 20 * 60 * 1000),
      capturing: false,
    });
    const utils = render(<PhotoReviewScreen />);
    await act(async () => { fireEvent.press(utils.getByText('Gửi')); });
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('khoảnh khắc'),
      expect.any(String),
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });
});

describe('PhotoReview — single gallery asset', () => {
  beforeEach(() => {
    setStoreAssets([{ uri: 'file://gallery.jpg', type: 'photo', source: 'gallery', takenAt: null, localAssetId: 'lid1' }]);
  });

  it('renders note field', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...')).toBeTruthy();
  });

  it('does NOT show Chụp lại for gallery source', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.queryByText('Chụp lại')).toBeNull();
  });

  it('pressing Gửi calls useUpload.uploadImages with caption', async () => {
    const uploadImages = jest.fn().mockResolvedValue(0);
    (useUpload as jest.Mock).mockReturnValue({ pickImages: jest.fn(), uploadImages, uploading: false, progress: 0, failedCount: 0 });
    const utils = render(<PhotoReviewScreen />);
    fireEvent.changeText(utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...'), 'sundays');
    await act(async () => { fireEvent.press(utils.getByText('Gửi')); });
    await waitFor(() => expect(uploadImages).toHaveBeenCalledWith(
      [expect.objectContaining({ uri: 'file://gallery.jpg' })],
      'sundays',
    ));
    expect(router.dismissAll).toHaveBeenCalled();
  });
});

describe('PhotoReview — multiple gallery assets', () => {
  beforeEach(() => {
    setStoreAssets([
      { uri: 'file://a.jpg', type: 'photo', source: 'gallery', takenAt: null },
      { uri: 'file://b.jpg', type: 'photo', source: 'gallery', takenAt: null },
      { uri: 'file://c.jpg', type: 'photo', source: 'gallery', takenAt: null },
    ]);
  });

  it('does NOT show note field', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.queryByPlaceholderText('ghi chú nhỏ cho ảnh...')).toBeNull();
  });

  it('shows upload CTA with count', () => {
    const utils = render(<PhotoReviewScreen />);
    expect(utils.getByText('Tải lên 3 ảnh')).toBeTruthy();
  });

  it('pressing upload CTA calls uploadImages with selected assets', async () => {
    const uploadImages = jest.fn().mockResolvedValue(0);
    (useUpload as jest.Mock).mockReturnValue({ pickImages: jest.fn(), uploadImages, uploading: false, progress: 0, failedCount: 0 });
    const utils = render(<PhotoReviewScreen />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên 3 ảnh')); });
    await waitFor(() => expect(uploadImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ uri: 'file://a.jpg' })]),
      undefined,
    ));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('shows Alert on partial failure', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const uploadImages = jest.fn().mockResolvedValue(1);
    (useUpload as jest.Mock).mockReturnValue({ pickImages: jest.fn(), uploadImages, uploading: false, progress: 0, failedCount: 0 });
    const utils = render(<PhotoReviewScreen />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên 3 ảnh')); });
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Tải lên không hoàn tất', expect.any(String)));
    alertSpy.mockRestore();
  });
});

describe('PhotoReview — empty assets', () => {
  it('navigates back when assets is empty on mount', () => {
    usePhotoReviewStore.setState({ assets: [] });
    render(<PhotoReviewScreen />);
    expect(router.back).toHaveBeenCalled();
  });
});
