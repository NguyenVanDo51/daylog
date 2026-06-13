jest.mock('@/hooks/useSoundtracks', () => ({
  useSoundtracks: () => ({
    data: [
      { id: 't1', key: 'lullaby_01', title: 'Mây trắng', artist: null, duration_ms: 30000 },
      { id: 't2', key: 'lullaby_02', title: 'Bình minh', artist: null, duration_ms: 40000 },
    ],
    isLoading: false,
  }),
}));

const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/useSetDaySoundtrack', () => ({
  useSetDaySoundtrack: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SoundtrackPickerSheet } from '@/components/story/SoundtrackPickerSheet';

beforeEach(() => mockMutateAsync.mockClear());

describe('SoundtrackPickerSheet', () => {
  test('renders track list with current selection marked', () => {
    const { getByTestId } = render(
      <SoundtrackPickerSheet
        albumId="a1"
        date="2026-06-15"
        currentSoundtrackId="t2"
        onClose={() => {}}
      />
    );
    expect(getByTestId('soundtrack-row-t1')).toBeTruthy();
    expect(getByTestId('soundtrack-row-t2-selected')).toBeTruthy();
  });

  test('tap row calls mutateAsync with track id', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SoundtrackPickerSheet
        albumId="a1"
        date="2026-06-15"
        currentSoundtrackId={null}
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('soundtrack-row-t1'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith('t1'));
    expect(onClose).toHaveBeenCalled();
  });

  test('tap "Tắt nhạc" calls mutateAsync with null', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <SoundtrackPickerSheet
        albumId="a1"
        date="2026-06-15"
        currentSoundtrackId="t1"
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('soundtrack-row-none'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(null));
    expect(onClose).toHaveBeenCalled();
  });
});
