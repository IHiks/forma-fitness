import { addDays, startOfWeek } from '@/domain/dates';
import {
  normalizeWeightSeries,
  parseWeightInput,
  periodStart,
  roundWeight,
  selectSeriesForPeriod,
  summarizeWeight,
  toStartDelta,
  trendFromSeries,
  weeklyAverages,
  weightTrend,
} from '@/domain/weight';

import { weightEntry } from '@/__tests__/helpers/testDb';

describe('roundWeight / parseWeightInput', () => {
  it('rounds to 0.1 kg', () => {
    expect(roundWeight(72.34)).toBe(72.3);
    expect(roundWeight(72.36)).toBe(72.4);
    expect(roundWeight(72.35)).toBe(72.4);
  });

  it('accepts comma and dot separators', () => {
    expect(parseWeightInput('72,4')).toBe(72.4);
    expect(parseWeightInput('72.4')).toBe(72.4);
    expect(parseWeightInput(' 72,4 ')).toBe(72.4);
  });

  it('rejects garbage', () => {
    expect(parseWeightInput('')).toBeNull();
    expect(parseWeightInput('abc')).toBeNull();
    expect(parseWeightInput('7.2.3')).toBeNull();
    expect(parseWeightInput('-5')).toBeNull();
    expect(parseWeightInput('72,4567')).toBeNull();
  });
});

describe('normalizeWeightSeries', () => {
  it('sorts by date and keeps one point per date', () => {
    const series = normalizeWeightSeries([
      weightEntry('2026-03-05', 71),
      weightEntry('2026-03-01', 72.5),
      weightEntry('2026-03-05', 70.5, { updatedAt: '2026-03-05T10:00:00.000Z' }),
    ]);
    expect(series).toEqual([
      { date: '2026-03-01', weightKg: 72.5 },
      { date: '2026-03-05', weightKg: 70.5 },
    ]);
  });

  it('keeps gaps as separate points without inventing data', () => {
    const series = normalizeWeightSeries([
      weightEntry('2026-01-01', 75),
      weightEntry('2026-04-01', 73),
    ]);
    expect(series).toHaveLength(2);
  });
});

describe('summarizeWeight', () => {
  it('computes change vs previous and vs first', () => {
    const summary = summarizeWeight([
      weightEntry('2026-01-01', 75),
      weightEntry('2026-02-01', 74.4),
      weightEntry('2026-03-01', 73.9),
    ]);
    expect(summary.latest?.weightKg).toBe(73.9);
    expect(summary.previous?.weightKg).toBe(74.4);
    expect(summary.changeFromPrevious).toBe(-0.5);
    expect(summary.changeFromFirst).toBe(-1.1);
  });

  it('has no changes with a single measurement', () => {
    const summary = summarizeWeight([weightEntry('2026-01-01', 75)]);
    expect(summary.changeFromPrevious).toBeNull();
    expect(summary.changeFromFirst).toBeNull();
  });

  it('is empty-safe', () => {
    const summary = summarizeWeight([]);
    expect(summary.latest).toBeNull();
    expect(summary.changeFromPrevious).toBeNull();
  });
});

describe('weightTrend / trendFromSeries', () => {
  it('smooths only with enough points in the window', () => {
    const entries = [
      weightEntry('2026-01-01', 75),
      weightEntry('2026-01-02', 74),
      weightEntry('2026-01-03', 73),
      weightEntry('2026-01-04', 72),
    ];
    const trend = weightTrend(entries, { window: 3, minPoints: 3 });
    expect(trend[0]!.smoothed).toBeNull();
    expect(trend[1]!.smoothed).toBeNull();
    expect(trend[2]!.smoothed).toBe(74); // (75+74+73)/3
    expect(trend[3]!.smoothed).toBe(73); // (74+73+72)/3
    expect(trend.map((t) => t.actual)).toEqual([75, 74, 73, 72]);
  });

  it('never fabricates points across a gap', () => {
    const series = [
      { date: '2026-01-01', weightKg: 75 },
      { date: '2026-05-01', weightKg: 73 },
    ];
    const trend = trendFromSeries(series, { window: 5, minPoints: 3 });
    expect(trend).toHaveLength(2);
    expect(trend[0]!.smoothed).toBeNull();
    expect(trend[1]!.smoothed).toBeNull();
  });
});

describe('weeklyAverages', () => {
  it('only averages weeks with at least 3 measurements', () => {
    // 2026-03-02 is a Monday, so all these days are in the same week.
    const entries = [
      weightEntry('2026-03-02', 75),
      weightEntry('2026-03-04', 74),
      weightEntry('2026-03-06', 73),
      weightEntry('2026-03-09', 72), // next week, single measurement
    ];
    const weeks = weeklyAverages(entries, (d) => startOfWeek(d), 3);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]!.weekStart).toBe('2026-03-02');
    expect(weeks[0]!.average).toBe(74);
    expect(weeks[0]!.count).toBe(3);
  });

  it('ignores duplicate dates within a week', () => {
    const entries = [
      weightEntry('2026-03-02', 75),
      weightEntry('2026-03-02', 70, { updatedAt: '2026-03-02T12:00:00.000Z' }),
      weightEntry('2026-03-03', 74),
    ];
    const weeks = weeklyAverages(entries, (d) => startOfWeek(d), 3);
    expect(weeks).toHaveLength(0); // only 2 distinct days
  });
});

describe('periods', () => {
  it('periodStart covers the requested window', () => {
    expect(periodStart('7d', '2026-03-10', addDays)).toBe('2026-03-04');
    expect(periodStart('30d', '2026-03-10', addDays)).toBe('2026-02-09');
    expect(periodStart('all', '2026-03-10', addDays)).toBeNull();
  });

  it('keeps a nearby anchor point but drops distant history', () => {
    const points = [
      { date: '2026-02-25', weightKg: 76 }, // 3 days before the window
      { date: '2026-03-08', weightKg: 75 },
      { date: '2026-03-10', weightKg: 74.5 },
    ];
    const visible = selectSeriesForPeriod(points, '2026-03-01');
    expect(visible[0]!.date).toBe('2026-02-25');

    const far = [
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-03-08', weightKg: 75 },
    ];
    const visibleFar = selectSeriesForPeriod(far, '2026-03-01');
    expect(visibleFar).toHaveLength(1);
    expect(visibleFar[0]!.date).toBe('2026-03-08');
  });

  it('returns nothing when the window has no data', () => {
    expect(selectSeriesForPeriod([{ date: '2026-01-01', weightKg: 80 }], '2026-03-01')).toEqual([]);
  });
});

describe('toStartDelta', () => {
  it('prefers the configured start weight', () => {
    const summary = summarizeWeight([weightEntry('2026-01-01', 75), weightEntry('2026-02-01', 74)]);
    expect(toStartDelta(summary, 80)).toBe(-6);
  });

  it('falls back to the first measurement', () => {
    const summary = summarizeWeight([weightEntry('2026-01-01', 75), weightEntry('2026-02-01', 74)]);
    expect(toStartDelta(summary, null)).toBe(-1);
  });
});
