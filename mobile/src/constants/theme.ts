import { ViewStyle, TextStyle } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Theme interface — every visual axis the app uses, named semantically.
// Names must not contain Sticker-World-specific words; future themes (Paper
// Journal, Soft Cloud, …) implement this same shape.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChipVariant {
  backgroundColor: string;
  textColor:       string;
  borderColor:     string;
  borderWidth:     number;
}

export interface ButtonVariant {
  backgroundColor: string;
  textColor:       string;
  borderColor:     string;
  borderWidth:     number;
  borderRadius:    number;
  shadow:          ViewStyle;
}

export interface Theme {
  name: string;

  colors: {
    background:          string;
    backgroundHighlight: string;
    surface:             string;
    surfaceMuted:        string;
    textPrimary:         string;
    textSecondary:       string;
    textMuted:           string;
    textOnPrimary:       string;
    textOnInverted:      string;
    primary:             string;
    primaryDeep:         string;
    accent1:             string;
    accent2:             string;
    accent3:             string;
    accent4:             string;
    error:               string;
    success:             string;
    border:              string;
    borderSoft:          string;
    swatch:              readonly string[];
  };

  border: {
    hairline: number;
    thin:     number;
    medium:   number;
    thick:    number;
  };

  shadows: {
    none:         ViewStyle;
    soft:         ViewStyle;
    sticker:      ViewStyle;
    stickerHeavy: ViewStyle;
  };

  radii: {
    none: number;
    sm:   number;
    md:   number;
    lg:   number;
    pill: number;
  };

  spacing: {
    xs: number;  sm: number;  md: number;  lg: number;
    xl: number;  '2xl': number; '3xl': number; '4xl': number;
  };

  fonts: {
    regular:  string;
    medium:   string;
    semiBold: string;
    bold:     string;
    display:  string;
  };

  typography: {
    display:     TextStyle;
    displayCute: TextStyle;
    heading:     TextStyle;
    title:       TextStyle;
    body:        TextStyle;
    bodySmall:   TextStyle;
    pill:        TextStyle;
    caption:     TextStyle;
  };

  tilts: {
    none:    number;
    subtle:  number;
    default: number;
    playful: number;
  };

  mascot: {
    emoji:          string | null;
    speechGreeting: string;
    speechEmpty:    string;
  };

  background: {
    kind:      'plain' | 'radial' | 'gradient';
    primary:   string;
    highlight: string;
    angleDeg?: number;
  };

  overlays: {
    scrim:         string;  // modal / sheet backdrop
    scrimDeep:     string;  // bottom gradient end on photo backgrounds
    scrimSoft:     string;  // top gradient start on photo backgrounds
    surfaceOnDark: string;  // chip background on dark surfaces (camera, photo)
    borderOnDark:  string;  // chip border on dark surfaces
    cameraBg:      string;  // camera screen background
  };

  components: {
    stickerCard: {
      backgroundColor: string;
      borderWidth:     number;
      borderColor:     string;
      borderRadius:    number;
      shadow:          ViewStyle;
    };
    stickerButton: {
      primary:   ButtonVariant;
      secondary: ButtonVariant;
      inverted:  ButtonVariant;
      surface:   ButtonVariant;
      danger:    ButtonVariant;
      ghost:     ButtonVariant;
    };
    stickerChip: {
      yellow: ChipVariant;
      pink:   ChipVariant;
      mint:   ChipVariant;
      sky:    ChipVariant;
      white:  ChipVariant;
      ink:    ChipVariant;
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticker World — v1 concrete values
// ─────────────────────────────────────────────────────────────────────────────

const palette = {
  butter:        '#FFF6E0',
  butterDeep:    '#FFE9A8',
  white:         '#FFFFFF',
  surfaceMuted:  '#F0E6D6',
  ink:           '#2A1810',
  inkSoft:       '#7B5544',
  inkMuted:      '#B5A89C',
  pink:          '#FF7AA8',
  pinkDeep:      '#E55B8C',
  yellow:        '#FFD66B',
  mint:          '#7FD7B5',
  sky:           '#7FB7FA',
  peach:         '#FF8E66',
};

const borderColor = palette.ink;

const shadowSticker: ViewStyle = {
  shadowColor:   palette.ink,
  shadowOpacity: 1,
  shadowRadius:  0,
  shadowOffset:  { width: 3, height: 3 },
  elevation:     4,
};
const shadowStickerHeavy: ViewStyle = {
  shadowColor:   palette.ink,
  shadowOpacity: 1,
  shadowRadius:  0,
  shadowOffset:  { width: 4, height: 4 },
  elevation:     5,
};
const shadowSoft: ViewStyle = {
  shadowColor:   palette.ink,
  shadowOpacity: 0.08,
  shadowRadius:  10,
  shadowOffset:  { width: 0, height: 2 },
  elevation:     2,
};
const shadowNone: ViewStyle = {};

const radiiBase = { none: 0, sm: 8, md: 12, lg: 18, pill: 9999 };
const border = { hairline: 1, thin: 1.5, medium: 2, thick: 2.5 };

const fontFamily = {
  regular:  'Baloo2_400Regular',
  medium:   'Baloo2_500Medium',
  semiBold: 'Baloo2_600SemiBold',
  bold:     'Baloo2_700Bold',
};

export const stickerWorld: Theme = {
  name: 'stickerWorld',

  colors: {
    background:          palette.butter,
    backgroundHighlight: palette.butterDeep,
    surface:             palette.white,
    surfaceMuted:        palette.surfaceMuted,
    textPrimary:         palette.ink,
    textSecondary:       palette.inkSoft,
    textMuted:           palette.inkMuted,
    textOnPrimary:       palette.white,
    textOnInverted:      palette.butter,
    primary:             palette.pink,
    primaryDeep:         palette.pinkDeep,
    accent1:             palette.yellow,
    accent2:             palette.mint,
    accent3:             palette.sky,
    accent4:             palette.peach,
    error:               palette.pinkDeep,
    success:             palette.mint,
    border:              palette.ink,
    borderSoft:          palette.surfaceMuted,
    swatch: [palette.pink, palette.mint, palette.sky, palette.peach, palette.yellow] as const,
  },

  border,

  shadows: {
    none:         shadowNone,
    soft:         shadowSoft,
    sticker:      shadowSticker,
    stickerHeavy: shadowStickerHeavy,
  },

  radii: radiiBase,

  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 },

  fonts: { ...fontFamily, display: fontFamily.bold },

  typography: {
    display:     { fontFamily: fontFamily.bold,     fontSize: 28, color: palette.ink },
    displayCute: {
      fontFamily: fontFamily.bold, fontSize: 22, color: palette.ink,
      textShadowColor: palette.yellow,
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 0,
    },
    heading:     { fontFamily: fontFamily.semiBold, fontSize: 22, color: palette.ink },
    title:       { fontFamily: fontFamily.semiBold, fontSize: 18, color: palette.ink },
    body:        { fontFamily: fontFamily.medium,   fontSize: 14, color: palette.ink },
    bodySmall:   { fontFamily: fontFamily.medium,   fontSize: 12, color: palette.inkSoft },
    pill:        { fontFamily: fontFamily.semiBold, fontSize: 11, color: palette.ink, letterSpacing: 0.3 },
    caption:     { fontFamily: fontFamily.medium,   fontSize: 10, color: palette.inkMuted },
  },

  tilts: { none: 0, subtle: 0.5, default: 1, playful: 2 },

  mascot: {
    emoji:          '🐱',
    speechGreeting: 'Xin chào!',
    speechEmpty:    'Chưa có gì ở đây cả!',
  },

  background: {
    kind:      'radial',
    primary:   palette.butter,
    highlight: palette.butterDeep,
  },

  overlays: {
    scrim:         'rgba(0,0,0,0.4)',
    scrimDeep:     'rgba(0,0,0,0.82)',
    scrimSoft:     'rgba(0,0,0,0.55)',
    surfaceOnDark: 'rgba(255,255,255,0.22)',
    borderOnDark:  'rgba(255,255,255,0.22)',
    cameraBg:      '#000000',
  },

  components: {
    stickerCard: {
      backgroundColor: palette.white,
      borderWidth:     border.thick,
      borderColor,
      borderRadius:    radiiBase.md,
      shadow:          shadowSticker,
    },
    stickerButton: {
      primary:   { backgroundColor: palette.pink,     textColor: palette.white,  borderColor, borderWidth: border.thick, borderRadius: radiiBase.md, shadow: shadowStickerHeavy },
      secondary: { backgroundColor: palette.yellow,   textColor: palette.ink,    borderColor, borderWidth: border.thick, borderRadius: radiiBase.md, shadow: shadowSticker      },
      inverted:  { backgroundColor: palette.ink,      textColor: palette.butter, borderColor, borderWidth: border.thick, borderRadius: radiiBase.md, shadow: shadowStickerHeavy },
      surface:   { backgroundColor: palette.white,    textColor: palette.ink,    borderColor, borderWidth: border.thick, borderRadius: radiiBase.md, shadow: shadowSticker      },
      danger:    { backgroundColor: palette.pinkDeep, textColor: palette.white,  borderColor, borderWidth: border.thick, borderRadius: radiiBase.md, shadow: shadowSticker      },
      ghost:     { backgroundColor: 'transparent',    textColor: palette.ink,    borderColor: 'transparent', borderWidth: 0, borderRadius: radiiBase.md, shadow: shadowNone     },
    },
    stickerChip: {
      yellow: { backgroundColor: palette.yellow, textColor: palette.ink,    borderColor, borderWidth: border.medium },
      pink:   { backgroundColor: palette.pink,   textColor: palette.white,  borderColor, borderWidth: border.medium },
      mint:   { backgroundColor: palette.mint,   textColor: palette.ink,    borderColor, borderWidth: border.medium },
      sky:    { backgroundColor: palette.sky,    textColor: palette.ink,    borderColor, borderWidth: border.medium },
      white:  { backgroundColor: palette.white,  textColor: palette.ink,    borderColor, borderWidth: border.medium },
      ink:    { backgroundColor: palette.ink,    textColor: palette.yellow, borderColor, borderWidth: border.medium },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Active theme — flip this line to change themes app-wide.
// ─────────────────────────────────────────────────────────────────────────────

export const theme: Theme = stickerWorld;

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility re-exports — keep existing destructured imports working.
// Legacy color names are aliased to semantic tokens during migration; new
// code should prefer the semantic names via `theme.colors.*`.
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Semantic
  background:          theme.colors.background,
  backgroundHighlight: theme.colors.backgroundHighlight,
  surface:             theme.colors.surface,
  surfaceMuted:        theme.colors.surfaceMuted,
  textPrimary:         theme.colors.textPrimary,
  textSecondary:       theme.colors.textSecondary,
  textMuted:           theme.colors.textMuted,
  textOnPrimary:       theme.colors.textOnPrimary,
  textOnInverted:      theme.colors.textOnInverted,
  primary:             theme.colors.primary,
  primaryDeep:         theme.colors.primaryDeep,
  accent1:             theme.colors.accent1,
  accent2:             theme.colors.accent2,
  accent3:             theme.colors.accent3,
  accent4:             theme.colors.accent4,
  error:               theme.colors.error,
  success:             theme.colors.success,
  border:              theme.colors.border,
  borderSoft:          theme.colors.borderSoft,
  // Legacy aliases (kept until all screens migrated to semantic names)
  cream:    theme.colors.background,
  ink:      theme.colors.textPrimary,
  inkSoft:  theme.colors.textSecondary,
  inkMuted: theme.colors.textMuted,
  pink:     theme.colors.primary,
  pinkDeep: theme.colors.primaryDeep,
  yellow:   theme.colors.accent1,
  mint:     theme.colors.accent2,
  sky:      theme.colors.accent3,
  peach:    theme.colors.accent4,
  white:    palette.white,
  black:    '#000000',
} as const;

export const spacing    = theme.spacing;
export const typography = {
  ...theme.typography,
  // Legacy: prior code used `typography.handAccent` and `typography.handLarge`.
  handAccent: { fontFamily: fontFamily.semiBold, fontSize: 18, color: theme.colors.primary } as TextStyle,
  handLarge:  { fontFamily: fontFamily.bold,     fontSize: 28, color: theme.colors.primary } as TextStyle,
};
export const fonts      = theme.fonts;
export const shadows    = {
  ...theme.shadows,
  // Legacy: prior code used `shadows.card` and `shadows.fab` — kept as aliases.
  card: theme.shadows.soft,
  fab:  theme.shadows.stickerHeavy,
};
export const radii      = {
  ...theme.radii,
  // Legacy: prior code used `radii.xs` and `radii.full`.
  xs:   theme.radii.sm,
  full: theme.radii.pill,
  sticker:    [36, 12, 36, 12] as const,
  stickerAlt: [12, 36, 12, 36] as const,
};

export type ColorKey = keyof typeof colors;
