// Weight journal domain logic (pure). 0.1 kg precision.

export type WeightEntry = {
  id: number;
  date: string; // YYYY-MM-DD (unique)
  weightKg: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeightPoint = {
  date: string;
  weightKg: number;
};

export const MIN_WEIGHT = 20;
export const MAX_WEIGHT = 400;

/** Rounds to the displayed precision (0.1 kg). Half-up, symmetric for negatives. */
export function roundWeight(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function parseWeightInput(raw: string): number | null {
  const cleaned = raw.replace(',', '.').trim();
  if (!/^\d{1,3}(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateWeight(
  raw: string,
  date: string
): { ok: true; value: { date: string; weightKg: number } } | { ok: false; error: string } {
  if (!date) return { ok: false, error: 'Укажите дату' };
  const parsed = parseWeightInput(raw);
  if (parsed == null) return { ok: false, error: 'Введите вес, например 72,4' };
  if (parsed < MIN_WEIGHT || parsed > MAX_WEIGHT) {
    return { ok: false, error: `Вес должен быть от ${MIN_WEIGHT} до ${MAX_WEIGHT} кг` };
  }
  return { ok: true, value: { date, weightKg: roundWeight(parsed) } };
}

/** Sorted ascending by date, one point per distinct date (latest wins on duplicates). */
export function normalizeWeightSeries(entries: readonly WeightEntry[]): WeightPoint[] {
  const byDate = new Map<string, number>();
  for (const e of [...entries].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
    byDate.set(e.date, e.weightKg);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weightKg]) => ({ date, weightKg }));
}

export type WeightSummary = {
  latest: WeightPoint | null;
  previous: WeightPoint | null;
  first: WeightPoint | null;
  changeFromPrevious: number | null;
  changeFromFirst: number | null;
};

export function summarizeWeight(entries: readonly WeightEntry[]): WeightSummary {
  const series = normalizeWeightSeries(entries);
  const latest = series.at(-1) ?? null;
  const previous = series.at(-2) ?? null;
  const first = series[0] ?? null;
  return {
    latest,
    previous,
    first,
    changeFromPrevious:
      latest && previous ? roundWeight(latest.weightKg - previous.weightKg) : null,
    // Comparing the latest measurement to the very first one is only meaningful
    // when there are at least two distinct measurements.
    changeFromFirst:
      latest && first && series.length >= 2 ? roundWeight(latest.weightKg - first.weightKg) : null,
  };
}

export type TrendPoint = {
  date: string;
  actual: number;
  /** Smoothed value (moving average over available measurements), or null. */
  smoothed: number | null;
};

/**
 * Trends are computed only from real measurements. A smoothed value exists only when
 * enough measurements are inside the window; we never invent points across gaps.
 */
export function weightTrend(
  entries: readonly WeightEntry[],
  options: { window?: number; minPoints?: number } = {}
): TrendPoint[] {
  return trendFromSeries(normalizeWeightSeries(entries), options);
}

/** Same as `weightTrend`, but for an already normalized (and filtered) point series. */
export function trendFromSeries(
  series: readonly WeightPoint[],
  options: { window?: number; minPoints?: number } = {}
): TrendPoint[] {
  const window = options.window ?? 5;
  const minPoints = options.minPoints ?? 3;
  return series.map((point, index) => {
    const from = Math.max(0, index - window + 1);
    const slice = series.slice(from, index + 1);
    const smoothed =
      slice.length >= minPoints
        ? roundWeight(slice.reduce((s, p) => s + p.weightKg, 0) / slice.length)
        : null;
    return { date: point.date, actual: point.weightKg, smoothed };
  });
}

export type WeeklyAverage = {
  weekStart: string;
  average: number;
  count: number;
};

/**
 * Weekly average is only produced for weeks with at least `minDays` distinct entries.
 * The current week is included only if it already has enough data.
 */
export function weeklyAverages(
  entries: readonly WeightEntry[],
  weekStartOf: (day: string) => string,
  minDays = 3
): WeeklyAverage[] {
  const groups = new Map<string, number[]>();
  for (const p of normalizeWeightSeries(entries)) {
    const key = weekStartOf(p.date);
    const list = groups.get(key) ?? [];
    list.push(p.weightKg);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, weights]) => weights.length >= minDays)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weights]) => ({
      weekStart,
      average: roundWeight(weights.reduce((s, w) => s + w, 0) / weights.length),
      count: weights.length,
    }));
}

export type Period = '7d' | '30d' | '3m' | 'year' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '3m': '3 мес',
  year: 'Год',
  all: 'Всё',
};

export function periodStart(period: Period, today: string, addDays: (d: string, n: number) => string): string | null {
  switch (period) {
    case '7d':
      return addDays(today, -6);
    case '30d':
      return addDays(today, -29);
    case '3m':
      return addDays(today, -89);
    case 'year':
      return addDays(today, -364);
    case 'all':
      return null;
  }
}

/**
 * Filters for display. For finite periods we keep the last measurement *before*
 * the window as a visual anchor only when it is reasonably close (<= 14 days),
 * so the chart never suggests data where there was none.
 */
export function selectSeriesForPeriod(
  points: readonly WeightPoint[],
  start: string | null
): WeightPoint[] {
  if (!start) return [...points];
  const inRange = points.filter((p) => p.date >= start);
  if (inRange.length === 0) return [];
  const before = points.filter((p) => p.date < start).at(-1);
  if (!before) return inRange;
  const gapDays = Math.round(
    (new Date(inRange[0]!.date).getTime() - new Date(before.date).getTime()) / 86_400_000
  );
  return gapDays <= 14 ? [before, ...inRange] : inRange;
}

export function toStartDelta(
  summary: WeightSummary,
  startWeightSetting: number | null
): number | null {
  if (startWeightSetting != null && summary.latest) {
    return roundWeight(summary.latest.weightKg - startWeightSetting);
  }
  return summary.changeFromFirst;
}
