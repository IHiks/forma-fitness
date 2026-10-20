// Minimal subset of expo-sqlite's SQLiteDatabase used by repositories.
// Keeping the repository on this interface lets the same code run against sql.js in
// Node tests (expo-sqlite's native module cannot load there).
export type SQLParam = string | number | null | boolean;

export interface SQLiteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SQLParam[] | Record<string, SQLParam>): Promise<{
    lastInsertRowId: number;
    changes: number;
  }>;
  getAllAsync<T>(source: string, params?: SQLParam[] | Record<string, SQLParam>): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: SQLParam[] | Record<string, SQLParam>): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

type Pending = { sql: string; params: SQLParam[] };

type SqlJsStatement = {
  bind(params: unknown[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): boolean;
};

type SqlJsRawDatabase = {
  run(sql: string, params?: unknown[]): void;
  prepare(sql: string): SqlJsStatement;
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
};

/** In-process SQLite (sql.js/WASM) adapter. Test-only. */
export class SqlJsDatabase implements SQLiteDatabase {
  constructor(private db: SqlJsRawDatabase) {}

  async execAsync(source: string): Promise<void> {
    this.db.run(source);
  }

  private toParams(params?: SQLParam[] | Record<string, SQLParam>): unknown[] {
    if (!params) return [];
    if (Array.isArray(params)) return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
    return Object.values(params).map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
  }

  private namedToPositional(source: string, params?: SQLParam[] | Record<string, SQLParam>): [string, unknown[]] {
    if (!params || Array.isArray(params)) return [source, this.toParams(params)];
    const order: unknown[] = [];
    const sql = source.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
      order.push(params[name] === undefined ? null : this.toParams([params[name] as SQLParam])[0]);
      return '?';
    });
    return [sql, order];
  }

  async runAsync(source: string, params?: SQLParam[] | Record<string, SQLParam>) {
    const [sql, values] = this.namedToPositional(source, params);
    this.db.run(sql, values);
    // sql.js statements must be stepped before reading values.
    const stmt = this.db.prepare('SELECT last_insert_rowid() AS id');
    try {
      stmt.step();
      const row = stmt.getAsObject() as { id: number };
      return { lastInsertRowId: Number(row?.id ?? 0), changes: this.db.getRowsModified() };
    } finally {
      stmt.free();
    }
  }

  async getAllAsync<T>(source: string, params?: SQLParam[] | Record<string, SQLParam>): Promise<T[]> {
    const [sql, values] = this.namedToPositional(source, params);
    const stmt = this.db.prepare(sql);
    stmt.bind(values);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  async getFirstAsync<T>(source: string, params?: SQLParam[] | Record<string, SQLParam>): Promise<T | null> {
    const rows = await this.getAllAsync<T>(source, params);
    return rows[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.run('BEGIN');
    try {
      await task();
      this.db.run('COMMIT');
    } catch (e) {
      try {
        this.db.run('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw e;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

/** Sequential queue for expo-sqlite's exclusive mode. */
export class SerialQueue {
  private pending: Promise<void> = Promise.resolve();
  private queueSize = 0;

  get size() {
    return this.queueSize;
  }

  enqueue(task: () => Promise<void>): void {
    this.queueSize += 1;
    this.pending = this.pending
      .then(task)
      .catch(() => undefined)
      .finally(() => {
        this.queueSize -= 1;
      });
  }

  async idle(): Promise<void> {
    await this.pending;
  }
}

export type { Pending };
