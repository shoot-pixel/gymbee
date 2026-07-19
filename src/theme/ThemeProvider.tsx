import React, { createContext, useContext, useMemo } from 'react';
import { colors, spacing, radii, typography, fontFamily } from './tokens';

const theme = { colors, spacing, radii, typography, fontFamily } as const;

export type Theme = typeof theme;

const ThemeContext = createContext<Theme>(theme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => theme, []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
