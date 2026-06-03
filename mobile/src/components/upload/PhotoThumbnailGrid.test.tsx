import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image, TouchableOpacity } from 'react-native';

// @expo/vector-icons pulls in expo-font/expo-asset transitively which is not
// installed for jest. Replace the Ionicons set with a lightweight host
// component that simply forwards its `name` prop so we can assert on it.
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

import { PhotoThumbnailGrid } from '@/components/upload/PhotoThumbnailGrid';
import type { UploadAsset } from '@/hooks/useUpload';

function makeAssets(n: number): UploadAsset[] {
  return Array.from({ length: n }, (_, i) => ({
    uri: `file://photo-${i}.jpg`,
    localAssetId: `asset-${i}`,
    takenAt: null,
  }));
}

describe('PhotoThumbnailGrid', () => {
  it('renders N thumbnails for N assets', () => {
    const assets = makeAssets(3);
    const { UNSAFE_getAllByType } = render(
      <PhotoThumbnailGrid assets={assets} selected={new Set()} onToggle={jest.fn()} />,
    );
    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(3);
    expect(images[0].props.source).toEqual({ uri: 'file://photo-0.jpg' });
    expect(images[1].props.source).toEqual({ uri: 'file://photo-1.jpg' });
    expect(images[2].props.source).toEqual({ uri: 'file://photo-2.jpg' });
  });

  it('renders no thumbnails for an empty assets array', () => {
    const { UNSAFE_queryAllByType } = render(
      <PhotoThumbnailGrid assets={[]} selected={new Set()} onToggle={jest.fn()} />,
    );
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it('calls onToggle with the uri when a thumbnail is tapped', () => {
    const onToggle = jest.fn();
    const assets = makeAssets(2);
    const { UNSAFE_getAllByType } = render(
      <PhotoThumbnailGrid assets={assets} selected={new Set()} onToggle={onToggle} />,
    );
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[1]);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('file://photo-1.jpg');
  });

  it('only renders the check overlay for selected uris', () => {
    const assets = makeAssets(3);
    const selected = new Set(['file://photo-0.jpg', 'file://photo-2.jpg']);
    const { queryAllByTestId } = render(
      <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={jest.fn()} />,
    );
    // Mocked Ionicons render as a View with testID="Ionicons". One per selected asset.
    expect(queryAllByTestId('Ionicons')).toHaveLength(2);
  });

  it('renders no check overlays when nothing is selected', () => {
    const assets = makeAssets(3);
    const { queryAllByTestId } = render(
      <PhotoThumbnailGrid assets={assets} selected={new Set()} onToggle={jest.fn()} />,
    );
    expect(queryAllByTestId('Ionicons')).toHaveLength(0);
  });

  it('renders a check overlay for every selected asset', () => {
    const assets = makeAssets(4);
    const selected = new Set(assets.map((a) => a.uri));
    const { queryAllByTestId } = render(
      <PhotoThumbnailGrid assets={assets} selected={selected} onToggle={jest.fn()} />,
    );
    expect(queryAllByTestId('Ionicons')).toHaveLength(4);
  });

  it('passes the uri verbatim to onToggle even with multiple assets', () => {
    const onToggle = jest.fn();
    const assets = makeAssets(5);
    const { UNSAFE_getAllByType } = render(
      <PhotoThumbnailGrid assets={assets} selected={new Set()} onToggle={onToggle} />,
    );
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]);
    fireEvent.press(touchables[4]);
    expect(onToggle).toHaveBeenNthCalledWith(1, 'file://photo-0.jpg');
    expect(onToggle).toHaveBeenNthCalledWith(2, 'file://photo-4.jpg');
  });

  it('sets a square cellSize derived from the window width on each thumbnail', () => {
    // The mocked window width from RN defaults — only need to verify width === height.
    const assets = makeAssets(1);
    const { UNSAFE_getAllByType } = render(
      <PhotoThumbnailGrid assets={assets} selected={new Set()} onToggle={jest.fn()} />,
    );
    const image = UNSAFE_getAllByType(Image)[0];
    const style = image.props.style;
    expect(style.width).toBe(style.height);
    expect(typeof style.width).toBe('number');
    expect(typeof style.borderRadius).toBe('number');
  });
});
