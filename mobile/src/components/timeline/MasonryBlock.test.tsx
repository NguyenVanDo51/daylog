import { distributeMasonry } from '@/components/timeline/MasonryBlock';

const makePhoto = (id: string, w: number, h: number) => ({
  type: 'photo' as const,
  id,
  r2_key: `photos/${id}.webp`,
  thumbnail_key: null,
  taken_at: '2026-01-01T00:00:00Z',
  caption: null,
  media_type: 'photo' as const,
  source: 'upload' as const,
  duration_ms: null,
  width: w,
  height: h,
});

const COL_WIDTH = 160;

test('distributes single photo to left column', () => {
  const { left, right } = distributeMasonry([makePhoto('p1', 1080, 1920)], COL_WIDTH);
  expect(left).toHaveLength(1);
  expect(right).toHaveLength(0);
});

test('distributes two photos to different columns', () => {
  const photos = [makePhoto('p1', 1080, 1920), makePhoto('p2', 1920, 1080)];
  const { left, right } = distributeMasonry(photos, COL_WIDTH);
  expect(left).toHaveLength(1);
  expect(right).toHaveLength(1);
});

test('clamps tile height to minimum 72', () => {
  const { left } = distributeMasonry([makePhoto('p1', 1080, 100)], COL_WIDTH);
  expect(left[0].tileHeight).toBe(72);
});

test('clamps tile height to maximum 220', () => {
  const { left } = distributeMasonry([makePhoto('p1', 100, 10000)], COL_WIDTH);
  expect(left[0].tileHeight).toBe(220);
});

test('uses square fallback when dimensions are null', () => {
  const photo = { ...makePhoto('p1', 0, 0), width: null, height: null };
  const { left } = distributeMasonry([photo], COL_WIDTH);
  expect(left[0].tileHeight).toBe(COL_WIDTH);
});
