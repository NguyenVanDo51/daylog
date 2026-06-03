export const colors = {
  primary:       '#7C5CBF',
  primaryLight:  '#A78BF0',
  primaryPastel: '#C9B8F5',
  surface:       '#F0EBFF',
  background:    '#F8F4FF',
  border:        '#E0D4FF',
  textPrimary:   '#2D1F4E',
  textSecondary: '#7A6AAA',
  textMuted:     '#B0A0CC',
  white:         '#FFFFFF',
  gradientStart: '#7C5CBF',
  gradientEnd:   '#A78BF0',
  error:         '#E53E3E',
  success:       '#38A169',
  black:         '#000000',
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
} as const;

export const shadows = {
  card: {
    shadowColor:   '#7C5CBF',
    shadowOpacity: 0.10,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     3,
  },
  fab: {
    shadowColor:   '#A78BF0',
    shadowOpacity: 0.45,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     8,
  },
} as const;

export const typography = {
  heading:    { fontSize: 22, fontWeight: '800' as const, color: colors.textPrimary },
  title:      { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  subheading: { fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary },
  body:       { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  label:      { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  caption:    { fontSize: 9,  fontWeight: '500' as const, color: colors.textMuted },
} as const;

export type ColorKey = keyof typeof colors;
