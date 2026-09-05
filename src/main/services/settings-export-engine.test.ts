// Settings › Rendering default export engine (docs/export-engines-plan.md D2):
// ships as the catalogue default, round-trips a valid id, and falls back to
// the default for anything unknown a later build might leave behind.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => 'C:/tmp/settings-export-engine-test',
    isReady: () => true,
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (plain: string) => Buffer.from(plain, 'utf8'),
    decryptString: (buf: Buffer) => buf.toString('utf8'),
  },
}));

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
      if (sql.startsWith('INSERT')) return { run: (key: string, value: string) => rows.set(key, value) };
      if (sql.startsWith('DELETE')) return { run: (key: string) => rows.delete(key) };
      if (sql.startsWith('UPDATE')) {
        return { run: (value: string, key: string) => { if (rows.has(key)) rows.set(key, value); } };
      }
      if (sql.includes('WHERE key')) {
        return { get: (key: string) => (rows.has(key) ? { value: rows.get(key)! } : undefined) };
      }
      return { all: () => [...rows.entries()].map(([key, value]) => ({ key, value })) };
    }
  }
  return { default: FakeDatabase };
});

import { closeDb, setValue } from './settings-db';
import { getRenderDefaultExportEngine, loadSettings, setRenderDefaultExportEngine } from './settings';

afterEach(() => closeDb());

describe('renderDefaultExportEngine', () => {
  it('defaults to the Remotion path when nothing is saved', async () => {
    expect(await getRenderDefaultExportEngine()).toBe('remotion');
    expect((await loadSettings()).renderDefaultExportEngine).toBe('remotion');
  });

  it('round-trips a valid id', async () => {
    await setRenderDefaultExportEngine('remotion');
    expect(await getRenderDefaultExportEngine()).toBe('remotion');
  });

  it('falls back to the default for an unknown saved id', async () => {
    setValue('renderDefaultExportEngine', 'engine-from-the-future');
    expect(await getRenderDefaultExportEngine()).toBe('remotion');
    expect((await loadSettings()).renderDefaultExportEngine).toBe('remotion');
  });
});
