import {
  addDays,
  daysBetween,
  endOfMonth,
  endOfWeek,
  formatDayFull,
  formatDuration,
  formatMonthYear,
  formatRelativeDay,
  formatSignedWeight,
  isValidDayKey,
  monthGrid,
  pluralize,
  startOfMonth,
  startOfWeek,
  toDayKey,
  todayKey,
} from '@/domain/dates';

describe('DayKey basics', () => {
  it('round-trips through toDayKey', () => {
    const d = new Date(2026, 2, 5, 23, 30);
    expect(toDayKey(d)).toBe('2026-03-05');
  });

  it('validates real calendar dates only', () => {
    expect(isValidDayKey('2026-02-28')).toBe(true);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('26-03-05')).toBe(false);
    expect(isValidDayKey(42)).toBe(false);
  });

  it('addDays crosses month and year borders', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', 40)).toBe('2026-04-10');
  });

  it('daysBetween is signed and symmetric in magnitude', () => {
    expect(daysBetween('2026-03-01', '2026-03-05')).toBe(4);
    expect(daysBetween('2026-03-05', '2026-03-01')).toBe(-4);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1); // високосный год 2026 — нет
  });
});

describe('week and month boundaries (Monday start)', () => {
  it('startOfWeek snaps to Monday', () => {
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19'); // понедельник
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // воскресенье
    expect(startOfWeek('2026-10-20')).toBe('2026-10-19'); // вторник
  });

  it('endOfWeek is Sunday', () => {
    expect(endOfWeek('2026-10-19')).toBe('2026-10-25');
    expect(endOfWeek('2026-10-25')).toBe('2026-10-25');
  });

  it('month boundaries', () => {
    expect(startOfMonth('2026-10-19')).toBe('2026-10-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29'); // високосный
  });

  it('monthGrid always covers 6 weeks starting on Monday', () => {
    const grid = monthGrid('2026-10-19');
    expect(grid).toHaveLength(42);
    expect(startOfWeek(grid[0]!)).toBe(grid[0]);
    expect(grid).toContain('2026-10-01');
    expect(grid).toContain('2026-10-31');
  });
});

describe('formatting', () => {
  it('formats Russian dates', () => {
    expect(formatDayFull('2026-10-19')).toBe('Пн, 19 октября');
    expect(formatMonthYear('2026-10-19')).toBe('Октябрь 2026');
  });

  it('formats relative days', () => {
    expect(formatRelativeDay('2026-10-19', '2026-10-19')).toBe('Сегодня');
    expect(formatRelativeDay('2026-10-18', '2026-10-19')).toBe('Вчера');
    expect(formatRelativeDay('2026-10-16', '2026-10-19')).toBe('3 дн. назад');
  });

  it('signed weight uses a proper minus sign', () => {
    expect(formatSignedWeight(-1.2)).toBe('−1,2');
    expect(formatSignedWeight(1.2)).toBe('+1,2');
    expect(formatSignedWeight(0)).toBe('0,0');
    expect(formatSignedWeight(-0)).toBe('0,0');
  });

  it('pluralize follows Russian rules', () => {
    expect(pluralize(1, 'день', 'дня', 'дней')).toBe('день');
    expect(pluralize(2, 'день', 'дня', 'дней')).toBe('дня');
    expect(pluralize(5, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralize(11, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralize(21, 'день', 'дня', 'дней')).toBe('день');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 мин');
    expect(formatDuration(60)).toBe('1 ч');
    expect(formatDuration(90)).toBe('1 ч 30 мин');
    expect(formatDuration(0)).toBe('—');
  });
});

describe('todayKey', () => {
  it('produces a valid day key', () => {
    expect(isValidDayKey(todayKey())).toBe(true);
  });
});
