// Date helpers. All journal days are local calendar days encoded as `YYYY-MM-DD`.
// Never use `new Date('YYYY-MM-DD')` for display: it parses as UTC and shifts the day
// in negative-offset timezones. Everything here is local-time safe.

export type DayKey = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function isValidDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function addDays(day: DayKey, delta: number): DayKey {
  const d = parseDayKey(day);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export function startOfWeek(day: DayKey): DayKey {
  const d = parseDayKey(day);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toDayKey(d);
}

export function endOfWeek(day: DayKey): DayKey {
  return addDays(startOfWeek(day), 6);
}

export function startOfMonth(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: DayKey): DayKey {
  const d = parseDayKey(day);
  return toDayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
}

export function daysBetween(from: DayKey, to: DayKey): number {
  const a = parseDayKey(from).getTime();
  const b = parseDayKey(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isWithin(day: DayKey, from: DayKey, to: DayKey): boolean {
  return day >= from && day <= to;
}

export const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

export const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export function weekdayShort(day: DayKey): string {
  const d = parseDayKey(day);
  return WEEKDAYS_SHORT[(d.getDay() + 6) % 7] ?? '';
}

export function formatDayLong(day: DayKey): string {
  const d = parseDayKey(day);
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export function formatDayFull(day: DayKey): string {
  const d = parseDayKey(day);
  return `${weekdayShort(day)}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export function formatMonthYear(day: DayKey): string {
  const d = parseDayKey(day);
  return `${MONTHS_NOMINATIVE[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRelativeDay(day: DayKey, today: DayKey = todayKey()): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  if (diff === -1) return 'Завтра';
  if (diff > 1 && diff < 7) return `${diff} дн. назад`;
  return formatDayLong(day);
}

export function formatWeight(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function formatSignedWeight(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '0,0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1).replace('.', ',')}`;
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/** Calendar grid (6 rows × 7 columns) starting on Monday, for the month containing `day`. */
export function monthGrid(day: DayKey): DayKey[] {
  const first = startOfMonth(day);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Monday-based weekday index, 0..6 */
export function mondayIndex(day: DayKey): number {
  return (parseDayKey(day).getDay() + 6) % 7;
}

/** Local timestamp label for a record (date + time of creation/editing). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isValidTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number) as [number, number];
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
