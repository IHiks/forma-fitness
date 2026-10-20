import { endOfWeek, isValidDayKey, startOfWeek, type DayKey } from '../domain/dates';
import { nutritionState, type Habit, type HabitCheck, type NutritionDay } from '../domain/habits';
import type { WeightEntry } from '../domain/weight';
import type { MuscleGroup, Workout } from '../domain/workouts';
import { normalizeMuscles } from '../domain/workouts';
import { DEFAULT_HABITS } from '../domain/habits';
import type { BackupData, ImportMode } from '../domain/backup';
import type { SQLiteDatabase } from './sqlite';

type WeightRow = {
  id: number;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type WorkoutRow = {
  id: number;
  date: string;
  title: string | null;
  duration_min: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type HabitRow = {
  id: number;
  title: string;
  emoji: string | null;
  position: number;
  archived: number;
  created_at: string;
};

type NutritionRow = {
  date: string;
  plan_followed: number | null;
  note: string | null;
  updated_at: string;
};

function mapWeight(r: WeightRow): WeightEntry {
  return {
    id: r.id,
    date: r.date,
    weightKg: Math.round(r.weight_kg * 10) / 10,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    title: r.title,
    emoji: r.emoji,
    position: r.position,
    archived: r.archived === 1,
    createdAt: r.created_at,
  };
}

export class WeightRepository {
  constructor(private db: SQLiteDatabase) {}

  async list(): Promise<WeightEntry[]> {
    const rows = await this.db.getAllAsync<WeightRow>(
      'SELECT * FROM weight_entries ORDER BY date ASC, id ASC'
    );
    return rows.map(mapWeight);
  }

  async getByDate(date: DayKey): Promise<WeightEntry | null> {
    const row = await this.db.getFirstAsync<WeightRow>('SELECT * FROM weight_entries WHERE date = ?', [date]);
    return row ? mapWeight(row) : null;
  }

  /** Upsert: one weight per day, editing replaces the value but keeps the original row. */
  async save(input: { date: DayKey; weightKg: number; note?: string | null }): Promise<WeightEntry> {
    if (!isValidDayKey(input.date)) throw new Error('Некорректная дата');
    const weight = Math.round(input.weightKg * 10) / 10;
    if (!Number.isFinite(weight) || weight < 20 || weight > 400) throw new Error('Вес вне допустимого диапазона');
    await this.db.runAsync(
      `INSERT INTO weight_entries (date, weight_kg, note)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         note = excluded.note,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      [input.date, weight, input.note?.trim() || null]
    );
    const saved = await this.getByDate(input.date);
    if (!saved) throw new Error('Не удалось сохранить вес');
    return saved;
  }

  async remove(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM weight_entries WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM weight_entries');
    return row?.n ?? 0;
  }
}

export class WorkoutRepository {
  constructor(private db: SQLiteDatabase) {}

  async list(): Promise<Workout[]> {
    const rows = await this.db.getAllAsync<WorkoutRow>(
      'SELECT * FROM workouts ORDER BY date DESC, created_at DESC, id DESC'
    );
    const muscleRows = await this.db.getAllAsync<{ workout_id: number; muscle: string }>(
      'SELECT workout_id, muscle FROM workout_muscles'
    );
    const byWorkout = new Map<number, string[]>();
    for (const m of muscleRows) {
      const list = byWorkout.get(m.workout_id) ?? [];
      list.push(m.muscle);
      byWorkout.set(m.workout_id, list);
    }
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      muscles: normalizeMuscles(byWorkout.get(r.id) ?? []),
      durationMin: r.duration_min,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getById(id: number): Promise<Workout | null> {
    const all = await this.list();
    return all.find((w) => w.id === id) ?? null;
  }

  async create(input: {
    date: DayKey;
    title: string | null;
    muscles: readonly MuscleGroup[];
    durationMin: number | null;
    note: string | null;
  }): Promise<number> {
    const muscles = normalizeMuscles(input.muscles);
    if (muscles.length === 0) throw new Error('Нужна хотя бы одна группа мышц');
    let id = 0;
    await this.db.withTransactionAsync(async () => {
      const res = await this.db.runAsync(
        'INSERT INTO workouts (date, title, duration_min, note) VALUES (?, ?, ?, ?)',
        [input.date, input.title, input.durationMin, input.note]
      );
      id = res.lastInsertRowId;
      for (const muscle of muscles) {
        await this.db.runAsync('INSERT INTO workout_muscles (workout_id, muscle) VALUES (?, ?)', [id, muscle]);
      }
    });
    return id;
  }

  async update(
    id: number,
    input: {
      date: DayKey;
      title: string | null;
      muscles: readonly MuscleGroup[];
      durationMin: number | null;
      note: string | null;
    }
  ): Promise<void> {
    const muscles = normalizeMuscles(input.muscles);
    if (muscles.length === 0) throw new Error('Нужна хотя бы одна группа мышц');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE workouts SET date = ?, title = ?, duration_min = ?, note = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
        [input.date, input.title, input.durationMin, input.note, id]
      );
      await this.db.runAsync('DELETE FROM workout_muscles WHERE workout_id = ?', [id]);
      for (const muscle of muscles) {
        await this.db.runAsync('INSERT INTO workout_muscles (workout_id, muscle) VALUES (?, ?)', [id, muscle]);
      }
    });
  }

  async remove(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts');
    return row?.n ?? 0;
  }
}

export class NutritionRepository {
  constructor(private db: SQLiteDatabase) {}

  private map(r: NutritionRow): NutritionDay {
    return {
      date: r.date,
      planFollowed: r.plan_followed == null ? null : r.plan_followed === 1,
      note: r.note,
      updatedAt: r.updated_at,
    };
  }

  async list(): Promise<NutritionDay[]> {
    const rows = await this.db.getAllAsync<NutritionRow>(
      'SELECT * FROM nutrition_days ORDER BY date ASC'
    );
    return rows.map((r) => this.map(r));
  }

  async getByDate(date: DayKey): Promise<NutritionDay | null> {
    const row = await this.db.getFirstAsync<NutritionRow>('SELECT * FROM nutrition_days WHERE date = ?', [date]);
    return row ? this.map(row) : null;
  }

  async save(input: { date: DayKey; planFollowed: boolean | null; note?: string | null }): Promise<void> {
    if (!isValidDayKey(input.date)) throw new Error('Некорректная дата');
    const state = input.planFollowed;
    if (state == null && !input.note?.trim()) {
      await this.db.runAsync('DELETE FROM nutrition_days WHERE date = ?', [input.date]);
      return;
    }
    await this.db.runAsync(
      `INSERT INTO nutrition_days (date, plan_followed, note)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         plan_followed = excluded.plan_followed,
         note = excluded.note,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      [input.date, state == null ? null : state ? 1 : 0, input.note?.trim() || null]
    );
  }

  async state(date: DayKey) {
    return nutritionState((await this.getByDate(date)) ?? undefined);
  }
}

export class HabitRepository {
  constructor(private db: SQLiteDatabase) {}

  async list(includeArchived = false): Promise<Habit[]> {
    const rows = await this.db.getAllAsync<HabitRow>(
      `SELECT * FROM habits ${includeArchived ? '' : 'WHERE archived = 0'}
       ORDER BY position ASC, id ASC`
    );
    return rows.map(mapHabit);
  }

  async ensureDefaults(): Promise<void> {
    const row = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM habits');
    if ((row?.n ?? 0) > 0) return;
    for (const [i, habit] of DEFAULT_HABITS.entries()) {
      await this.create({ title: habit.title, emoji: habit.emoji, position: i });
    }
  }

  async create(input: { title: string; emoji?: string | null; position?: number }): Promise<number> {
    let position = input.position;
    if (position == null) {
      const row = await this.db.getFirstAsync<{ max: number | null }>('SELECT MAX(position) AS max FROM habits');
      position = (row?.max ?? -1) + 1;
    }
    const res = await this.db.runAsync('INSERT INTO habits (title, emoji, position) VALUES (?, ?, ?)', [
      input.title.trim(),
      input.emoji ?? null,
      position,
    ]);
    return res.lastInsertRowId;
  }

  async rename(id: number, title: string): Promise<void> {
    await this.db.runAsync('UPDATE habits SET title = ? WHERE id = ?', [title.trim(), id]);
  }

  async setPosition(id: number, position: number): Promise<void> {
    await this.db.runAsync('UPDATE habits SET position = ? WHERE id = ?', [position, id]);
  }

  /**
   * Habits are archived (not deleted) so historical checks stay intact and can be
   * restored from a backup. Archived habits are hidden from the daily view.
   */
  async archive(id: number): Promise<void> {
    await this.db.runAsync('UPDATE habits SET archived = 1 WHERE id = ?', [id]);
  }

  async unarchive(id: number): Promise<void> {
    await this.db.runAsync('UPDATE habits SET archived = 0 WHERE id = ?', [id]);
  }

  /** Permanent removal. habit_checks rows go away via ON DELETE CASCADE. */
  async remove(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  }

  async checks(): Promise<HabitCheck[]> {
    const rows = await this.db.getAllAsync<{ habit_id: number; date: string; done: number }>(
      'SELECT habit_id, date, done FROM habit_checks'
    );
    return rows.map((r) => ({ habitId: r.habit_id, date: r.date, done: r.done === 1 }));
  }

  async setCheck(habitId: number, date: DayKey, done: boolean): Promise<void> {
    if (!isValidDayKey(date)) throw new Error('Некорректная дата');
    if (done) {
      await this.db.runAsync(
        'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1) ON CONFLICT(habit_id, date) DO UPDATE SET done = 1',
        [habitId, date]
      );
    } else {
      await this.db.runAsync('DELETE FROM habit_checks WHERE habit_id = ? AND date = ?', [habitId, date]);
    }
  }
}

export type SettingsSnapshot = {
  themeMode: 'system' | 'dark' | 'light';
  startWeightKg: number | null;
  targetWeightKg: number | null;
};

export class SettingsRepository {
  constructor(private db: SQLiteDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  async set(key: string, value: string | null): Promise<void> {
    if (value == null) {
      await this.db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
      return;
    }
    await this.db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }

  async all(): Promise<Record<string, string>> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async snapshot(): Promise<SettingsSnapshot> {
    const all = await this.all();
    const mode = all.themeMode;
    const num = (v: string | undefined) => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      themeMode: mode === 'dark' || mode === 'light' || mode === 'system' ? mode : 'system',
      startWeightKg: num(all.startWeightKg),
      targetWeightKg: num(all.targetWeightKg),
    };
  }
}

export type Repositories = {
  weight: WeightRepository;
  workouts: WorkoutRepository;
  nutrition: NutritionRepository;
  habits: HabitRepository;
  settings: SettingsRepository;
};

export function createRepositories(db: SQLiteDatabase): Repositories {
  return {
    weight: new WeightRepository(db),
    workouts: new WorkoutRepository(db),
    nutrition: new NutritionRepository(db),
    habits: new HabitRepository(db),
    settings: new SettingsRepository(db),
  };
}

/** Reads everything needed for export. */
export async function exportData(repos: Repositories, appVersion: string): Promise<BackupData & { appVersion: string }> {
  const [settings, weight, workouts, habits, checks, nutrition] = await Promise.all([
    repos.settings.snapshot(),
    repos.weight.list(),
    repos.workouts.list(),
    repos.habits.list(true),
    repos.habits.checks(),
    repos.nutrition.list(),
  ]);

  const habitIds = habits.map((h) => h.id);
  const indexOf = new Map(habitIds.map((id, i) => [id, i]));

  return {
    appVersion,
    settings: {
      themeMode: settings.themeMode,
      startWeightKg: settings.startWeightKg,
      targetWeightKg: settings.targetWeightKg,
      weightUnit: 'kg',
    },
    weight: weight.map((w) => ({
      date: w.date,
      weightKg: w.weightKg,
      note: w.note,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
    workouts: workouts.map((w) => ({
      date: w.date,
      title: w.title,
      muscles: w.muscles,
      durationMin: w.durationMin,
      note: w.note,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
    habits: habits.map((h) => ({
      title: h.title,
      emoji: h.emoji,
      position: h.position,
      archived: h.archived,
      createdAt: h.createdAt,
    })),
    habitChecks: checks
      .filter((c) => indexOf.has(c.habitId))
      .map((c) => ({ habitIndex: indexOf.get(c.habitId)!, date: c.date, done: c.done })),
    nutrition: nutrition.map((n) => ({
      date: n.date,
      planFollowed: n.planFollowed,
      note: n.note,
      updatedAt: n.updatedAt,
    })),
  };
}

/** Current counts for the import confirmation dialog. */
export async function currentCounts(repos: Repositories): Promise<{ weight: number; workouts: number }> {
  const [weight, workouts] = await Promise.all([repos.weight.count(), repos.workouts.count()]);
  return { weight, workouts };
}

/**
 * Applies a validated backup. `replace` wipes journal data (not settings) first.
 * Habits are matched by title so repeated imports don't duplicate them.
 */
export async function importData(
  db: SQLiteDatabase,
  repos: Repositories,
  backup: BackupData,
  mode: ImportMode
): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (mode === 'replace') {
      await db.execAsync(`
        DELETE FROM habit_checks;
        DELETE FROM workouts;
        DELETE FROM weight_entries;
        DELETE FROM nutrition_days;
        DELETE FROM habits;
      `);
    }

    // Weight
    for (const w of backup.weight) {
      await db.runAsync(
        `INSERT INTO weight_entries (date, weight_kg, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           weight_kg = excluded.weight_kg, note = excluded.note, updated_at = excluded.updated_at`,
        [w.date, w.weightKg, w.note, w.createdAt, w.updatedAt]
      );
    }

    // Nutrition
    for (const n of backup.nutrition) {
      if (n.planFollowed == null && !n.note) {
        await db.runAsync('DELETE FROM nutrition_days WHERE date = ?', [n.date]);
        continue;
      }
      await db.runAsync(
        `INSERT INTO nutrition_days (date, plan_followed, note, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           plan_followed = excluded.plan_followed, note = excluded.note, updated_at = excluded.updated_at`,
        [n.date, n.planFollowed == null ? null : n.planFollowed ? 1 : 0, n.note, n.updatedAt]
      );
    }

    // Workouts are append-only: each entry is a distinct training session.
    for (const w of backup.workouts) {
      const res = await db.runAsync(
        'INSERT INTO workouts (date, title, duration_min, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [w.date, w.title, w.durationMin, w.note, w.createdAt, w.updatedAt]
      );
      for (const muscle of normalizeMuscles(w.muscles)) {
        await db.runAsync('INSERT OR IGNORE INTO workout_muscles (workout_id, muscle) VALUES (?, ?)', [
          res.lastInsertRowId,
          muscle,
        ]);
      }
    }

    // Habits (match by exact title)
    const habitIdByIndex = new Map<number, number>();
    const existing = await repos.habits.list(true);
    for (const [index, h] of backup.habits.entries()) {
      const match = existing.find((e) => e.title === h.title);
      if (match) {
        habitIdByIndex.set(index, match.id);
        if (h.archived && !match.archived) await repos.habits.archive(match.id);
        continue;
      }
      if (h.archived) continue; // don't import empty archived placeholders
      const id = await repos.habits.create({ title: h.title, emoji: h.emoji, position: h.position });
      habitIdByIndex.set(index, id);
    }

    for (const c of backup.habitChecks) {
      const habitId = habitIdByIndex.get(c.habitIndex);
      if (habitId == null) continue;
      await db.runAsync(
        'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, ?) ON CONFLICT(habit_id, date) DO UPDATE SET done = excluded.done',
        [habitId, c.date, c.done ? 1 : 0]
      );
    }

    // Settings
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES ('themeMode', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [backup.settings.themeMode]
    );
    for (const [key, value] of [
      ['startWeightKg', backup.settings.startWeightKg],
      ['targetWeightKg', backup.settings.targetWeightKg],
    ] as const) {
      if (value == null) {
        await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
      } else {
        await db.runAsync(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [key, String(value)]
        );
      }
    }
  });
}

/** Deletes all journal data (used by Settings → erase). Settings are preserved. */
export async function eraseJournal(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM habit_checks;
      DELETE FROM workouts;
      DELETE FROM weight_entries;
      DELETE FROM nutrition_days;
      DELETE FROM habits;
    `);
  });
}

export function weekRange(today: DayKey): { from: DayKey; to: DayKey } {
  return { from: startOfWeek(today), to: endOfWeek(today) };
}
