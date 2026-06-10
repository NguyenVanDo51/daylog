import { colors, spacing, radii, shadows, typography } from '@/constants/theme';

describe('theme tokens', () => {
  it('exports all color tokens', () => {
    expect(colors.pink).toBe('#FF7AA8');
    expect(colors.cream).toBe('#FFFBF0');
    expect(colors.ink).toBe('#3D2A1F');
    expect(colors.inkSoft).toBe('#7B5544');
  });

  it('exports spacing scale', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
  });

  it('exports radii', () => {
    expect(radii.xs).toBe(8);
    expect(radii.full).toBe(9999);
  });

  it('exports shadows', () => {
    expect(shadows.card.shadowColor).toBe('#3D2A1F');
    expect(shadows.fab.shadowColor).toBe('#FF7AA8');
  });

  it('exports typography', () => {
    expect(typography.heading.fontSize).toBe(22);
    expect(typography.heading.fontFamily).toBe('Baloo2_600SemiBold');
  });
});
