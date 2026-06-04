jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 375, height: 812 }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { PendingPhotoRow } from '@/components/timeline/PendingPhotoRow';
import { PendingPhotoCell } from '@/components/timeline/PendingPhotoCell';
import type { PendingPhoto } from '@/stores/pendingUploadStore';

function makePhoto(id: string, status: PendingPhoto['status'] = 'uploading'): PendingPhoto {
  return { id, localUri: `file://${id}.jpg`, status };
}

describe('PendingPhotoRow', () => {
  it('renders one PendingPhotoCell for a single photo', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a')]} rowIndex={0} />,
    );
    expect(UNSAFE_getAllByType(PendingPhotoCell)).toHaveLength(1);
  });

  it('renders two PendingPhotoCells for two photos', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a'), makePhoto('b')]} rowIndex={0} />,
    );
    expect(UNSAFE_getAllByType(PendingPhotoCell)).toHaveLength(2);
  });

  it('passes localUri and status from each photo to PendingPhotoCell', () => {
    const photos: PendingPhoto[] = [
      { id: 'x', localUri: 'file://x.jpg', status: 'done' },
      { id: 'y', localUri: 'file://y.jpg', status: 'error' },
    ];
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={photos} rowIndex={0} />,
    );
    const cells = UNSAFE_getAllByType(PendingPhotoCell);
    expect(cells[0].props.localUri).toBe('file://x.jpg');
    expect(cells[0].props.status).toBe('done');
    expect(cells[1].props.localUri).toBe('file://y.jpg');
    expect(cells[1].props.status).toBe('error');
  });

  it('passes correct index accounting for rowIndex', () => {
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a'), makePhoto('b')]} rowIndex={2} />,
    );
    const cells = UNSAFE_getAllByType(PendingPhotoCell);
    expect(cells[0].props.index).toBe(4); // rowIndex * 2 + 0
    expect(cells[1].props.index).toBe(5); // rowIndex * 2 + 1
  });

  it('computes cell size to fill width with gap', () => {
    // width=375, paddingHorizontal=24*2=48, gap=4, 2 cells
    // cellSize = (375 - 48 - 4) / 2 = 161.5
    const { UNSAFE_getAllByType } = render(
      <PendingPhotoRow photos={[makePhoto('a'), makePhoto('b')]} rowIndex={0} />,
    );
    const cells = UNSAFE_getAllByType(PendingPhotoCell);
    expect(cells[0].props.size).toBeCloseTo(161.5, 0);
  });
});
