// Backup format: versioned JSON with strict structural validation.
// Validation is pure and returns a human-readable error list; nothing is applied
// before the user confirms the preview.

import { isValidDayKey } from './dates';
import { isMuscleGroup, normalizeMuscles, type MuscleGroup } from './workouts';

export const BACKUP_FORMAT = 'forma-backup';
export const BACKUP_VERSION = 1;

export type BackupData = {
  settings: {
    themeMode: 'system' | 'dark' | 'light';
    startWeightKg: number | null;
    targetWeightKg: number | null;
    weightUnit: 'kg';
  };
  weight: {
    date: string;
    weightKg: number;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  workouts: {
    date: string;
    title: string | null;
    muscles: MuscleGroup[];
    durationMin: number | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  habits: {
    title: string;
    emoji: string | null;
    position: number;
    archived: boolean;
    createdAt: string;
  }[];
  habitChecks: {
    habitIndex: number;
    date: string;
    done: boolean;
  }[];
  nutrition: {
    date: string;
    planFollowed: boolean | null;
    note: string | null;
    updatedAt: string;
  }[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: { name: 'Форма'; version: string };
  exportedAt: string;
  data: BackupData;
};

export type ValidationOutcome =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; errors: string[] };

export type BackupSummary = {
  weight: number;
  workouts: number;
  habits: number;
  nutrition: number;
  exportedAt: string | null;
  appVersion: string | null;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isString = (v: unknown): v is string => typeof v === 'string';
const isNullableString = (v: unknown): v is string | null => v == null || isString(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNullableFiniteNumber = (v: unknown): v is number | null => v == null || isFiniteNumber(v);

function checkIsoDate(value: unknown, path: string, errors: string[]): value is string {
  if (!isString(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${path}: ожидалась дата в формате ISO`);
    return false;
  }
  return true;
}

export function validateBackup(input: unknown): ValidationOutcome {
  const errors: string[] = [];

  if (!isObject(input)) return { ok: false, errors: ['Файл не является JSON-объектом'] };
  if (input.format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['Это не резервная копия приложения «Форма»'] };
  }
  if (input.version !== BACKUP_VERSION) {
    return {
      ok: false,
      errors: [`Неподдерживаемая версия копии: ${String(input.version)} (ожидается ${BACKUP_VERSION})`],
    };
  }
  if (!isObject(input.data)) return { ok: false, errors: ['Отсутствует раздел data'] };

  const data = input.data;
  const app = isObject(input.app) ? input.app : {};

  // settings
  const settings: BackupData['settings'] = {
    themeMode: 'system',
    startWeightKg: null,
    targetWeightKg: null,
    weightUnit: 'kg',
  };
  if (data.settings != null) {
    if (!isObject(data.settings)) {
      errors.push('settings: ожидался объект');
    } else {
      const s = data.settings;
      if (s.themeMode != null) {
        if (s.themeMode === 'system' || s.themeMode === 'dark' || s.themeMode === 'light') {
          settings.themeMode = s.themeMode;
        } else errors.push('settings.themeMode: system | dark | light');
      }
      if (s.startWeightKg != null && !isNullableFiniteNumber(s.startWeightKg)) {
        errors.push('settings.startWeightKg: число или null');
      } else {
        settings.startWeightKg = (s.startWeightKg as number | null) ?? null;
      }
      if (s.targetWeightKg != null && !isNullableFiniteNumber(s.targetWeightKg)) {
        errors.push('settings.targetWeightKg: число или null');
      } else {
        settings.targetWeightKg = (s.targetWeightKg as number | null) ?? null;
      }
      if (s.weightUnit !== undefined && s.weightUnit !== 'kg') {
        errors.push('settings.weightUnit: поддерживается только kg');
      }
    }
  }

  // weight
  const weight: BackupData['weight'] = [];
  const seenWeightDates = new Set<string>();
  const rawWeight = data.weight ?? [];
  if (!Array.isArray(rawWeight)) {
    errors.push('weight: ожидался массив');
  } else {
    rawWeight.forEach((item, i) => {
      const path = `weight[${i}]`;
      if (!isObject(item)) return void errors.push(`${path}: ожидался объект`);
      const { date, weightKg } = item;
      if (!isValidDayKey(date)) return void errors.push(`${path}.date: некорректная дата`);
      if (!isFiniteNumber(weightKg) || weightKg < 20 || weightKg > 400) {
        return void errors.push(`${path}.weightKg: ожидалось 20…400`);
      }
      if (seenWeightDates.has(date)) {
        return void errors.push(`${path}: повторная запись за ${date}`);
      }
      seenWeightDates.add(date);
      const createdAt = checkIsoDate(item.createdAt ?? item.updatedAt, `${path}.createdAt`, errors)
        ? (item.createdAt as string)
        : new Date().toISOString();
      const updatedAt = checkIsoDate(item.updatedAt ?? item.createdAt, `${path}.updatedAt`, errors)
        ? (item.updatedAt as string)
        : createdAt;
      if (item.note != null && !isNullableString(item.note)) errors.push(`${path}.note: строка или null`);
      weight.push({
        date,
        weightKg: Math.round(weightKg * 10) / 10,
        note: isNullableString(item.note) ? item.note : null,
        createdAt,
        updatedAt,
      });
    });
  }

  // workouts
  const workouts: BackupData['workouts'] = [];
  const rawWorkouts = data.workouts ?? [];
  if (!Array.isArray(rawWorkouts)) {
    errors.push('workouts: ожидался массив');
  } else {
    rawWorkouts.forEach((item, i) => {
      const path = `workouts[${i}]`;
      if (!isObject(item)) return void errors.push(`${path}: ожидался объект`);
      if (!isValidDayKey(item.date)) return void errors.push(`${path}.date: некорректная дата`);
      if (!Array.isArray(item.muscles) || item.muscles.length === 0) {
        return void errors.push(`${path}.muscles: нужна хотя бы одна группа`);
      }
      const unknown = item.muscles.filter((m) => !isMuscleGroup(m));
      if (unknown.length > 0) {
        return void errors.push(`${path}.muscles: неизвестные группы: ${unknown.join(', ')}`);
      }
      if (item.durationMin != null && (!Number.isInteger(item.durationMin) || (item.durationMin as number) <= 0)) {
        return void errors.push(`${path}.durationMin: целое число минут или null`);
      }
      const createdAt = checkIsoDate(item.createdAt ?? item.updatedAt, `${path}.createdAt`, errors)
        ? (item.createdAt as string)
        : new Date().toISOString();
      const updatedAt = checkIsoDate(item.updatedAt ?? item.createdAt, `${path}.updatedAt`, errors)
        ? (item.updatedAt as string)
        : createdAt;
      workouts.push({
        date: item.date,
        title: isNullableString(item.title) ? item.title : null,
        muscles: normalizeMuscles(item.muscles),
        durationMin: (item.durationMin as number | null) ?? null,
        note: isNullableString(item.note) ? item.note : null,
        createdAt,
        updatedAt,
      });
    });
  }

  // habits
  const habits: BackupData['habits'] = [];
  const rawHabits = data.habits ?? [];
  if (!Array.isArray(rawHabits)) {
    errors.push('habits: ожидался массив');
  } else {
    rawHabits.forEach((item, i) => {
      const path = `habits[${i}]`;
      if (!isObject(item)) return void errors.push(`${path}: ожидался объект`);
      if (!isString(item.title) || item.title.trim().length === 0) {
        return void errors.push(`${path}.title: непустая строка`);
      }
      if (item.position != null && !isFiniteNumber(item.position)) {
        return void errors.push(`${path}.position: число`);
      }
      const createdAt = checkIsoDate(item.createdAt, `${path}.createdAt`, errors)
        ? (item.createdAt as string)
        : new Date().toISOString();
      habits.push({
        title: item.title.trim().slice(0, 60),
        emoji: isNullableString(item.emoji) ? item.emoji : null,
        position: isFiniteNumber(item.position) ? item.position : i,
        archived: typeof item.archived === 'boolean' ? item.archived : false,
        createdAt,
      });
    });
  }

  // habit checks
  const habitChecks: BackupData['habitChecks'] = [];
  const rawChecks = data.habitChecks ?? [];
  if (!Array.isArray(rawChecks)) {
    errors.push('habitChecks: ожидался массив');
  } else {
    rawChecks.forEach((item, i) => {
      const path = `habitChecks[${i}]`;
      if (!isObject(item)) return void errors.push(`${path}: ожидался объект`);
      if (!Number.isInteger(item.habitIndex) || (item.habitIndex as number) < 0) {
        return void errors.push(`${path}.habitIndex: индекс привычки`);
      }
      if ((item.habitIndex as number) >= habits.length) {
        return void errors.push(`${path}.habitIndex: ссылается на несуществующую привычку`);
      }
      if (!isValidDayKey(item.date)) return void errors.push(`${path}.date: некорректная дата`);
      if (typeof item.done !== 'boolean') return void errors.push(`${path}.done: boolean`);
      habitChecks.push({ habitIndex: item.habitIndex as number, date: item.date, done: item.done });
    });
  }

  // nutrition
  const nutrition: BackupData['nutrition'] = [];
  const seenNutrition = new Set<string>();
  const rawNutrition = data.nutrition ?? [];
  if (!Array.isArray(rawNutrition)) {
    errors.push('nutrition: ожидался массив');
  } else {
    rawNutrition.forEach((item, i) => {
      const path = `nutrition[${i}]`;
      if (!isObject(item)) return void errors.push(`${path}: ожидался объект`);
      if (!isValidDayKey(item.date)) return void errors.push(`${path}.date: некорректная дата`);
      if (seenNutrition.has(item.date)) return void errors.push(`${path}: повторная запись за ${item.date}`);
      seenNutrition.add(item.date);
      if (item.planFollowed != null && typeof item.planFollowed !== 'boolean') {
        return void errors.push(`${path}.planFollowed: boolean или null`);
      }
      const updatedAt = checkIsoDate(item.updatedAt, `${path}.updatedAt`, errors)
        ? (item.updatedAt as string)
        : new Date().toISOString();
      nutrition.push({
        date: item.date,
        planFollowed: (item.planFollowed as boolean | null) ?? null,
        note: isNullableString(item.note) ? item.note : null,
        updatedAt,
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 12) };

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: { name: 'Форма', version: isString(app.version) ? app.version : 'unknown' },
    exportedAt: isString(input.exportedAt) ? input.exportedAt : new Date().toISOString(),
    data: { settings, weight, workouts, habits, habitChecks, nutrition },
  };

  return {
    ok: true,
    backup,
    summary: {
      weight: weight.length,
      workouts: workouts.length,
      habits: habits.length,
      nutrition: nutrition.length,
      exportedAt: isString(input.exportedAt) ? input.exportedAt : null,
      appVersion: isString(app.version) ? app.version : null,
    },
  };
}

export function parseBackupText(text: string): ValidationOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Файл повреждён: не удалось прочитать JSON'] };
  }
  return validateBackup(parsed);
}

export type ImportMode = 'replace' | 'merge';

/** Human-readable confirmation text shown before applying an import. */
export function describeImport(
  summary: BackupSummary,
  mode: ImportMode,
  current: { weight: number; workouts: number }
): string {
  const lines = [
    mode === 'replace'
      ? 'Текущие данные будут заменены данными из копии.'
      : 'Записи из копии будут добавлены. Совпадающие по дате записи веса и питания будут обновлены.',
    '',
    `Вес: ${summary.weight} (сейчас ${current.weight})`,
    `Тренировки: ${summary.workouts} (сейчас ${current.workouts})`,
    `Привычки: ${summary.habits}`,
    `Дни питания: ${summary.nutrition}`,
  ];
  if (summary.exportedAt) {
    const d = new Date(summary.exportedAt);
    if (!Number.isNaN(d.getTime())) lines.push('', `Копия от ${d.toLocaleString('ru-RU')}`);
  }
  return lines.join('\n');
}
