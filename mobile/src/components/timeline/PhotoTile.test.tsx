jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'expo-image'} />;
  },
}));
jest.mock('expo-video', () => ({
  VideoView: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'expo-video'} />;
  },
  useVideoPlayer: jest.fn(() => ({})),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));
jest.mock('@/hooks/useReactions', () => ({
  useReactions: jest.fn(() => ({ data: [] })),
  useReact: jest.fn(() => ({ add: { mutate: jest.fn() } })),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoTile } from '@/components/timeline/PhotoTile';
import { router } from 'expo-router';

beforeEach(() => {
  jest.clearAllMocks();
});

const basePhoto = {
  type: 'photo' as const,
  id: 'p1',
  r2_key: 'photos/p1.webp',
  thumbnail_key: 'thumbs/p1.webp',
  taken_at: '2026-01-01T00:00:00Z',
  caption: 'Bé cười',
  media_type: 'photo' as const,
  source: 'upload' as const,
  duration_ms: null,
  width: 1080,
  height: 1920,
};

test('navigates to photo detail on press', () => {
  const { getByTestId } = render(
    <PhotoTile photo={basePhoto} tileHeight={200} tileWidth={160} />
  );
  fireEvent.press(getByTestId('photo-tile'));
  expect(router.push).toHaveBeenCalledWith('/photo/p1');
});

test('shows video badge for video media type', () => {
  const { getByTestId } = render(
    <PhotoTile
      photo={{ ...basePhoto, media_type: 'video', duration_ms: 1500 }}
      tileHeight={200}
      tileWidth={160}
    />
  );
  expect(getByTestId('video-badge')).toBeTruthy();
});

test('hides video badge for photo media type', () => {
  const { queryByTestId } = render(
    <PhotoTile photo={basePhoto} tileHeight={200} tileWidth={160} />
  );
  expect(queryByTestId('video-badge')).toBeNull();
});
