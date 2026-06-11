# Sticker World Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `theme.ts` into a themable design system, build the 5 base sticker components (Mascot, StickerCard, StickerChip, StickerButton, Avatar), and add a guard that prevents new hex literals from leaking into component files. After this plan, the app looks identical to today but every visual value is reachable from `theme.ts` and the components needed for the rest of the redesign exist with tests.

**Architecture:**
- `mobile/src/constants/theme.ts` exports a `Theme` interface, a concrete `stickerWorld: Theme` object, and the active `theme` selector. Existing destructured imports (`colors`, `spacing`, `typography`, etc.) keep working via a compatibility re-export layer that aliases legacy color names (`cream`, `ink`, `pink`, …) to the new semantic keys (`background`, `textPrimary`, `primary`, …).
- Each new component lives in `mobile/src/components/ui/` and reads exclusively from `theme.components.*`, `theme.tilts`, and `theme.radii` — never raw colors or shadows.
- A Jest "guard" test scans the new component files for raw hex/rgba literals and fails the build if any are found.

**Tech Stack:** React Native (Expo 56), TypeScript, Jest + jest-expo, @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` (sections "Theme System", "Sticker World Theme — Concrete Values", and "New Reusable Components").

---

## File Structure

After this plan, the following files exist or are modified:

```
mobile/
├── src/
│   ├── constants/
│   │   └── theme.ts                                  ← REWRITTEN
│   ├── components/
│   │   └── ui/
│   │       ├── Mascot.tsx                            ← NEW
│   │       ├── Mascot.test.tsx                       ← NEW
│   │       ├── StickerCard.tsx                       ← NEW
│   │       ├── StickerCard.test.tsx                  ← NEW
│   │       ├── StickerChip.tsx                       ← NEW
│   │       ├── StickerChip.test.tsx                  ← NEW
│   │       ├── StickerButton.tsx                     ← NEW
│   │       ├── StickerButton.test.tsx                ← NEW
│   │       ├── Avatar.tsx                            ← NEW
│   │       └── Avatar.test.tsx                       ← NEW
│   └── __tests__/
│       └── hex-literal-guard.test.ts                 ← NEW
```

Each component has one job:
- `Mascot` — renders `theme.mascot.emoji` at a configurable size with optional drop-shadow and tilt.
- `StickerCard` — a surface with ink border + offset shadow, optional tilt with `flip` direction.
- `StickerChip` — pill-shaped state indicator with named variants.
- `StickerButton` — primary CTA component with named variants, loading state, and haptic feedback.
- `Avatar` — round sticker-bordered avatar with image source, color background, and mascot fallback.

---

### Task 1: Add Theme interface and `stickerWorld` theme object

**Files:**
- Modify: `mobile/src/constants/theme.ts` (full rewrite)
- Create: `mobile/src/constants/theme.test.ts`

- [ ] **Step 1: Write the failing test for theme shape**

Create `mobile/src/constants/theme.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/constants/theme.test.ts`
Expected: FAIL — properties like `theme`, `theme.colors.background`, `theme.tilts`, `theme.components`, `typography.displayCute`, `shadows.stickerHeavy` do not exist yet.

- [ ] **Step 3: Rewrite `theme.ts` with the Theme interface + stickerWorld object**

Replace the entire contents of `mobile/src/constants/theme.ts` with:

```ts
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

const radii = { none: 0, sm: 8, md: 12, lg: 18, pill: 9999 };
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

  radii,

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

  components: {
    stickerCard: {
      backgroundColor: palette.white,
      borderWidth:     border.thick,
      borderColor,
      borderRadius:    radii.md,
      shadow:          shadowSticker,
    },
    stickerButton: {
      primary:   { backgroundColor: palette.pink,     textColor: palette.white,  borderColor, borderWidth: border.thick, borderRadius: radii.md, shadow: shadowStickerHeavy },
      secondary: { backgroundColor: palette.yellow,   textColor: palette.ink,    borderColor, borderWidth: border.thick, borderRadius: radii.md, shadow: shadowSticker      },
      inverted:  { backgroundColor: palette.ink,      textColor: palette.butter, borderColor, borderWidth: border.thick, borderRadius: radii.md, shadow: shadowStickerHeavy },
      surface:   { backgroundColor: palette.white,    textColor: palette.ink,    borderColor, borderWidth: border.thick, borderRadius: radii.md, shadow: shadowSticker      },
      danger:    { backgroundColor: palette.pinkDeep, textColor: palette.white,  borderColor, borderWidth: border.thick, borderRadius: radii.md, shadow: shadowSticker      },
      ghost:     { backgroundColor: 'transparent',    textColor: palette.ink,    borderColor: 'transparent', borderWidth: 0, borderRadius: radii.md, shadow: shadowNone     },
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
export const typography = theme.typography;
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
```

- [ ] **Step 4: Run the theme test**

Run: `cd mobile && npx jest src/constants/theme.test.ts`
Expected: PASS (all 8 specs).

- [ ] **Step 5: Verify existing screens still typecheck and tests still pass**

Run: `cd mobile && npx tsc --noEmit && npx jest --silent`
Expected: typecheck passes; all existing tests pass (no regressions from the rewrite).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/constants/theme.ts mobile/src/constants/theme.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): introduce Theme interface and stickerWorld theme object

Refactors theme.ts to expose a Theme interface plus a concrete
stickerWorld theme. Adds semantic color tokens, border widths, tilt
magnitudes, a mascot slot, and component variant presets (stickerCard,
stickerButton, stickerChip). Existing destructured imports keep working
through compatibility re-exports that alias legacy color names to the
new semantic tokens.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Build `Mascot` component

**Files:**
- Create: `mobile/src/components/ui/Mascot.tsx`
- Create: `mobile/src/components/ui/Mascot.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/ui/Mascot.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Mascot } from './Mascot';

describe('Mascot', () => {
  it('renders the theme mascot emoji', () => {
    const { getByTestId } = render(<Mascot testID="m" />);
    expect(getByTestId('m').props.children).toBe('🐱');
  });

  it('applies the requested size to fontSize', () => {
    const { getByTestId } = render(<Mascot size={64} testID="m" />);
    expect(getByTestId('m').props.style).toEqual(
      expect.objectContaining({ fontSize: 64 }),
    );
  });

  it('rotates by the playful magnitude when tilt="playful"', () => {
    const { getByTestId } = render(<Mascot tilt="playful" testID="m" />);
    expect(getByTestId('m').props.style).toEqual(
      expect.objectContaining({ transform: [{ rotate: '2deg' }] }),
    );
  });

  it('flips the rotation sign when flip is true', () => {
    const { getByTestId } = render(<Mascot tilt="default" flip testID="m" />);
    expect(getByTestId('m').props.style).toEqual(
      expect.objectContaining({ transform: [{ rotate: '-1deg' }] }),
    );
  });

  it('omits transform when tilt="none"', () => {
    const { getByTestId } = render(<Mascot testID="m" />);
    expect(getByTestId('m').props.style).not.toHaveProperty('transform');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/components/ui/Mascot.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Mascot.tsx`**

Create `mobile/src/components/ui/Mascot.tsx`:

```tsx
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';

type TiltKey = keyof typeof theme.tilts;

interface MascotProps {
  size?: number;
  tilt?: TiltKey;
  flip?: boolean;
  withShadow?: boolean;
  testID?: string;
}

export function Mascot({
  size = 32,
  tilt = 'none',
  flip = false,
  withShadow = true,
  testID,
}: MascotProps) {
  if (theme.mascot.emoji == null) return null;

  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const style: TextStyle = {
    fontSize: size,
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
    ...(withShadow && {
      textShadowColor: theme.colors.border,
      textShadowOffset: { width: Math.max(1, size / 20), height: Math.max(1, size / 20) },
      textShadowRadius: 0,
    }),
  };

  return <Text testID={testID} style={style}>{theme.mascot.emoji}</Text>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest src/components/ui/Mascot.test.tsx`
Expected: PASS (all 5 specs).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/Mascot.tsx mobile/src/components/ui/Mascot.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Mascot component

Renders theme.mascot.emoji with configurable size, tilt, flip, and
optional ink drop-shadow. Reads exclusively from theme tokens so
swapping themes (or setting theme.mascot.emoji to null) requires no
changes to this component.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Build `StickerCard` component

**Files:**
- Create: `mobile/src/components/ui/StickerCard.tsx`
- Create: `mobile/src/components/ui/StickerCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/ui/StickerCard.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { StickerCard } from './StickerCard';
import { theme } from '@/constants/theme';

describe('StickerCard', () => {
  it('renders children inside the card', () => {
    const { getByText } = render(<StickerCard><Text>Hi</Text></StickerCard>);
    expect(getByText('Hi')).toBeTruthy();
  });

  it('uses the stickerCard preset from theme.components', () => {
    const { getByTestId } = render(<StickerCard testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.backgroundColor).toBe(theme.components.stickerCard.backgroundColor);
    expect(flat.borderWidth).toBe(theme.components.stickerCard.borderWidth);
    expect(flat.borderColor).toBe(theme.components.stickerCard.borderColor);
    expect(flat.borderRadius).toBe(theme.components.stickerCard.borderRadius);
  });

  it('rotates by theme.tilts.subtle when tilt="subtle"', () => {
    const { getByTestId } = render(<StickerCard tilt="subtle" testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.transform).toEqual([{ rotate: '0.5deg' }]);
  });

  it('flips the rotation when flip is true', () => {
    const { getByTestId } = render(<StickerCard tilt="default" flip testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.transform).toEqual([{ rotate: '-1deg' }]);
  });

  it('uses stickerHeavy shadow when shadow="heavy"', () => {
    const { getByTestId } = render(<StickerCard shadow="heavy" testID="c"><Text>x</Text></StickerCard>);
    const flat = (Array.isArray(getByTestId('c').props.style)
      ? Object.assign({}, ...getByTestId('c').props.style)
      : getByTestId('c').props.style);
    expect(flat.shadowOffset).toEqual(theme.shadows.stickerHeavy.shadowOffset);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/components/ui/StickerCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StickerCard.tsx`**

Create `mobile/src/components/ui/StickerCard.tsx`:

```tsx
import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { theme } from '@/constants/theme';

type TiltKey = keyof typeof theme.tilts;

interface StickerCardProps {
  children: ReactNode;
  tilt?: TiltKey;
  flip?: boolean;
  shadow?: 'normal' | 'heavy';
  surface?: 'default' | 'muted';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StickerCard({
  children,
  tilt = 'none',
  flip = false,
  shadow = 'normal',
  surface = 'default',
  style,
  testID,
}: StickerCardProps) {
  const preset = theme.components.stickerCard;
  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const composed: ViewStyle = {
    backgroundColor: surface === 'muted' ? theme.colors.surfaceMuted : preset.backgroundColor,
    borderWidth:     preset.borderWidth,
    borderColor:     preset.borderColor,
    borderRadius:    preset.borderRadius,
    ...(shadow === 'heavy' ? theme.shadows.stickerHeavy : preset.shadow),
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
  };

  return <View testID={testID} style={[composed, style]}>{children}</View>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest src/components/ui/StickerCard.test.tsx`
Expected: PASS (all 5 specs).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/StickerCard.tsx mobile/src/components/ui/StickerCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add StickerCard component

Surface with theme-driven ink border + offset shadow. Tilt magnitudes
come from theme.tilts; direction is controlled by the flip prop so
alternating-tilt lists keep direction logic in the consumer while the
theme owns magnitude.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build `StickerChip` component

**Files:**
- Create: `mobile/src/components/ui/StickerChip.tsx`
- Create: `mobile/src/components/ui/StickerChip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/ui/StickerChip.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { StickerChip } from './StickerChip';
import { theme } from '@/constants/theme';

describe('StickerChip', () => {
  it('renders the label text', () => {
    const { getByText } = render(<StickerChip label="128" />);
    expect(getByText('128')).toBeTruthy();
  });

  it('uses the yellow variant by default', () => {
    const { getByTestId } = render(<StickerChip label="x" testID="c" />);
    const styles = getByTestId('c').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.components.stickerChip.yellow.backgroundColor);
  });

  it.each([
    ['yellow'], ['pink'], ['mint'], ['sky'], ['white'], ['ink'],
  ] as const)('renders %s variant with the matching theme preset', (variant) => {
    const { getByTestId } = render(<StickerChip label="x" variant={variant} testID="c" />);
    const styles = getByTestId('c').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.components.stickerChip[variant].backgroundColor);
    expect(flat.borderColor).toBe(theme.components.stickerChip[variant].borderColor);
  });

  it('applies tilt and flip', () => {
    const { getByTestId } = render(<StickerChip label="x" tilt="default" flip testID="c" />);
    const styles = getByTestId('c').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.transform).toEqual([{ rotate: '-1deg' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/components/ui/StickerChip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StickerChip.tsx`**

Create `mobile/src/components/ui/StickerChip.tsx`:

```tsx
import React, { ReactNode } from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';

type ChipVariant = keyof typeof theme.components.stickerChip;
type TiltKey = keyof typeof theme.tilts;

interface StickerChipProps {
  label: string;
  variant?: ChipVariant;
  tilt?: TiltKey;
  flip?: boolean;
  icon?: ReactNode;
  testID?: string;
}

export function StickerChip({
  label,
  variant = 'yellow',
  tilt = 'none',
  flip = false,
  icon,
  testID,
}: StickerChipProps) {
  const v = theme.components.stickerChip[variant];
  const magnitude = theme.tilts[tilt];
  const deg = flip ? -magnitude : magnitude;

  const container: ViewStyle = {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: v.backgroundColor,
    borderColor:     v.borderColor,
    borderWidth:     v.borderWidth,
    borderRadius:    theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical:   theme.spacing.xs,
    ...(magnitude !== 0 && { transform: [{ rotate: `${deg}deg` }] }),
  };

  return (
    <View testID={testID} style={container}>
      {icon}
      <Text style={[theme.typography.pill, { color: v.textColor, marginLeft: icon ? theme.spacing.xs : 0 }]}>
        {label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest src/components/ui/StickerChip.test.tsx`
Expected: PASS (all 9 specs — 1 default + 6 variants + 2 misc).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/StickerChip.tsx mobile/src/components/ui/StickerChip.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add StickerChip component

Pill-shaped state indicator with six variants (yellow, pink, mint, sky,
white, ink) read from theme.components.stickerChip. Tilt magnitudes
come from theme.tilts.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build `StickerButton` component

**Files:**
- Create: `mobile/src/components/ui/StickerButton.tsx`
- Create: `mobile/src/components/ui/StickerButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/ui/StickerButton.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StickerButton } from './StickerButton';
import { theme } from '@/constants/theme';

jest.mock('@/lib/haptics', () => ({ tap: jest.fn() }));

describe('StickerButton', () => {
  it('renders the label', () => {
    const { getByText } = render(<StickerButton label="Save" onPress={() => {}} />);
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<StickerButton label="Tap" onPress={onPress} />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<StickerButton label="x" onPress={onPress} disabled testID="b" />);
    fireEvent.press(getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<StickerButton label="x" onPress={onPress} loading testID="b" />);
    fireEvent.press(getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['primary'], ['secondary'], ['inverted'], ['surface'], ['danger'], ['ghost'],
  ] as const)('applies %s variant from theme.components.stickerButton', (variant) => {
    const { getByTestId } = render(<StickerButton label="x" onPress={() => {}} variant={variant} testID="b" />);
    const styles = getByTestId('b').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.components.stickerButton[variant].backgroundColor);
  });

  it('uses stickerHeavy shadow when shadow="heavy"', () => {
    const { getByTestId } = render(<StickerButton label="x" onPress={() => {}} shadow="heavy" testID="b" />);
    const styles = getByTestId('b').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.shadowOffset).toEqual(theme.shadows.stickerHeavy.shadowOffset);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/components/ui/StickerButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StickerButton.tsx`**

Create `mobile/src/components/ui/StickerButton.tsx`:

```tsx
import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';
import { tap } from '@/lib/haptics';

type ButtonVariant = keyof typeof theme.components.stickerButton;

interface StickerButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  shadow?: 'normal' | 'heavy';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  testID?: string;
}

export function StickerButton({
  label,
  onPress,
  variant = 'primary',
  shadow = 'normal',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  testID,
}: StickerButtonProps) {
  const v = theme.components.stickerButton[variant];
  const blocked = disabled || loading;

  const container: ViewStyle = {
    backgroundColor: v.backgroundColor,
    borderColor:     v.borderColor,
    borderWidth:     v.borderWidth,
    borderRadius:    v.borderRadius,
    paddingVertical:   theme.spacing.md,
    paddingHorizontal: theme.spacing['2xl'],
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.sm,
    ...(shadow === 'heavy' ? theme.shadows.stickerHeavy : v.shadow),
    ...(fullWidth && { alignSelf: 'stretch' }),
    ...(blocked && { opacity: 0.5 }),
  };
  const labelStyle: TextStyle = {
    ...theme.typography.body,
    fontFamily: theme.fonts.semiBold,
    color: v.textColor,
  };

  function handlePress() {
    if (blocked) return;
    tap();
    onPress();
  }

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={blocked}
      activeOpacity={0.85}
      style={container}
    >
      {loading ? (
        <ActivityIndicator color={v.textColor} />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text style={labelStyle}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest src/components/ui/StickerButton.test.tsx`
Expected: PASS (all 11 specs).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/StickerButton.tsx mobile/src/components/ui/StickerButton.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add StickerButton component

Primary CTA component with six variants (primary, secondary, inverted,
surface, danger, ghost) read from theme.components.stickerButton.
Supports loading state, disabled, fullWidth, optional icon, and the
standard haptic tap on press.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build `Avatar` component

**Files:**
- Create: `mobile/src/components/ui/Avatar.tsx`
- Create: `mobile/src/components/ui/Avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/components/ui/Avatar.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from './Avatar';
import { theme } from '@/constants/theme';

jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('Avatar', () => {
  it('renders the mascot fallback when src is null', () => {
    const { getByText } = render(<Avatar />);
    expect(getByText('🐱')).toBeTruthy();
  });

  it('renders the image when src is provided', () => {
    const { queryByText, getByTestId } = render(
      <Avatar src="https://x/avatar.jpg" testID="a" />,
    );
    expect(queryByText('🐱')).toBeNull();
    expect(getByTestId('a-image')).toBeTruthy();
  });

  it('respects the size prop on the outer container', () => {
    const { getByTestId } = render(<Avatar size={60} testID="a" />);
    const styles = getByTestId('a').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.width).toBe(60);
    expect(flat.height).toBe(60);
    expect(flat.borderRadius).toBe(30);
  });

  it('applies the requested theme color as background when no image', () => {
    const { getByTestId } = render(<Avatar bgColor="accent2" testID="a" />);
    const styles = getByTestId('a').props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.backgroundColor).toBe(theme.colors.accent2);
  });

  it('renders the camera overlay when withCameraOverlay is true', () => {
    const { getByTestId } = render(<Avatar withCameraOverlay testID="a" />);
    expect(getByTestId('a-camera-overlay')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest src/components/ui/Avatar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Avatar.tsx`**

Create `mobile/src/components/ui/Avatar.tsx`:

```tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { Mascot } from './Mascot';

type ColorKey = keyof typeof theme.colors;
// Exclude `swatch` (the readonly array) so bgColor can only resolve to a string.
type ColorBgKey = Exclude<ColorKey, 'swatch'>;

interface AvatarProps {
  size?: number;
  src?: string | null;
  bgColor?: ColorBgKey;
  withCameraOverlay?: boolean;
  testID?: string;
}

export function Avatar({
  size = 40,
  src = null,
  bgColor = 'primary',
  withCameraOverlay = false,
  testID,
}: AvatarProps) {
  const radius = size / 2;

  const container: ViewStyle = {
    width:           size,
    height:          size,
    borderRadius:    radius,
    backgroundColor: theme.colors[bgColor] as string,
    borderWidth:     theme.border.medium,
    borderColor:     theme.colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  };
  const overlay: ViewStyle = {
    position:        'absolute',
    bottom:          -2,
    right:           -2,
    width:           Math.max(20, size * 0.32),
    height:          Math.max(20, size * 0.32),
    borderRadius:    Math.max(10, size * 0.16),
    backgroundColor: theme.colors.accent1,
    borderWidth:     theme.border.thin,
    borderColor:     theme.colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  };

  return (
    <View testID={testID} style={container}>
      {src ? (
        <Image
          testID={`${testID}-image`}
          source={{ uri: src }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <Mascot size={size * 0.55} withShadow={false} />
      )}
      {withCameraOverlay && (
        <View testID={`${testID}-camera-overlay`} style={overlay} />
      )}
    </View>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest src/components/ui/Avatar.test.tsx`
Expected: PASS (all 5 specs).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/Avatar.tsx mobile/src/components/ui/Avatar.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Avatar component

Round sticker-bordered avatar that renders an image when available and
falls back to the theme mascot otherwise. Background color is selected
via a theme color key; optional camera overlay for the profile editor
flow. Composes Mascot for fallback so swapping themes propagates here.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add hex-literal guard test for new component files

**Files:**
- Create: `mobile/src/__tests__/hex-literal-guard.test.ts`

This test scans the new sticker components for raw hex / rgba literals. It is scoped narrowly to the new files so it does not fail on the 66 existing violations in the legacy screen code — those screens get migrated in the next plans.

- [ ] **Step 1: Write the failing test**

Create `mobile/src/__tests__/hex-literal-guard.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

// Files that must not contain raw hex / rgba literals. Adding a file to this
// list means it is considered "theme-clean" and any future hex/rgba added to
// it will fail the build. Extend this list as more screens are migrated.
const THEME_CLEAN_FILES = [
  'src/components/ui/Mascot.tsx',
  'src/components/ui/StickerCard.tsx',
  'src/components/ui/StickerChip.tsx',
  'src/components/ui/StickerButton.tsx',
  'src/components/ui/Avatar.tsx',
];

const HEX_OR_RGBA = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

describe('hex-literal guard', () => {
  it.each(THEME_CLEAN_FILES)('%s contains no raw hex or rgba literals', (rel) => {
    const abs = path.resolve(__dirname, '../../', rel);
    const src = fs.readFileSync(abs, 'utf8');
    // Strip line comments so explanatory `// #ABC` in a comment doesn't trip the check.
    const stripped = src.replace(/\/\/.*$/gm, '');
    const match = stripped.match(HEX_OR_RGBA);
    if (match) {
      const line = stripped.slice(0, match.index).split('\n').length;
      throw new Error(
        `${rel}:${line} contains a raw color literal "${match[0]}". ` +
        `All colors must come from theme.colors.* (see Theme System section ` +
        `of docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md).`,
      );
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd mobile && npx jest src/__tests__/hex-literal-guard.test.ts`
Expected: PASS (5 specs, one per theme-clean file). If any sticker component contains a hex literal, fix the component before continuing — the guard is correct and the component is wrong.

- [ ] **Step 3: Run the full test suite to verify nothing regressed**

Run: `cd mobile && npx jest --silent`
Expected: All tests pass. New tests: theme.test, Mascot.test, StickerCard.test, StickerChip.test, StickerButton.test, Avatar.test, hex-literal-guard.test.

- [ ] **Step 4: Run a typecheck to confirm no implicit any or missing types**

Run: `cd mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
test: add hex-literal guard for theme-clean component files

A Jest test that scans the new sticker components for raw hex / rgba
literals and fails the build if any are found. Scoped narrowly to new
files so existing legacy screens (with 66 known inline color literals)
do not break the suite. The clean-files list is extended as subsequent
plans migrate each screen.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage check:** This plan covers the Theme System section and the New Reusable Components subsection of the spec. The remaining sections (Mascot System usage on individual screens, Onboarding Flow, per-screen redesigns, accessibility/i18n) are deferred to subsequent plans per the spec's own Implementation Order.

**What this plan does NOT do (intentional, deferred to later plans):**
- Migrate the 66 inline hex/rgba violations in existing screen code (each subsequent plan migrates the screens it touches and adds those files to `THEME_CLEAN_FILES`).
- Apply new components to any screen (Home/Albums migration is Plan 2).
- Add the onboarding route or its SecureStore gate (Plan 3).
- Add new i18n strings (added when their consuming screens are migrated).

**Open follow-ups within this plan:** None.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-sticker-world-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
