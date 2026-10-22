import { describe, expect, it, vi } from 'vitest';
import { renameWithRetry } from './rename-retry';

function errno(code: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(`${code}: operation not permitted, rename 'a.tmp' -> 'a'`);
  err.code = code;
  return err;
}

describe('renameWithRetry (B5 Problem 5)', () => {
  it('retries a rename that fails twice with EPERM, then succeeds', async () => {
    const rename = vi
      .fn<(from: string, to: string) => Promise<void>>()
      .mockRejectedValueOnce(errno('EPERM'))
      .mockRejectedValueOnce(errno('EBUSY'))
      .mockResolvedValueOnce(undefined);
    await renameWithRetry('a.tmp', 'a', { renameImpl: rename, baseDelayMs: 1 });
    expect(rename).toHaveBeenCalledTimes(3);
    expect(rename).toHaveBeenLastCalledWith('a.tmp', 'a');
  });

  it('retries EACCES too', async () => {
    const rename = vi
      .fn<(from: string, to: string) => Promise<void>>()
      .mockRejectedValueOnce(errno('EACCES'))
      .mockResolvedValueOnce(undefined);
    await renameWithRetry('a.tmp', 'a', { renameImpl: rename, baseDelayMs: 1 });
    expect(rename).toHaveBeenCalledTimes(2);
  });

  it('still rejects when every attempt is refused', async () => {
    const rename = vi.fn<(from: string, to: string) => Promise<void>>().mockRejectedValue(errno('EPERM'));
    await expect(renameWithRetry('a.tmp', 'a', { renameImpl: rename, attempts: 4, baseDelayMs: 1 })).rejects.toThrow(
      /EPERM/,
    );
    expect(rename).toHaveBeenCalledTimes(4);
  });

  it('does not retry an error a wait cannot fix (ENOENT)', async () => {
    const rename = vi.fn<(from: string, to: string) => Promise<void>>().mockRejectedValue(errno('ENOENT'));
    await expect(renameWithRetry('a.tmp', 'a', { renameImpl: rename, baseDelayMs: 1 })).rejects.toThrow(/ENOENT/);
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it('backs off: the waits grow with each attempt', async () => {
    vi.useFakeTimers();
    try {
      const calls: number[] = [];
      const rename = vi.fn(async () => {
        calls.push(Date.now());
        if (calls.length < 3) throw errno('EPERM');
      });
      const done = renameWithRetry('a.tmp', 'a', { renameImpl: rename, baseDelayMs: 50 });
      await vi.runAllTimersAsync();
      await done;
      expect(calls).toHaveLength(3);
      expect(calls[1] - calls[0]).toBe(50);
      expect(calls[2] - calls[1]).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });
});
