import sharp from 'sharp';

jest.mock('./r2', () => ({
  getObjectBuffer: jest.fn(),
  putObject: jest.fn().mockResolvedValue(undefined),
}));

import { getObjectBuffer, putObject } from './r2';
import { generateThumbnail } from './thumbnail';

const mockGet = getObjectBuffer as jest.Mock;
const mockPut = putObject as jest.Mock;

async function makeTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('services/thumbnail generateThumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockResolvedValue(undefined);
  });

  it('resizes a large image, uploads it, and returns a thumbnails/<uuid>.webp key', async () => {
    const sourceBuffer = await makeTestJpeg(1200, 800);
    mockGet.mockResolvedValue(sourceBuffer);

    const returnedKey = await generateThumbnail('photos/x.webp');

    expect(returnedKey).toMatch(/^thumbnails\/[0-9a-f-]+\.webp$/);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('photos/x.webp');

    expect(mockPut).toHaveBeenCalledTimes(1);
    const [putKey, putBuffer] = mockPut.mock.calls[0];
    expect(putKey).toBe(returnedKey);
    expect(Buffer.isBuffer(putBuffer)).toBe(true);

    const meta = await sharp(putBuffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(400);
    expect(meta.height).toBeLessThanOrEqual(400);
    // fit:'inside' preserves aspect ratio (3:2). 1200x800 -> 400x267-ish.
    expect(meta.width).toBe(400);
    expect(meta.height).toBeGreaterThanOrEqual(260);
    expect(meta.height).toBeLessThanOrEqual(270);
  });

  it('does not enlarge a smaller image (withoutEnlargement keeps 200x100)', async () => {
    const sourceBuffer = await makeTestJpeg(200, 100);
    mockGet.mockResolvedValue(sourceBuffer);

    const returnedKey = await generateThumbnail('photos/small.jpg');

    expect(returnedKey).toMatch(/^thumbnails\/[0-9a-f-]+\.webp$/);
    expect(mockPut).toHaveBeenCalledTimes(1);

    const [, putBuffer] = mockPut.mock.calls[0];
    const meta = await sharp(putBuffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  it('propagates getObjectBuffer rejection and does not call putObject', async () => {
    const boom = new Error('r2 fetch failed');
    mockGet.mockRejectedValue(boom);

    await expect(generateThumbnail('photos/missing.jpg')).rejects.toThrow('r2 fetch failed');

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPut).not.toHaveBeenCalled();
  });
});
