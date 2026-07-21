/**
 * SoSet design tokens — dark, premium athletic-tech system (green-to-teal
 * primary accent, blue/purple/orange secondary accents). Single source of
 * truth for color/spacing/radius/shadow/typography. Every screen and
 * component should read from here rather than hardcoding values.
 */

export const colors = {
  bg: {
    base: '#090B10',
    surface: '#171B23',
    surfaceElevated: '#1D222C',
  },
  border: {
    default: '#29303C',
    subtle: 'rgba(255,255,255,0.06)',
  },
  text: {
    primary: '#F2F4F7',
    secondary: '#A7AFBD',
    tertiary: '#737C8C',
    onAccent: '#04140D',
  },
  accent: {
    primary: '#00E38E',
    primaryPressed: '#00C67C',
    subtle: 'rgba(0,227,142,0.12)',
    /** Secondary brand accents — one per purpose (info/social = blue,
     * AI/insight = purple, share/energy = orange), never competing with the
     * primary green within the same element. */
    teal: '#00D8B4',
    blue: '#00BFFF',
    purple: '#7861FF',
    orange: '#FF8A3D',
  },
  semantic: {
    success: '#00E38E',
    warning: '#FFB454',
    danger: '#FF5D6C',
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Cross-platform elevation: pairs iOS shadow props with an Android `elevation`
 * fallback so a single token produces a consistent-looking lift on both.
 * Kept restrained — the brand direction explicitly avoids large uncontrolled
 * shadows/glows, so these are soft lifts, not glow effects.
 */
export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

/** Color stops for react-native-linear-gradient/react-native-svg, start-to-end. */
export const gradients = {
  /** The brand's signature green-to-teal sweep — buttons, the logo mark, celebratory moments. */
  accent: ['#00E38E', '#00D8B4'] as const,
  surface: ['#1D222C', '#171B23'] as const,
} as const;

export const sizes = {
  touchTarget: 44,
  iconButton: 40,
  icon: { sm: 16, md: 20, lg: 24 },
} as const;

/**
 * The brand board specifies Inter. No font binaries are bundled in this repo
 * yet — bundling real Inter .ttf files and linking them via
 * `react-native.config.js` assets + `npx react-native-asset` is a follow-up
 * step outside what can be done here (see the branding report). Until then
 * this stays `undefined`, which falls back to the platform system font
 * (SF Pro / Roboto) — visually close to Inter (both are grotesque-style
 * humanist sans-serifs) and keeps the app dependency-free in the meantime.
 * Once real font files are added, set these to the linked family names
 * (e.g. 'Inter-Regular', 'Inter-Bold') and thread `fontFamily` through
 * `components/core/Text.tsx` and `Numeral.tsx`.
 */
export const fontFamily = {
  numeral: undefined,
  body: undefined,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 38 },
  numeralXl: { fontSize: 56, fontWeight: '900' as const, letterSpacing: -1, lineHeight: 58 },
  numeralLg: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -0.5, lineHeight: 40 },
  numeralMd: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.25, lineHeight: 28 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 26 },
  subtitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4, lineHeight: 16 },
} as const;

export type ColorTokens = typeof colors;
export type TypographyVariant = keyof typeof typography;
