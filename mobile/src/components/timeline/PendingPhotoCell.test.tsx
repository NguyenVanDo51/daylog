jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { PendingPhotoCell } from '@/components/timeline/PendingPhotoCell';

describe('PendingPhotoCell', () => {
  it('renders an Animated.Image with the local URI', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={150} />,
    );
    const images = UNSAFE_getAllByType(Animated.Image);
    expect(images[0].props.source).toEqual({ uri: 'file://photo.jpg' });
  });

  it('renders shimmer overlay when status is uploading', () => {
    const { getByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={150} />,
    );
    expect(getByTestId('shimmer-overlay')).toBeTruthy();
  });

  it('does not render shimmer when status is done', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="done" size={150} />,
    );
    expect(queryByTestId('shimmer-overlay')).toBeNull();
  });

  it('does not render shimmer when status is error', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="error" size={150} />,
    );
    expect(queryByTestId('shimmer-overlay')).toBeNull();
  });

  it('renders error badge when status is error', () => {
    const { getByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="error" size={150} />,
    );
    expect(getByTestId('error-badge')).toBeTruthy();
  });

  it('does not render error badge when status is uploading', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={150} />,
    );
    expect(queryByTestId('error-badge')).toBeNull();
  });

  it('does not render error badge when status is done', () => {
    const { queryByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="done" size={150} />,
    );
    expect(queryByTestId('error-badge')).toBeNull();
  });

  it('applies the given size to width and height', () => {
    const { getByTestId } = render(
      <PendingPhotoCell localUri="file://photo.jpg" status="uploading" size={200} />,
    );
    const container = getByTestId('pending-cell-container');
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 200, height: 200 })]),
    );
  });
});
