import * as SQLite from 'expo-sqlite';

import { configureDatabase, runMigrations } from './migrations';
import type { SQLiteDatabase } from './sqlite';

export const DATABASE_NAME = 'forma.db';

export async function openAppDatabase(): Promise<{ db: SQLiteDatabase; raw: SQLite.SQLiteDatabase }> {
  const raw = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await configureDatabase(raw as unknown as SQLiteDatabase);
  await runMigrations(raw as unknown as SQLiteDatabase);
  return { db: raw as unknown as SQLiteDatabase, raw };
}

/** Deletes the database file (used only by tests/debug tooling; not exposed in the UI). */
export async function deleteAppDatabase(): Promise<void> {
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}
