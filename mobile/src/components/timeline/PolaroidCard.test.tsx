import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PolaroidCard } from './PolaroidCard';
import type { TimelinePhoto } from '@/hooks/useTimeline';

jest.mock('@/hooks/useReactions', () => ({
  useReactions: () => ({ data: [] }),
  useReact: () => ({ add: { mutate: jest.fn() } }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));
jest.mock('expo-image', () => ({
  Image: ({ testID }: any) => <></>,
}));

const basePhoto: TimelinePhoto = {
  type: 'photo',
  id: 'photo-1',
  r2_key: 'photos/photo-1.webp',
  thumbnail_key: 'photos/photo-1-thumb.webp',
  taken_at: '2026-06-04T10:30:00.000Z',
  caption: null,
  media_type: 'photo',
  source: 'capture',
  duration_ms: null,
};

describe('PolaroidCard', () => {
  it('renders date stamp from taken_at', () => {
    render(<PolaroidCard photo={basePhoto} />);
    expect(screen.getByTestId('polaroid-date')).toBeTruthy();
  });

  it('renders caption when provided', () => {
    render(<PolaroidCard photo={{ ...basePhoto, caption: 'bé cười' }} />);
    expect(screen.getByText('bé cười')).toBeTruthy();
  });

  it('does not render caption element when caption is null', () => {
    render(<PolaroidCard photo={basePhoto} />);
    expect(screen.queryByTestId('polaroid-caption')).toBeNull();
  });

  it('renders video indicator for media_type=video', () => {
    render(<PolaroidCard photo={{ ...basePhoto, media_type: 'video', duration_ms: 1800 }} />);
    expect(screen.getByTestId('polaroid-video-badge')).toBeTruthy();
  });
});
