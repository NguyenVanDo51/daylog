import { colors, spacing, radii, shadows, typography } from '@/constants/theme';

describe('theme tokens', () => {
  it('exports all color tokens', () => {
    expect(colors.primary).toBe('#7C5CBF');
    expect(colors.background).toBe('#F8F4FF');
    expect(colors.surface).toBe('#F0EBFF');
    expect(colors.textPrimary).toBe('#2D1F4E');
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
    expect(shadows.card.shadowColor).toBe('#7C5CBF');
    expect(shadows.fab.shadowColor).toBe('#A78BF0');
  });

  it('exports typography', () => {
    expect(typography.heading.fontSize).toBe(22);
    expect(typography.heading.fontWeight).toBe('800');
  });
});
