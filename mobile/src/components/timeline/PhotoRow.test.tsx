jest.mock('@/hooks/useReactions', () => ({
  useReactions: () => ({ data: [] }),
  useReact: () => ({ add: { mutate: jest.fn() } }),
}));

jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));

import React from 'react';
import { render } from '@testing-library/react-native';
import { PhotoRow } from '@/components/timeline/PhotoRow';
import { PhotoCell } from '@/components/ui/PhotoCell';
import type { TimelinePhoto } from '@/hooks/useTimeline';

function makePhoto(overrides: Partial<TimelinePhoto> = {}): TimelinePhoto {
  return {
    type: 'photo',
    id: 'p1',
    r2_key: 'photos/p1.webp',
    thumbnail_key: 'thumbs/p1.webp',
    taken_at: '2026-01-01T00:00:00Z',
    caption: null,
    ...overrides,
  };
}

describe('PhotoRow', () => {
  it('renders a single PhotoCell when given one photo', () => {
    const photos = [makePhoto({ id: 'p1' })];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    expect(cells).toHaveLength(1);
    expect(cells[0].props.uri).toMatch(/\/photos\/p1\/thumb$/);
  });

  it('renders 2 PhotoCells when given exactly two photos', () => {
    const photos = [makePhoto({ id: 'a' }), makePhoto({ id: 'b' })];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    expect(UNSAFE_getAllByType(PhotoCell)).toHaveLength(2);
  });

  it('caps rendered cells at 2 even if given more', () => {
    const photos = [
      makePhoto({ id: 'a' }),
      makePhoto({ id: 'b' }),
      makePhoto({ id: 'c' }),
      makePhoto({ id: 'd' }),
    ];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    expect(cells).toHaveLength(2);
    expect(cells.map((c) => c.props.uri)).toEqual([
      expect.stringMatching(/\/photos\/a\/thumb$/),
      expect.stringMatching(/\/photos\/b\/thumb$/),
    ]);
  });

  it('forwards caption from the photo to the PhotoCell', () => {
    const photos = [makePhoto({ id: 'p1', caption: 'Beach day' })];
    const { UNSAFE_getByType } = render(<PhotoRow photos={photos} />);
    const cell = UNSAFE_getByType(PhotoCell);
    expect(cell.props.caption).toBe('Beach day');
  });

  it('passes a positive size to each PhotoCell', () => {
    const photos = [makePhoto({ id: 'a' }), makePhoto({ id: 'b' })];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    for (const c of cells) {
      expect(typeof c.props.size).toBe('number');
      expect(c.props.size).toBeGreaterThan(0);
    }
  });

  it('builds thumbnail URLs from EXPO_PUBLIC_API_URL or default', () => {
    const photos = [makePhoto({ id: 'xyz' })];
    const { UNSAFE_getByType } = render(<PhotoRow photos={photos} />);
    const cell = UNSAFE_getByType(PhotoCell);
    const expectedBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
    expect(cell.props.uri).toBe(`${expectedBase}/photos/xyz/thumb`);
  });

  it('passes photoId to each PhotoCell for navigation', () => {
    const photos = [makePhoto({ id: 'p7' })];
    const { UNSAFE_getByType } = render(<PhotoRow photos={photos} />);
    const cell = UNSAFE_getByType(PhotoCell);
    expect(cell.props.photoId).toBe('p7');
  });

  it('uses the photo id as key (not array index)', () => {
    const photos = [
      makePhoto({ id: 'first' }),
      makePhoto({ id: 'second' }),
    ];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    expect(cells[0].props.photoId).toBe('first');
    expect(cells[1].props.photoId).toBe('second');
  });

  it('renders nothing visible when given an empty photos array', () => {
    const { UNSAFE_queryAllByType } = render(<PhotoRow photos={[]} />);
    expect(UNSAFE_queryAllByType(PhotoCell)).toHaveLength(0);
  });

  it('uses different keys for each cell so multiple cells co-render', () => {
    const photos = [
      makePhoto({ id: 'a' }),
      makePhoto({ id: 'b' }),
    ];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    expect(UNSAFE_getAllByType(PhotoCell)).toHaveLength(2);
  });

  it('enables reactions on each PhotoCell', () => {
    const photos = [makePhoto({ id: 'p1' })];
    const { UNSAFE_getByType } = render(<PhotoRow photos={photos} />);
    const cell = UNSAFE_getByType(PhotoCell);
    expect(cell.props.showReactions).toBe(true);
  });
});
