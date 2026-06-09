export const colors = {
  // Base
  cream:        '#FFFBF0',
  ink:          '#3D2A1F',
  inkSoft:      '#7B5544',
  inkMuted:     '#B5A89C',

  // 5 sticker accents
  pink:         '#FF7AA8',
  pinkDeep:     '#E55B8C',
  yellow:       '#FFD66B',
  mint:         '#7FD7B5',
  peach:        '#FF8E66',
  sky:          '#7FB7FA',

  // Surface
  white:        '#FFFFFF',
  border:       '#3D2A1F',   // ink, used for sticker borders at 1.5-2px
  borderSoft:   '#F0E6D6',   // hairline divider, used in Quiet tier

  // Functional aliases
  background:   '#FFFBF0',  // cream — sheet / screen background
  textPrimary:  '#3D2A1F',  // ink — primary text colour
  error:        '#E55B8C',
  success:      '#7FD7B5',
  black:        '#000000',
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const radii = {
  xs:   8,
  sm:   12,
  md:   18,
  lg:   28,
  full: 9999,
  sticker:    [36, 12, 36, 12] as const,
  stickerAlt: [12, 36, 12, 36] as const,
} as const;

export const shadows = {
  card: {
    shadowColor:   '#3D2A1F',
    shadowOpacity: 0.08,
    shadowRadius:  10,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     2,
  },
  sticker: {
    shadowColor:   '#3D2A1F',
    shadowOpacity: 1,
    shadowRadius:  0,
    shadowOffset:  { width: 3, height: 3 },
    elevation:     4,
  },
  fab: {
    shadowColor:   '#FF7AA8',
    shadowOpacity: 0.45,
    shadowRadius:  14,
    shadowOffset:  { width: 0, height: 6 },
    elevation:     8,
  },
} as const;

export const fonts = {
  regular:  'Fredoka_400Regular',
  medium:   'Fredoka_500Medium',
  semiBold: 'Fredoka_600SemiBold',
  bold:     'Fredoka_700Bold',
} as const;

export const typography = {
  display:     { fontFamily: fonts.bold,     fontSize: 28, color: colors.ink },
  heading:     { fontFamily: fonts.semiBold, fontSize: 22, color: colors.ink },
  title:       { fontFamily: fonts.semiBold, fontSize: 18, color: colors.ink },
  body:        { fontFamily: fonts.medium,   fontSize: 14, color: colors.ink },
  bodySmall:   { fontFamily: fonts.medium,   fontSize: 12, color: colors.inkSoft },
  pill:        { fontFamily: fonts.semiBold, fontSize: 11, color: colors.ink, letterSpacing: 0.3 },
  caption:     { fontFamily: fonts.medium,   fontSize: 10, color: colors.inkMuted },
  handAccent:  { fontFamily: fonts.semiBold, fontSize: 18, color: colors.pink },
  handLarge:   { fontFamily: fonts.bold,     fontSize: 28, color: colors.pink },
} as const;

export type ColorKey = keyof typeof colors;
