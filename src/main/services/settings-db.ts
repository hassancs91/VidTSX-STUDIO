import Database from 'better-sqlite3';
import { app, safeStorage } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('settings-db');

let db: Database.Database | null = null;

/**
 * Settings whose values carry API keys — encrypted at rest via the OS
 * keystore (DPAPI on Windows) when available (PLAN.md safeStorage / Q4).
 * Encryption is per-OS-user: a settings.db copied to another machine or
 * Windows profile loses these values (they read back as unset, never as
 * garbage). Plaintext rows from older installs stay readable and are
 * re-encrypted by migrateSensitiveSettings() at startup.
 */
const ENCRYPTED_KEYS = new Set([
  'providerCredentials',
  'llmProviders',
  'imageProviders',
  'sttProviders',
]);

/** Stored shape of an encrypted value: a JSON string "enc.v1:<base64>". */
const ENC_PREFIX = 'enc.v1:';

function encryptionAvailable(): boolean {
  try {
    // safeStorage must not be touched before app ready on some platforms.
    return app.isReady() && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/** JSON-encode a value for storage, encrypting sensitive keys when possible. */
function encodeValue(key: string, value: unknown): string {
  const json = JSON.stringify(value);
  if (!ENCRYPTED_KEYS.has(key) || !encryptionAvailable()) return json;
  try {
    const cipher = safeStorage.encryptString(json).toString('base64');
    return JSON.stringify(ENC_PREFIX + cipher);
  } catch (err) {
    // Never lose the value over a keystore hiccup — store plaintext, as before.
    log.warn(`Encrypting setting "${key}" failed — storing plaintext`, {
      err: err instanceof Error ? err.message : String(err),
    });
    return json;
  }
}

/** Undo encodeValue on an already-JSON-parsed value. */
function decodeParsed(key: string, parsed: unknown): unknown {
  if (!ENCRYPTED_KEYS.has(key)) return parsed;
  if (typeof parsed !== 'string' || !parsed.startsWith(ENC_PREFIX)) return parsed;
  try {
    const plain = safeStorage.decryptString(
      Buffer.from(parsed.slice(ENC_PREFIX.length), 'base64'),
    );
    return JSON.parse(plain) as unknown;
  } catch (err) {
    log.warn(`Failed to decrypt setting "${key}" — treating as unset`, {
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

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
    return decodeParsed(key, JSON.parse(row.value)) as T;
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
      const value = decodeParsed(row.key, JSON.parse(row.value));
      if (value !== undefined) out[row.key] = value;
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
    .run(key, encodeValue(key, value));
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
      else upsert.run(k, encodeValue(k, v));
    }
  });
  txn(entries);
}

/**
 * One-time, idempotent startup migration: re-save any sensitive setting that
 * is still stored in plaintext so it lands encrypted. No-op when the OS
 * keystore is unavailable or every row is already encrypted. Call after app
 * ready (safeStorage requirement).
 */
export function migrateSensitiveSettings(): void {
  if (!encryptionAvailable()) return;
  const database = getDb();
  let migrated = 0;
  for (const key of ENCRYPTED_KEYS) {
    const row = database
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(key) as { value: string } | undefined;
    if (!row) continue;
    try {
      const parsed = JSON.parse(row.value) as unknown;
      const alreadyEncrypted = typeof parsed === 'string' && parsed.startsWith(ENC_PREFIX);
      if (alreadyEncrypted || parsed === undefined) continue;
      setValue(key, parsed);
      migrated += 1;
    } catch {
      // Malformed row — leave it; getValue treats it as unset anyway.
    }
  }
  if (migrated > 0) {
    // The overwritten plaintext can linger in freed pages and the WAL;
    // checkpoint + VACUUM rebuilds the file so it's actually gone from disk.
    try {
      database.pragma('wal_checkpoint(TRUNCATE)');
      database.exec('VACUUM');
    } catch (err) {
      log.warn('Post-migration VACUUM failed (non-fatal)', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    log.info('Encrypted plaintext sensitive settings at rest', { migrated });
  }
}
