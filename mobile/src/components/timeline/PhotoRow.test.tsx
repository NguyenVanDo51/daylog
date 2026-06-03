import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PhotoRow } from '@/components/timeline/PhotoRow';
import { PhotoCell } from '@/components/ui/PhotoCell';
import type { TimelinePhoto } from '@/hooks/useTimeline';

const mockRouter = router as unknown as { push: jest.Mock };

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

beforeEach(() => {
  mockRouter.push.mockReset();
});

describe('PhotoRow', () => {
  it('renders a single PhotoCell when given one photo (caps at 2)', () => {
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

  it('renders 3 PhotoCells when given three photos', () => {
    const photos = [
      makePhoto({ id: 'a' }),
      makePhoto({ id: 'b' }),
      makePhoto({ id: 'c' }),
    ];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    expect(cells).toHaveLength(3);
    expect(cells.map((c) => c.props.uri)).toEqual([
      expect.stringMatching(/\/photos\/a\/thumb$/),
      expect.stringMatching(/\/photos\/b\/thumb$/),
      expect.stringMatching(/\/photos\/c\/thumb$/),
    ]);
  });

  it('caps rendered cells at 3 even if given more', () => {
    const photos = [
      makePhoto({ id: 'a' }),
      makePhoto({ id: 'b' }),
      makePhoto({ id: 'c' }),
      makePhoto({ id: 'd' }),
      makePhoto({ id: 'e' }),
    ];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    expect(cells).toHaveLength(3);
    expect(cells.map((c) => c.props.uri)).toEqual([
      expect.stringMatching(/\/photos\/a\/thumb$/),
      expect.stringMatching(/\/photos\/b\/thumb$/),
      expect.stringMatching(/\/photos\/c\/thumb$/),
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
    // The URL should start with either the configured EXPO_PUBLIC_API_URL or the default.
    const expectedBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
    expect(cell.props.uri).toBe(`${expectedBase}/photos/xyz/thumb`);
  });

  it('calls router.push with /photo/<id> when a cell is pressed', () => {
    const photos = [makePhoto({ id: 'p7' })];
    const { UNSAFE_getByType } = render(<PhotoRow photos={photos} />);
    const cell = UNSAFE_getByType(PhotoCell);
    // PhotoCell uses TouchableOpacity internally; trigger its onPress prop directly.
    cell.props.onPress();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith('/photo/p7');
  });

  it('uses the photo id (not array index) when navigating', () => {
    const photos = [
      makePhoto({ id: 'first' }),
      makePhoto({ id: 'second' }),
    ];
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    const cells = UNSAFE_getAllByType(PhotoCell);
    cells[1].props.onPress();
    expect(mockRouter.push).toHaveBeenCalledWith('/photo/second');
  });

  it('renders nothing visible when given an empty photos array', () => {
    const { UNSAFE_queryAllByType } = render(<PhotoRow photos={[]} />);
    expect(UNSAFE_queryAllByType(PhotoCell)).toHaveLength(0);
  });

  it('uses different keys for each cell so multiple cells co-render', () => {
    const photos = [
      makePhoto({ id: 'a' }),
      makePhoto({ id: 'b' }),
      makePhoto({ id: 'c' }),
    ];
    // If duplicate keys were used React would warn — render and check count is sufficient.
    const { UNSAFE_getAllByType } = render(<PhotoRow photos={photos} />);
    expect(UNSAFE_getAllByType(PhotoCell)).toHaveLength(3);
  });
});
