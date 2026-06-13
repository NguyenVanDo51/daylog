import { generateQRCode } from './qrcode';

describe('generateQRCode', () => {
  it('returns a data URL for a PNG QR code containing the given text', async () => {
    const out = await generateQRCode('https://example.com/invite/abc123');
    expect(out).toMatch(/^data:image\/png;base64,/);
    // Decoded payload should be non-trivial — at least a few hundred bytes.
    const b64 = out.split(',')[1] ?? '';
    expect(b64.length).toBeGreaterThan(200);
  });

  it('produces different outputs for different inputs', async () => {
    const a = await generateQRCode('aaa');
    const b = await generateQRCode('bbb');
    expect(a).not.toBe(b);
  });
});
