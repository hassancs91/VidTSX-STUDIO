// The run.json write survives a Windows EPERM on rename (a reader holding
// the file) — W8 Stage 6 found two acceptance runs crashing on it.

import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.1.0' },
}));

import { renameWithRetry } from './flow-run-store';

function eperm(): NodeJS.ErrnoException {
  const err = new Error('EPERM: operation not permitted') as NodeJS.ErrnoException;
  err.code = 'EPERM';
  return err;
}

describe('renameWithRetry', () => {
  it('retries a transient EPERM and succeeds', async () => {
    let calls = 0;
    const rename = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw eperm();
    });
    await renameWithRetry('a.tmp', 'a', 5, rename);
    expect(calls).toBe(3);
  });

  it('gives up after the attempts, and never retries another error', async () => {
    const always = vi.fn(async () => {
      throw eperm();
    });
    await expect(renameWithRetry('a.tmp', 'a', 3, always)).rejects.toThrow(/EPERM/);
    expect(always).toHaveBeenCalledTimes(3);

    const enoent = vi.fn(async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });
    await expect(renameWithRetry('a.tmp', 'a', 3, enoent)).rejects.toThrow(/ENOENT/);
    expect(enoent).toHaveBeenCalledTimes(1);
  });
});
