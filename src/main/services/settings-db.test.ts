// safeStorage-at-rest contract for the settings DB (PLAN.md / Q4):
// sensitive keys are encrypted when the OS keystore is available, legacy
// plaintext rows stay readable, and migrateSensitiveSettings() re-encrypts
// them in place. Non-sensitive keys are never touched by the crypto path.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const crypto = vi.hoisted(() => ({
  available: true,
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => 'C:/tmp/settings-db-test',
    isReady: () => true,
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => crypto.available,
    // Reversible stand-in for DPAPI: prefix + base64, so a wrong-profile
    // "decrypt" of garbage still throws like the real thing.
    encryptString: (plain: string) => Buffer.from(`sealed:${plain}`, 'utf8'),
    decryptString: (buf: Buffer) => {
      const s = buf.toString('utf8');
      if (!s.startsWith('sealed:')) throw new Error('bad ciphertext');
      return s.slice('sealed:'.length);
    },
  },
}));

// better-sqlite3 in node_modules is compiled against Electron's ABI and
// cannot load under plain-node vitest. The service only uses four statement
// shapes — an in-memory Map covers them; the logic under test is the crypto
// envelope, not SQLite.
vi.mock('better-sqlite3', () => {
  class FakeDatabase {
    rows = new Map<string, string>();
    pragma(): void {}
    exec(): void {}
    close(): void {}
    transaction<T>(fn: (arg: T) => void) {
      return (arg: T) => fn(arg);
    }
    prepare(sql: string) {
      const rows = this.rows;
      if (sql.startsWith('INSERT')) {
        return { run: (key: string, value: string) => rows.set(key, value) };
      }
      if (sql.startsWith('DELETE')) {
        return { run: (key: string) => rows.delete(key) };
      }
      if (sql.startsWith('UPDATE')) {
        return {
          run: (value: string, key: string) => {
            if (rows.has(key)) rows.set(key, value);
          },
        };
      }
      if (sql.includes('WHERE key')) {
        return {
          get: (key: string) => (rows.has(key) ? { value: rows.get(key)! } : undefined),
        };
      }
      return {
        all: () => [...rows.entries()].map(([key, value]) => ({ key, value })),
      };
    }
  }
  return { default: FakeDatabase };
});

import { closeDb, getAllValues, getDb, getValue, migrateSensitiveSettings, setValue, setValues } from './settings-db';

const CREDS = { openrouter: 'sk-or-test', assemblyai: 'aai-test' };

/** Raw stored text for a key, bypassing the decode path. */
function rawValue(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

beforeEach(() => {
  crypto.available = true;
});

afterEach(() => {
  // Drop the memoized fake DB so each test starts with an empty store.
  closeDb();
});

describe('settings-db encryption at rest', () => {
  it('stores sensitive keys encrypted and round-trips them', () => {
    setValue('providerCredentials', CREDS);
    const stored = rawValue('providerCredentials')!;
    expect(stored).toContain('enc.v1:');
    expect(stored).not.toContain('sk-or-test');
    expect(getValue('providerCredentials')).toEqual(CREDS);
  });

  it('setValues (the multi-key path) also encrypts sensitive keys', () => {
    setValues({ llmProviders: [{ id: 'kimi', apiKey: 'sk-kimi' }], whisperModel: 'base' });
    expect(rawValue('llmProviders')).not.toContain('sk-kimi');
    expect(rawValue('whisperModel')).toBe('"base"');
    expect(getValue('llmProviders')).toEqual([{ id: 'kimi', apiKey: 'sk-kimi' }]);
  });

  it('leaves non-sensitive keys in plaintext JSON', () => {
    setValue('outputFolder', 'C:/videos');
    expect(rawValue('outputFolder')).toBe('"C:/videos"');
  });

  it('reads legacy plaintext rows for sensitive keys (transparent migration)', () => {
    getDb()
      .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)')
      .run('providerCredentials', JSON.stringify(CREDS));
    expect(getValue('providerCredentials')).toEqual(CREDS);
    expect(getAllValues().providerCredentials).toEqual(CREDS);
  });

  it('migrateSensitiveSettings encrypts legacy plaintext rows in place', () => {
    getDb()
      .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)')
      .run('providerCredentials', JSON.stringify(CREDS));
    migrateSensitiveSettings();
    expect(rawValue('providerCredentials')).toContain('enc.v1:');
    expect(getValue('providerCredentials')).toEqual(CREDS);
    // Idempotent: a second run leaves the row byte-identical.
    const once = rawValue('providerCredentials');
    migrateSensitiveSettings();
    expect(rawValue('providerCredentials')).toBe(once);
  });

  it('falls back to plaintext when the keystore is unavailable (never loses data)', () => {
    crypto.available = false;
    setValue('providerCredentials', CREDS);
    expect(rawValue('providerCredentials')).toContain('sk-or-test');
    expect(getValue('providerCredentials')).toEqual(CREDS);
    migrateSensitiveSettings(); // no-op, no throw
    expect(rawValue('providerCredentials')).toContain('sk-or-test');
  });

  it('an undecryptable row reads as unset, not as garbage', () => {
    setValue('providerCredentials', CREDS);
    // Simulate a DB copied to another OS user: ciphertext no longer decrypts.
    getDb()
      .prepare('UPDATE app_settings SET value = ? WHERE key = ?')
      .run(JSON.stringify('enc.v1:' + Buffer.from('not-sealed').toString('base64')), 'providerCredentials');
    expect(getValue('providerCredentials')).toBeUndefined();
    expect('providerCredentials' in getAllValues()).toBe(false);
  });

  it('getAllValues decrypts sensitive keys alongside plaintext ones', () => {
    setValue('providerCredentials', CREDS);
    setValue('whisperModel', 'base');
    const all = getAllValues();
    expect(all.providerCredentials).toEqual(CREDS);
    expect(all.whisperModel).toBe('base');
  });
});
