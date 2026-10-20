// Typography scale. Bundled with the app (no network fetch).
export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1.1 },
  title: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.7 },
  headline: { fontFamily: fontFamily.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  subtitle: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12.5, lineHeight: 17, letterSpacing: 0.1 },
  micro: { fontFamily: fontFamily.semibold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.9 },
  numberXL: { fontFamily: fontFamily.extrabold, fontSize: 40, lineHeight: 44, letterSpacing: -1.6 },
  numberL: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  numberM: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;
