export type ThemeMode = 'system' | 'dark' | 'light';
export type ColorScheme = 'dark' | 'light';

export type Palette = {
  scheme: ColorScheme;
  bg: string;
  bgElevated: string;
  card: string;
  cardPressed: string;
  cardBorder: string;
  cardHighlight: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  info: string;
  divider: string;
  chartLine: string;
  chartFillFrom: string;
  chartFillTo: string;
  chartTrend: string;
  chartGrid: string;
  calendarMuted: string;
  scrim: string;
  tabBar: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
  muscleColors: string[];
};

const muscleColorsDark = [
  '#4CE39A',
  '#6FB8FF',
  '#FFC46B',
  '#FF8FAB',
  '#B49BFF',
  '#7CE0D3',
  '#F29A6B',
  '#A9D96B',
  '#E7E28A',
  '#8FD3F4',
  '#D3A6FF',
  '#B9C3C0',
];

const muscleColorsLight = [
  '#12875A',
  '#2F6FB8',
  '#B97512',
  '#C2416B',
  '#6946C5',
  '#1C8C80',
  '#B85A2A',
  '#5C8A1E',
  '#8A841A',
  '#2C7FA3',
  '#8A4FC7',
  '#66726F',
];

export const darkPalette: Palette = {
  scheme: 'dark',
  bg: '#0B0D0C',
  bgElevated: '#101413',
  card: '#151A18',
  cardPressed: '#1B211F',
  cardBorder: 'rgba(255,255,255,0.065)',
  cardHighlight: 'rgba(76,227,154,0.055)',
  text: '#F3F6F4',
  textSecondary: '#A7B2AD',
  textTertiary: '#6E7A75',
  accent: '#4CE39A',
  accentPressed: '#3FCB88',
  accentSoft: 'rgba(76,227,154,0.12)',
  accentText: '#7CEFB7',
  onAccent: '#06150E',
  danger: '#FF6B7A',
  dangerSoft: 'rgba(255,107,122,0.12)',
  warning: '#FFC46B',
  info: '#6FB8FF',
  divider: 'rgba(255,255,255,0.07)',
  chartLine: '#4CE39A',
  chartFillFrom: 'rgba(76,227,154,0.30)',
  chartFillTo: 'rgba(76,227,154,0.00)',
  chartTrend: 'rgba(167,178,173,0.85)',
  chartGrid: 'rgba(255,255,255,0.055)',
  calendarMuted: 'rgba(255,255,255,0.16)',
  scrim: 'rgba(0,0,0,0.55)',
  tabBar: 'rgba(12,15,14,0.86)',
  inputBg: '#101513',
  inputBorder: 'rgba(255,255,255,0.09)',
  shadow: '#000000',
  muscleColors: muscleColorsDark,
};

export const lightPalette: Palette = {
  scheme: 'light',
  bg: '#FBF7F2',
  bgElevated: '#FFFDFB',
  card: '#FFFFFF',
  cardPressed: '#FBF3EE',
  cardBorder: 'rgba(58,36,40,0.07)',
  cardHighlight: 'rgba(226,90,124,0.05)',
  text: '#241C1E',
  textSecondary: '#7B6B6E',
  textTertiary: '#A8979A',
  accent: '#D94F7A',
  accentPressed: '#C4446D',
  accentSoft: 'rgba(217,79,122,0.10)',
  accentText: '#B23A62',
  onAccent: '#FFFFFF',
  danger: '#D64545',
  dangerSoft: 'rgba(214,69,69,0.09)',
  warning: '#B97512',
  info: '#2F6FB8',
  divider: 'rgba(58,36,40,0.08)',
  chartLine: '#D94F7A',
  chartFillFrom: 'rgba(217,79,122,0.22)',
  chartFillTo: 'rgba(217,79,122,0.00)',
  chartTrend: 'rgba(123,107,110,0.80)',
  chartGrid: 'rgba(58,36,40,0.07)',
  calendarMuted: 'rgba(36,28,30,0.16)',
  scrim: 'rgba(36,20,24,0.35)',
  tabBar: 'rgba(255,252,249,0.92)',
  inputBg: '#F8F1EC',
  inputBorder: 'rgba(58,36,40,0.10)',
  shadow: '#5A3A40',
  muscleColors: muscleColorsLight,
};

export const palettes: Record<ColorScheme, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};
