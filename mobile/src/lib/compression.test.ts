jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://compressed.webp' }),
  SaveFormat: { WEBP: 'webp' },
}));

import { compressToWebP } from '@/lib/compression';

describe('compressToWebP', () => {
  it('returns a compressed uri', async () => {
    const result = await compressToWebP('file://original.jpg');
    expect(result).toBe('file://compressed.webp');
  });
});
