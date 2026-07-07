import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('settings-db');

let db: Database.Database | null = null;

export function getSettingsDir(): string {
  return path.join(app.getPath('userData'), 'settings');
}

function getDbPath(): string {
  return path.join(getSettingsDir(), 'settings.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getSettingsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close settings DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

/**
 * Read one setting. Values are always JSON-encoded — callers get back the
 * decoded value (string/number/boolean/array/object) or `undefined` if the
 * key is missing or the stored JSON is malformed.
 */
export function getValue<T>(key: string): T | undefined {
  const database = getDb();
  const row = database
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key) as { value: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

/** Read every key/value pair as a record. */
export function getAllValues(): Record<string, unknown> {
  const database = getDb();
  const rows = database
    .prepare('SELECT key, value FROM app_settings')
    .all() as { key: string; value: string }[];
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      // skip malformed entries
    }
  }
  return out;
}

/** Upsert one value. Passing `undefined` deletes the key. */
export function setValue(key: string, value: unknown): void {
  const database = getDb();
  if (value === undefined) {
    database.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
    return;
  }
  database
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, JSON.stringify(value));
}

/** Upsert multiple values atomically. */
export function setValues(entries: Record<string, unknown>): void {
  const database = getDb();
  const upsert = database.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const remove = database.prepare('DELETE FROM app_settings WHERE key = ?');
  const txn = database.transaction((obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) remove.run(k);
      else upsert.run(k, JSON.stringify(v));
    }
  });
  txn(entries);
}
