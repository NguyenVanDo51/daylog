jest.mock('@/components/timeline/MasonryBlock', () => ({
  MasonryBlock: ({ block }: any) => {
    const { View, Text } = require('react-native');
    const count = (block?.left?.length ?? 0) + (block?.right?.length ?? 0);
    return <View testID="masonry-block"><Text>{count} photos</Text></View>;
  },
  distributeMasonry: jest.fn((photos: any[]) => ({
    left: photos.map((p: any) => ({ photo: p, tileHeight: 100 })),
    right: [],
  })),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayPage } from './DayPage';
import { toDateKey } from '@/lib/dateKey';

const samplePhoto = (id: string) => ({
  id, taken_at: '2026-06-04T10:00:00Z', caption: '', width: 100, height: 100, type: 'photo' as const, album_id: 'a', uploaded_by: 'u', media_type: 'photo', source: 'upload',
});

test('today + empty: shows camera CTA, not upload', () => {
  const todayKey = toDateKey(new Date());
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey={todayKey} photos={[]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('day-camera-cta')).toBeTruthy();
  expect(queryByTestId('day-upload-cta')).toBeNull();
});

test('past + empty: shows upload CTA, not camera', () => {
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey="2026-01-01" photos={[]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('day-upload-cta')).toBeTruthy();
  expect(queryByTestId('day-camera-cta')).toBeNull();
});

test('today + photos: shows masonry + small camera FAB', () => {
  const todayKey = toDateKey(new Date());
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey={todayKey} photos={[samplePhoto('p1')] as any} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('masonry-block')).toBeTruthy();
  expect(getByTestId('day-camera-fab')).toBeTruthy();
  expect(queryByTestId('day-upload-fab')).toBeNull();
});

test('past + photos: shows masonry + small upload FAB', () => {
  const { getByTestId, queryByTestId } = render(
    <DayPage dateKey="2026-01-01" photos={[samplePhoto('p1')] as any} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByTestId('masonry-block')).toBeTruthy();
  expect(getByTestId('day-upload-fab')).toBeTruthy();
  expect(queryByTestId('day-camera-fab')).toBeNull();
});

test('label shown when present', () => {
  const { getByText } = render(
    <DayPage dateKey="2026-01-01" photos={[]} label="Sinh nhật" onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={jest.fn()} />
  );
  expect(getByText(/Sinh nhật/)).toBeTruthy();
});

test('tapping header calls onHeaderPress', () => {
  const onHeader = jest.fn();
  const { getByTestId } = render(
    <DayPage dateKey="2026-01-01" photos={[]} label={null} onCameraPress={jest.fn()} onUploadPress={jest.fn()} onHeaderPress={onHeader} />
  );
  fireEvent.press(getByTestId('day-header'));
  expect(onHeader).toHaveBeenCalled();
});
