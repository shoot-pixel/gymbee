/**
 * GymBee design tokens — dark, high-contrast, single-accent "bold athletic" system.
 * Single source of truth for color/spacing/radius/typography. Every screen and
 * component should read from here rather than hardcoding values.
 */

export const colors = {
  bg: {
    base: '#0E0E10',
    surface: '#17171A',
    surfaceElevated: '#1F1F23',
  },
  border: {
    default: '#2A2A2E',
    subtle: '#1F1F23',
  },
  text: {
    primary: '#F5F5F0',
    secondary: '#9A9AA2',
    tertiary: '#5C5C64',
    onAccent: '#0E0E10',
  },
  accent: {
    primary: '#C8FF3D',
    primaryPressed: '#B0E62E',
  },
  semantic: {
    success: '#3DDC97',
    warning: '#FFC53D',
    danger: '#FF5D5D',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/**
 * No bundled custom font files yet (Archivo Black / Inter) — these are placeholders
 * using heavy system-font weights so the app builds and looks intentional today.
 * Drop real font files into src/assets/fonts, link them, and swap the family names
 * below when ready; nothing else in the app needs to change.
 */
export const fontFamily = {
  numeral: undefined, // falls back to system font; set e.g. 'ArchivoBlack-Regular' once bundled
  body: undefined, // falls back to system font; set e.g. 'Inter-Regular' once bundled
} as const;

export const typography = {
  numeralXl: { fontSize: 56, fontWeight: '900' as const, letterSpacing: -1 },
  numeralLg: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -0.5 },
  numeralMd: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.25 },
  title: { fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

export type ColorTokens = typeof colors;
export type TypographyVariant = keyof typeof typography;
