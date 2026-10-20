import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import type { ColorScheme, Palette, ThemeMode } from './palettes';
import { palettes } from './palettes';
import { fontFamily, radius, spacing, type } from './tokens';

type ThemeValue = {
  colors: Palette;
  scheme: ColorScheme;
  mode: ThemeMode;
  /** Resolves a stored mode against the current OS scheme (for previews before saving). */
  preview: (mode: ThemeMode) => Palette;
  tokens: { spacing: typeof spacing; radius: typeof radius; type: typeof type; fontFamily: typeof fontFamily };
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function resolveScheme(mode: ThemeMode, system: ColorScheme | null | undefined): ColorScheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const scheme = resolveScheme(mode, system);

  const value = useMemo<ThemeValue>(
    () => ({
      colors: palettes[scheme],
      scheme,
      mode,
      preview: (m: ThemeMode) => palettes[resolveScheme(m, system)],
      tokens: { spacing, radius, type, fontFamily },
    }),
    [scheme, mode, system]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export type { ColorScheme, Palette, ThemeMode };
export { spacing, radius, type, fontFamily } from './tokens';
