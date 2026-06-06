import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, { ...props, ref, testID: props.testID ?? label }),
    );
  return { Ionicons: makeIcon('Ionicons') };
});

jest.mock('@/hooks/useUpload', () => ({
  useUpload: jest.fn(() => ({
    pickImages: jest.fn().mockResolvedValue([]),
    uploadImages: jest.fn(),
    uploading: false,
    progress: 0,
    failedCount: 0,
  })),
}));

jest.mock('@/stores/photoReviewStore', () => ({
  usePhotoReviewStore: jest.fn(() => ({ setAssets: jest.fn(), assets: [], clear: jest.fn() })),
}));

jest.mock('@lodev09/react-native-true-sheet', () => {
  const React = require('react');
  let onPresentRef: (() => void) | undefined;
  const TrueSheet = React.forwardRef((props: any, ref: any) => {
    onPresentRef = props.onDidPresent;
    const resolvedFn = jest.fn(() => Promise.resolve());
    React.useImperativeHandle(ref, () => ({ present: resolvedFn, dismiss: resolvedFn }));
    return React.createElement('TrueSheet', props, props.children);
  });
  (TrueSheet as any).__firePresent = () => { onPresentRef?.(); };
  return { TrueSheet };
});

import { AddPhotoSheet } from '@/components/ui/AddPhotoSheet';
import { useUpload } from '@/hooks/useUpload';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { router } from 'expo-router';

const { TrueSheet } = require('@lodev09/react-native-true-sheet');

describe('AddPhotoSheet', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('renders camera and upload rows', () => {
    const utils = render(<AddPhotoSheet visible={true} onClose={jest.fn()} />);
    expect(utils.getByText('Chụp ảnh mới')).toBeTruthy();
    expect(utils.getByText('Tải lên')).toBeTruthy();
  });

  it('pressing camera row navigates to /capture and calls onClose', async () => {
    const onClose = jest.fn();
    const utils = render(<AddPhotoSheet visible={true} onClose={onClose} />);
    fireEvent.press(utils.getByText('Chụp ảnh mới'));
    expect(router.push).toHaveBeenCalledWith('/capture');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('pressing upload row calls pickImages; on cancel calls onClose without navigating', async () => {
    const pickImages = jest.fn().mockResolvedValue([]);
    (useUpload as jest.Mock).mockReturnValue({ pickImages, uploadImages: jest.fn(), uploading: false, progress: 0, failedCount: 0 });
    const onClose = jest.fn();
    const utils = render(<AddPhotoSheet visible={true} onClose={onClose} />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên')); });
    await waitFor(() => expect(pickImages).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalledWith('/photo-review');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing upload row: on picked assets, sets store and navigates to /photo-review', async () => {
    const assets = [{ uri: 'file://a.jpg', localAssetId: 'id1', takenAt: null }];
    const pickImages = jest.fn().mockResolvedValue(assets);
    const setAssets = jest.fn();
    (useUpload as jest.Mock).mockReturnValue({ pickImages, uploadImages: jest.fn(), uploading: false, progress: 0, failedCount: 0 });
    (usePhotoReviewStore as unknown as jest.Mock).mockReturnValue({ setAssets, assets: [], clear: jest.fn() });
    const onClose = jest.fn();
    const utils = render(<AddPhotoSheet visible={true} onClose={onClose} />);
    await act(async () => { fireEvent.press(utils.getByText('Tải lên')); });
    await waitFor(() => {
      expect(setAssets).toHaveBeenCalledWith([
        expect.objectContaining({ uri: 'file://a.jpg', source: 'gallery', type: 'photo' }),
      ]);
      expect(router.push).toHaveBeenCalledWith('/photo-review');
    });
  });
});
