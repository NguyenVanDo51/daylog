import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { Image, Modal, TouchableOpacity } from 'react-native';

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
  })),
}));

import { UploadSheet } from '@/components/upload/UploadSheet';
import { useUpload, type UploadAsset } from '@/hooks/useUpload';

const mockedUseUpload = useUpload as jest.MockedFunction<typeof useUpload>;
let pickImagesMock: jest.Mock;
let uploadImagesMock: jest.Mock;
let uploadState: { uploading: boolean; progress: number } = {
  uploading: false,
  progress: 0,
};

function applyUseUploadMock() {
  pickImagesMock = jest.fn();
  uploadImagesMock = jest.fn();
  mockedUseUpload.mockImplementation(() => ({
    pickImages: pickImagesMock as unknown as () => Promise<UploadAsset[]>,
    uploadImages: uploadImagesMock as unknown as (
      a: UploadAsset[],
      c?: string,
    ) => Promise<void>,
    uploading: uploadState.uploading,
    progress: uploadState.progress,
  }));
}

function makeAssets(n: number): UploadAsset[] {
  return Array.from({ length: n }, (_, i) => ({
    uri: `file://photo-${i}.jpg`,
    localAssetId: `aid-${i}`,
    takenAt: null,
  }));
}

// iOS fires Modal.onShow once the page-sheet slide finishes; in jest we drive
// it manually so the picker invocation path runs.
async function fireModalShown(utils: ReturnType<typeof render>) {
  await act(async () => {
    utils.UNSAFE_getByType(Modal).props.onShow?.();
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

  it('invokes pickImages after the modal finishes its show animation', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(2));
    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    expect(pickImagesMock).not.toHaveBeenCalled();
    await fireModalShown(utils);
    expect(pickImagesMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when picker returns no assets (user cancelled)', async () => {
    pickImagesMock.mockResolvedValue([]);
    const onClose = jest.fn();
    const utils = render(<UploadSheet visible={true} onClose={onClose} />);
    await fireModalShown(utils);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('renders the thumbnail grid for picked assets and an Upload N Photos button', async () => {
    const assets = makeAssets(3);
    pickImagesMock.mockResolvedValue(assets);
    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireModalShown(utils);
    await waitFor(() => {
      expect(utils.getByText('Upload 3 Photos')).toBeTruthy();
    });
    // Grid renders one <Image> per asset.
    expect(utils.UNSAFE_getAllByType(Image)).toHaveLength(3);
  });

  it('renders a singular Upload label when exactly one asset is selected', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(1));
    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireModalShown(utils);
    await waitFor(() => {
      expect(utils.getByText('Upload 1 Photo')).toBeTruthy();
    });
  });

  it('calls uploadImages with selected assets and caption when Upload is pressed', async () => {
    const assets = makeAssets(2);
    pickImagesMock.mockResolvedValue(assets);
    uploadImagesMock.mockResolvedValue(undefined);
    const onClose = jest.fn();

    const utils = render(<UploadSheet visible={true} onClose={onClose} />);
    await fireModalShown(utils);

    const captionInput = await waitFor(() =>
      utils.getByPlaceholderText('Add a caption...'),
    );
    fireEvent.changeText(captionInput, 'family fun');

    const uploadBtn = await waitFor(() => utils.getByText('Upload 2 Photos'));
    await act(async () => {
      fireEvent.press(uploadBtn);
    });

    expect(uploadImagesMock).toHaveBeenCalledTimes(1);
    expect(uploadImagesMock).toHaveBeenCalledWith(assets, 'family fun');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('tapping a thumbnail toggles its selection (button label updates)', async () => {
    const assets = makeAssets(3);
    pickImagesMock.mockResolvedValue(assets);

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireModalShown(utils);

    await waitFor(() => expect(utils.getByText('Upload 3 Photos')).toBeTruthy());

    // Find the touchables that wrap an Image (the grid thumbnails).
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

    await waitFor(() => expect(utils.getByText('Upload 2 Photos')).toBeTruthy());

    // Tap the same thumbnail again to re-add it (exercises the `add` branch).
    await act(async () => {
      fireEvent.press(thumbnailTouchables[0]);
    });
    await waitFor(() => expect(utils.getByText('Upload 3 Photos')).toBeTruthy());

    // Now deselect again so the upload below has 2 items as expected.
    await act(async () => {
      fireEvent.press(thumbnailTouchables[0]);
    });
    await waitFor(() => expect(utils.getByText('Upload 2 Photos')).toBeTruthy());

    uploadImagesMock.mockResolvedValue(undefined);
    const uploadBtn = utils.getByText('Upload 2 Photos');
    await act(async () => {
      fireEvent.press(uploadBtn);
    });
    expect(uploadImagesMock).toHaveBeenCalledTimes(1);
    const [calledAssets, calledCaption] = uploadImagesMock.mock.calls[0];
    expect(calledAssets).toHaveLength(2);
    expect(calledAssets.map((a: UploadAsset) => a.uri)).toEqual([
      'file://photo-1.jpg',
      'file://photo-2.jpg',
    ]);
    expect(calledCaption).toBe('');
  });

  it('renders a progress percentage while uploading=true', async () => {
    uploadState = { uploading: true, progress: 0.42 };
    pickImagesMock.mockResolvedValue(makeAssets(1));

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireModalShown(utils);
    await waitFor(() => {
      expect(utils.getByText('42% uploaded...')).toBeTruthy();
    });
  });

  it('hides the progress text when uploading=false', async () => {
    uploadState = { uploading: false, progress: 0 };
    pickImagesMock.mockResolvedValue(makeAssets(1));

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireModalShown(utils);
    await waitFor(() => expect(utils.getByText('Upload 1 Photo')).toBeTruthy());
    expect(utils.queryByText(/uploaded\.\.\./)).toBeNull();
  });

  it('pressing Cancel in the header calls onClose', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(1));
    const onClose = jest.fn();
    const utils = render(<UploadSheet visible={true} onClose={onClose} />);
    await fireModalShown(utils);

    const cancelBtn = await waitFor(() => utils.getByText('Cancel'));
    fireEvent.press(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('resets internal state when visible flips back to false', async () => {
    pickImagesMock.mockResolvedValue(makeAssets(2));

    const utils = render(<UploadSheet visible={true} onClose={jest.fn()} />);
    await fireModalShown(utils);
    await waitFor(() => expect(utils.getByText('Upload 2 Photos')).toBeTruthy());

    // Hide the sheet — children are unmounted by RN Modal but the effect cleanup
    // path runs (setAssets([]), setSelected(new Set()), setCaption('')).
    await act(async () => {
      utils.rerender(<UploadSheet visible={false} onClose={jest.fn()} />);
    });

    // No grid items, no thumbnails, no Upload button visible after close.
    expect(utils.queryByText(/Upload 2 Photos/)).toBeNull();
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });
});
