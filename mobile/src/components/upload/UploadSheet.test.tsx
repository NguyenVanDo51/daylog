import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { Image, TouchableOpacity, Alert } from 'react-native';

// @expo/vector-icons pulls in expo-font/expo-asset transitively which is not
// installed for jest. Replace icon sets with lightweight host components.
jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, { ...props, ref, testID: props.testID ?? label }),
    );
  return {
    Ionicons: makeIcon('Ionicons'),
    MaterialIcons: makeIcon('MaterialIcons'),
    MaterialCommunityIcons: makeIcon('MaterialCommunityIcons'),
    FontAwesome: makeIcon('FontAwesome'),
    FontAwesome5: makeIcon('FontAwesome5'),
    Feather: makeIcon('Feather'),
    AntDesign: makeIcon('AntDesign'),
    Entypo: makeIcon('Entypo'),
  };
});

jest.mock('@/hooks/useUpload', () => ({
  useUpload: jest.fn(() => ({
    pickImages: jest.fn(),
    uploadImages: jest.fn(),
    uploading: false,
    progress: 0,
    failedCount: 0,
  })),
}));

jest.mock('@/lib/haptics', () => ({ success: jest.fn(), tap: jest.fn() }));

// TrueSheet is mocked as string 'TrueSheet' in jest.setup.js.
// We need to capture the onPresent callback to simulate the sheet show event.
// Override the global mock with a functional version.
jest.mock('@lodev09/react-native-true-sheet', () => {
  const React = require('react');
  let onPresentRef: (() => void) | undefined;
  const TrueSheet = React.forwardRef((props: any, ref: any) => {
    onPresentRef = props.onPresent;
    // Expose imperative methods via ref
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return React.createElement('TrueSheet', props, props.children);
  });
  (TrueSheet as any).__firePresent = () => { onPresentRef?.(); };
  return { TrueSheet };
});

import { UploadSheet } from '@/components/upload/UploadSheet';
import { useUpload, type UploadAsset } from '@/hooks/useUpload';

const { TrueSheet } = require('@lodev09/react-native-true-sheet');

const mockedUseUpload = useUpload as jest.MockedFunction<typeof useUpload>;
let pickImagesMock: jest.Mock;
let uploadImagesMock: jest.Mock;
let uploadState: { uploading: boolean; progress: number } = {
  uploading: false,
  progress: 0,
};

function applyUseUploadMock(overrides: { uploadImages?: jest.Mock; failedCount?: number } = {}) {
  pickImagesMock = jest.fn();
  uploadImagesMock = overrides.uploadImages ?? jest.fn();
  mockedUseUpload.mockImplementation(() => ({
    pickImages: pickImagesMock as unknown as () => Promise<UploadAsset[]>,
    uploadImages: uploadImagesMock as unknown as (
      a: UploadAsset[],
      c?: string,
    ) => Promise<number>,
    uploading: uploadState.uploading,
    progress: uploadState.progress,
    failedCount: overrides.failedCount ?? 0,
  }));
}

function makeAssets(n: number): UploadAsset[] {
  return Array.from({ length: n }, (_, i) => ({
    uri: `file://photo-${i}.jpg`,
    localAssetId: `aid-${i}`,
    takenAt: null,
  }));
}

// Simulate TrueSheet onPresent callback (fires when sheet is presented)
async function fireSheetPresent() {
  await act(async () => {
    TrueSheet.__firePresent();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  uploadState = { uploading: false, progress: 0 };
  applyUseUploadMock();
});

describe('UploadSheet', () => {
  it('does not auto-pick when visible is false', async () => {
    pickImagesMock.mockResolvedValue([]);
    render(<UploadSheet visible={false} onClose={jest.fn()} />);
    await act(async () => {});
    expect(pickImagesMock).not.toHaveBeenCalled();
  });

  it('invokes pickImages after the sheet finishes its show animation', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(2));
    render(<UploadSheet visible={true} onClose={jest.fn()} />);
    expect(pickImagesMock).not.toHaveBeenCalled();
    await fireSheetPresent();
    expect(pickImagesMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when picker returns no assets (user cancelled)', async () => {
    pickImagesMock.mockResolvedValue([]);
    const onClose = jest.fn();
    render(<UploadSheet visible={true} onClose={onClose} />);
    await fireSheetPresent();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('renders the thumbnail grid for picked assets and the upload button', async () => {
    const assets = makeAssets(3);
    pickImagesMock.mockResolvedValue(assets);
    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();
    await waitFor(() => {
      // Vietnamese CTA: "Tải lên 3 ảnh"
      expect(utils.getByText('Tải lên 3 ảnh')).toBeTruthy();
    });
    expect(utils.UNSAFE_getAllByType(Image)).toHaveLength(3);
  });

  it('renders a singular Upload label when exactly one asset is selected', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(1));
    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();
    await waitFor(() => {
      // Vietnamese singular: "Tải lên 1 ảnh"
      expect(utils.getByText('Tải lên 1 ảnh')).toBeTruthy();
    });
  });

  it('calls uploadImages with selected assets and caption when Upload is pressed', async () => {
    const assets = makeAssets(2);
    pickImagesMock.mockResolvedValue(assets);
    uploadImagesMock.mockResolvedValue(undefined);
    const onClose = jest.fn();

    const utils = render(<UploadSheet visible={true} onClose={onClose} />);
    await fireSheetPresent();

    const captionInput = await waitFor(() =>
      utils.getByPlaceholderText('ghi chú nhỏ cho ảnh...'),
    );
    fireEvent.changeText(captionInput, 'family fun');

    const uploadBtn = await waitFor(() => utils.getByText('Tải lên 2 ảnh'));
    await act(async () => {
      fireEvent.press(uploadBtn);
    });

    expect(uploadImagesMock).toHaveBeenCalledTimes(1);
    expect(uploadImagesMock).toHaveBeenCalledWith(assets, 'family fun');
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('shows Alert when some uploads fail', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    applyUseUploadMock({ uploadImages: jest.fn().mockResolvedValue(2) });
    const assets = makeAssets(3);
    pickImagesMock.mockResolvedValue(assets);

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();

    const uploadBtn = await waitFor(() => utils.getByText('Tải lên 3 ảnh'));
    await act(async () => {
      fireEvent.press(uploadBtn);
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy).toHaveBeenCalledWith(
      'Tải lên không hoàn tất',
      expect.any(String),
    );

    alertSpy.mockRestore();
  });

  it('tapping a thumbnail toggles its selection (button label updates)', async () => {
    const assets = makeAssets(3);
    pickImagesMock.mockResolvedValue(assets);

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();

    await waitFor(() => expect(utils.getByText('Tải lên 3 ảnh')).toBeTruthy());

    const touchables = utils.UNSAFE_getAllByType(TouchableOpacity);
    const thumbnailTouchables = touchables.filter((t: any) => {
      let found = false;
      const visit = (n: any) => {
        if (!n) return;
        if (n.type === Image) found = true;
        const children: any[] = Array.isArray(n.children) ? n.children : [];
        children.forEach(visit);
      };
      visit(t);
      return found;
    });
    expect(thumbnailTouchables).toHaveLength(3);

    await act(async () => {
      fireEvent.press(thumbnailTouchables[0]);
    });

    await waitFor(() => expect(utils.getByText('Tải lên 2 ảnh')).toBeTruthy());

    await act(async () => {
      fireEvent.press(thumbnailTouchables[0]);
    });
    await waitFor(() => expect(utils.getByText('Tải lên 3 ảnh')).toBeTruthy());
  });

  it('renders progress text while uploading=true', async () => {
    uploadState = { uploading: true, progress: 0.5 };
    pickImagesMock.mockResolvedValue(makeAssets(2));

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();
    await waitFor(() => {
      // Vietnamese: "đang tải lên 1/2..."
      expect(utils.getByText(/đang tải lên/)).toBeTruthy();
    });
  });

  it('hides the progress text when uploading=false', async () => {
    uploadState = { uploading: false, progress: 0 };
    pickImagesMock.mockResolvedValue(makeAssets(1));

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();
    await waitFor(() => expect(utils.getByText('Tải lên 1 ảnh')).toBeTruthy());
    expect(utils.queryByText(/đang tải lên/)).toBeNull();
  });

  it('pressing Cancel (Huỷ) in the header calls onClose', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(1));
    const onClose = jest.fn();
    const utils = render(<UploadSheet visible={true} onClose={onClose} />);
    await fireSheetPresent();

    const cancelBtn = await waitFor(() => utils.getByText('Huỷ'));
    fireEvent.press(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('resets internal state when visible flips back to false', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(2));

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireSheetPresent();
    await waitFor(() => expect(utils.getByText('Tải lên 2 ảnh')).toBeTruthy());

    await act(async () => {
      utils.rerender(<UploadSheet visible={false} onClose={jest.fn()} />);
    });

    expect(utils.queryByText(/Tải lên 2 ảnh/)).toBeNull();
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });
});
