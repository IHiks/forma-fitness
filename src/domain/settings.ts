export type ThemeMode = 'system' | 'dark' | 'light';

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Как на устройстве',
  dark: 'Тёмная',
  light: 'Светлая',
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'dark' || value === 'light';
}

export const MIN_SETTING_WEIGHT = 20;
export const MAX_SETTING_WEIGHT = 400;

export function isWeightSetting(value: number | null): value is number {
  return (
    value != null && Number.isFinite(value) && value >= MIN_SETTING_WEIGHT && value <= MAX_SETTING_WEIGHT
  );
}

export function normalizeSettingWeight(raw: string): number | null {
  const cleaned = raw.replace(',', '.').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < MIN_SETTING_WEIGHT || n > MAX_SETTING_WEIGHT) return null;
  return Math.round(n * 10) / 10;
}
