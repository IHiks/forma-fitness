import type { SQLiteDatabase } from './sqlite';

export type Migration = {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
};

const now = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE weight_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          weight_kg REAL NOT NULL CHECK (weight_kg >= 20 AND weight_kg <= 400),
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (${now}),
          updated_at TEXT NOT NULL DEFAULT (${now})
        );
        CREATE INDEX idx_weight_date ON weight_entries(date);

        CREATE TABLE workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          title TEXT,
          duration_min INTEGER CHECK (duration_min IS NULL OR (duration_min > 0 AND duration_min <= 600)),
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (${now}),
          updated_at TEXT NOT NULL DEFAULT (${now})
        );
        CREATE INDEX idx_workouts_date ON workouts(date);

        CREATE TABLE workout_muscles (
          workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
          muscle TEXT NOT NULL,
          PRIMARY KEY (workout_id, muscle)
        );
        CREATE INDEX idx_workout_muscles_muscle ON workout_muscles(muscle);

        CREATE TABLE nutrition_days (
          date TEXT PRIMARY KEY NOT NULL,
          plan_followed INTEGER,
          note TEXT,
          updated_at TEXT NOT NULL DEFAULT (${now})
        );

        CREATE TABLE habits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          emoji TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (${now})
        );

        CREATE TABLE habit_checks (
          habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (habit_id, date)
        );
        CREATE INDEX idx_habit_checks_date ON habit_checks(date);

        PRAGMA user_version = 1;
      `);
    },
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await migration.up(db);
    });
    const check = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    current = check?.user_version ?? migration.version;
  }
  return current;
}

export async function configureDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
  `);
}
