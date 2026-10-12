// Settings › default GPU backend (TSX Builder P2 part 2, Hasan's option c):
// ships as 'auto' (the probed backend, resolved in main at render time), keeps
// an explicit pick, and falls back to 'auto' for anything unknown.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => 'C:/tmp/settings-gpu-backend-test',
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
import { getRenderDefaultGpuBackend, loadSettings, setRenderDefaultGpuBackend } from './settings';

afterEach(() => closeDb());

describe('renderDefaultGpuBackend', () => {
  it("defaults to 'auto' when nothing is saved", async () => {
    expect(await getRenderDefaultGpuBackend()).toBe('auto');
    expect((await loadSettings()).renderDefaultGpuBackend).toBe('auto');
  });

  it('keeps an explicit pick, software included', async () => {
    await setRenderDefaultGpuBackend('swangle');
    expect(await getRenderDefaultGpuBackend()).toBe('swangle');
    await setRenderDefaultGpuBackend('angle');
    expect(await getRenderDefaultGpuBackend()).toBe('angle');
  });

  it("falls back to 'auto' for an unknown saved value", async () => {
    setValue('renderDefaultGpuBackend', 'metal');
    expect(await getRenderDefaultGpuBackend()).toBe('auto');
  });
});
