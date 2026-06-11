import { theme, colors, spacing, typography, fonts, shadows, radii } from './theme';

describe('theme.ts', () => {
  describe('Theme.colors (semantic)', () => {
    it('exposes all required semantic color keys', () => {
      const keys = [
        'background', 'backgroundHighlight', 'surface', 'surfaceMuted',
        'textPrimary', 'textSecondary', 'textMuted', 'textOnPrimary', 'textOnInverted',
        'primary', 'primaryDeep',
        'accent1', 'accent2', 'accent3', 'accent4',
        'error', 'success', 'border', 'borderSoft',
      ] as const;
      keys.forEach((k) => expect(typeof theme.colors[k]).toBe('string'));
      expect(Array.isArray(theme.colors.swatch)).toBe(true);
      expect(theme.colors.swatch.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Theme.border / shadows / radii / tilts', () => {
    it('exposes border widths', () => {
      expect(theme.border.hairline).toBe(1);
      expect(theme.border.thick).toBe(2.5);
    });
    it('exposes named shadows', () => {
      expect(theme.shadows.sticker.shadowOffset).toEqual({ width: 3, height: 3 });
      expect(theme.shadows.stickerHeavy.shadowOffset).toEqual({ width: 4, height: 4 });
    });
    it('exposes tilt magnitudes', () => {
      expect(theme.tilts.none).toBe(0);
      expect(theme.tilts.subtle).toBe(0.5);
      expect(theme.tilts.default).toBe(1);
      expect(theme.tilts.playful).toBe(2);
    });
  });

  describe('Theme.mascot', () => {
    it('exposes a cat mascot', () => {
      expect(theme.mascot.emoji).toBe('🐱');
      expect(typeof theme.mascot.speechGreeting).toBe('string');
    });
  });

  describe('Theme.components', () => {
    it('exposes stickerCard preset', () => {
      expect(theme.components.stickerCard.backgroundColor).toBe(theme.colors.surface);
      expect(theme.components.stickerCard.borderWidth).toBe(theme.border.thick);
      expect(theme.components.stickerCard.borderColor).toBe(theme.colors.border);
    });
    it('exposes 6 chip variants', () => {
      const keys = ['yellow', 'pink', 'mint', 'sky', 'white', 'ink'] as const;
      keys.forEach((k) => expect(theme.components.stickerChip[k]).toBeDefined());
    });
    it('exposes 6 button variants', () => {
      const keys = ['primary', 'secondary', 'inverted', 'surface', 'danger', 'ghost'] as const;
      keys.forEach((k) => expect(theme.components.stickerButton[k]).toBeDefined());
    });
  });

  describe('Theme.overlays', () => {
    it('exposes named overlay tokens', () => {
      const keys = ['scrim', 'scrimDeep', 'scrimSoft', 'surfaceOnDark', 'borderOnDark', 'cameraBg'] as const;
      keys.forEach((k) => expect(typeof theme.overlays[k]).toBe('string'));
    });
  });

  describe('Compatibility re-exports', () => {
    it('keeps legacy color aliases pointing at semantic tokens', () => {
      expect(colors.cream).toBe(theme.colors.background);
      expect(colors.ink).toBe(theme.colors.textPrimary);
      expect(colors.pink).toBe(theme.colors.primary);
      expect(colors.yellow).toBe(theme.colors.accent1);
      expect(colors.mint).toBe(theme.colors.accent2);
      expect(colors.sky).toBe(theme.colors.accent3);
      expect(colors.peach).toBe(theme.colors.accent4);
    });
    it('keeps top-level `spacing`, `typography`, `fonts`, `shadows`, `radii` exports', () => {
      expect(spacing.lg).toBeDefined();
      expect(typography.body).toBeDefined();
      expect(typography.displayCute).toBeDefined();
      expect(fonts.bold).toBeDefined();
      expect(shadows.sticker).toBeDefined();
      expect(shadows.stickerHeavy).toBeDefined();
      expect(radii.md).toBeDefined();
    });
  });
});
