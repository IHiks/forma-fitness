// In-memory SQLite for logic tests (expo-sqlite's native module cannot run in Node).
import initSqlJs, { type Database } from 'sql.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { configureDatabase, runMigrations } from '@/db/migrations';
import { createRepositories, type Repositories } from '@/db/repositories';
import { SqlJsDatabase } from '@/db/sqlite';

let cachedSql: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function loadSql() {
  if (cachedSql) return cachedSql;
  // Locate the wasm next to sql.js's dist build so it works regardless of cwd.
  const sqlJsDir = path.dirname(require.resolve('sql.js'));
  cachedSql = await initSqlJs({
    locateFile: (file: string) => {
      const candidate = path.join(sqlJsDir, file);
      return fs.existsSync(candidate) ? candidate : path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
    },
  });
  return cachedSql;
}

export type TestDb = {
  db: SqlJsDatabase;
  raw: Database;
  repos: Repositories;
};

/** Fresh migrated database. */
export async function createTestDb(): Promise<TestDb> {
  const SQL = await loadSql();
  const raw = new SQL.Database();
  // sql.js's `run` is return-typed as `Database`; the adapter only needs the
  // structural subset declared in SqlJsRawDatabase.
  const db = new SqlJsDatabase(raw as unknown as ConstructorParameters<typeof SqlJsDatabase>[0]);
  await configureDatabase(db);
  await runMigrations(db);
  return { db, raw, repos: createRepositories(db) };
}

/** Serializes the database and reopens it — simulates an app restart. */
export async function reopenTestDb(previous: TestDb): Promise<TestDb> {
  const bytes = previous.raw.export();
  await previous.db.closeAsync();
  const SQL = await loadSql();
  const raw = new SQL.Database(bytes);
  const db = new SqlJsDatabase(raw as unknown as ConstructorParameters<typeof SqlJsDatabase>[0]);
  await configureDatabase(db);
  await runMigrations(db);
  return { db, raw, repos: createRepositories(db) };
}

/** Builds a WeightEntry-like object without touching the DB. */
export function weightEntry(
  date: string,
  weightKg: number,
  overrides: Partial<{ id: number; note: string | null; createdAt: string; updatedAt: string }> = {}
) {
  return {
    id: overrides.id ?? 0,
    date,
    weightKg,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? `${date}T08:00:00.000Z`,
    updatedAt: overrides.updatedAt ?? `${date}T08:00:00.000Z`,
  };
}
