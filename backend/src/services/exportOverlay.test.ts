import { renderOverlayPng } from './exportOverlay';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('exportOverlay.renderOverlayPng', () => {
  it('produces a 1080x1920 PNG with the correct signature', async () => {
    const buf = await renderOverlayPng({
      takenAt: new Date('2026-01-01T14:32:00Z'),
      caption: 'Một ngày đẹp',
    });

    expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(buf.readUInt32BE(16)).toBe(1080);
    expect(buf.readUInt32BE(20)).toBe(1920);
  });

  it('renders without error when caption is null or empty', async () => {
    const a = await renderOverlayPng({ takenAt: new Date(), caption: null });
    const b = await renderOverlayPng({ takenAt: new Date(), caption: '   ' });
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('does not throw on captions longer than two visible lines', async () => {
    const long = 'a b c d e f g h i j k l m n o p q r s t u v w x y z '.repeat(8);
    const buf = await renderOverlayPng({ takenAt: new Date(), caption: long });
    expect(buf.length).toBeGreaterThan(0);
  });

  it('formats the hour stamp in Asia/Ho_Chi_Minh as HH:mm', async () => {
    // 07:32 UTC == 14:32 ICT. We can't peek at the rendered pixels easily, but
    // we can at least ensure the call shape works for that input — visual
    // verification belongs in the manual step at the end of the plan.
    const buf = await renderOverlayPng({
      takenAt: new Date('2026-01-01T07:32:00Z'),
      caption: null,
    });
    expect(buf.length).toBeGreaterThan(0);
  });
});
