// Force UTC timezone before any imports so Date parsing is deterministic
// across machines/CI. extractTakenAt uses `new Date('YYYY-MM-DD HH:mm:ss')`
// which is interpreted in the host's local TZ; pinning to UTC keeps the
// expected ISO string stable.
// NOTE: setting process.env.TZ here is best-effort — Node's V8 caches TZ
// on first Date use, which jest setup may have already triggered. To stay
// host-TZ-agnostic, the "valid date" test below also computes its expected
// value with the SAME local-TZ parse the implementation uses.
process.env.TZ = 'UTC';

import { extractTakenAt } from '@/lib/exif';

describe('extractTakenAt', () => {
  it('returns null when asset has no exif field', () => {
    const asset: any = { uri: 'file://no-exif.jpg' };
    expect(extractTakenAt(asset)).toBeNull();
  });

  it('returns null when exif has no DateTimeOriginal', () => {
    const asset: any = { uri: 'file://no-dto.jpg', exif: { Make: 'Canon' } };
    expect(extractTakenAt(asset)).toBeNull();
  });

  it('returns ISO string for a valid DateTimeOriginal', () => {
    const asset: any = {
      uri: 'file://valid.jpg',
      exif: { DateTimeOriginal: '2024:10:15 14:30:00' },
    };
    // Expected: implementation parses '2024-10-15 14:30:00' in the host TZ
    // and emits the ISO equivalent. Compute the same way to stay deterministic.
    const expected = new Date('2024-10-15 14:30:00').toISOString();
    expect(extractTakenAt(asset)).toBe(expected);
    // Sanity check: it should look like an ISO 8601 UTC string.
    expect(extractTakenAt(asset)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('returns null when DateTimeOriginal is unparseable garbage', () => {
    const asset: any = {
      uri: 'file://garbage.jpg',
      exif: { DateTimeOriginal: 'garbage' },
    };
    expect(extractTakenAt(asset)).toBeNull();
  });

  it('returns null for a partial / out-of-range DateTimeOriginal', () => {
    const asset: any = {
      uri: 'file://partial.jpg',
      exif: { DateTimeOriginal: '2024:13:99 99:99:99' },
    };
    expect(extractTakenAt(asset)).toBeNull();
  });
});
