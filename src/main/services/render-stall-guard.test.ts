// A render that can never end (end-to-end A5 step 0.1): Remotion's pre-encode
// ffmpeg died mid-render in A4, its errors were unhandled rejections and
// renderMedia() never settled. The guard turns "no new frame for N minutes"
// into a cancel + a failed job that says where it stopped.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RenderStalledError,
  createStallGuard,
  stallAfterMsFor,
  STALL_CHECK_EVERY_MS,
  STALL_SETTLE_GRACE_MS,
} from './render-stall-guard';

const MIN = 60_000;

// A fake renderMedia: resolves/rejects only when told, and rejects like
// Remotion's own cancel when `cancel` is called (unless `ignoresCancel`).
function fakeRender(ignoresCancel = false) {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const cancel = vi.fn(() => {
    if (!ignoresCancel) reject(new Error('renderMedia() got cancelled'));
  });
  return { promise, resolve, reject, cancel };
}

describe('stallAfterMsFor', () => {
  it('waits the per-frame timeout plus two minutes, never under five minutes', () => {
    expect(stallAfterMsFor(600_000)).toBe(12 * MIN);
    expect(stallAfterMsFor(30_000)).toBe(5 * MIN);
    expect(stallAfterMsFor(240_000)).toBe(6 * MIN);
  });

  it('tolerates the slowest first 4K frame measured (~67 s before frame 1)', () => {
    expect(stallAfterMsFor(30_000)).toBeGreaterThan(67_000 * 4);
  });
});

describe('createStallGuard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('passes a normal render through, however long, while frames keep arriving', async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel });
    const run = guard.run(() => r.promise);
    for (let frame = 1; frame <= 30; frame++) {
      await vi.advanceTimersByTimeAsync(2 * MIN);
      guard.noteProgress({ renderedFrames: frame, encodedFrames: frame - 1 });
    }
    r.resolve();
    await expect(run).resolves.toBeUndefined();
    expect(r.cancel).not.toHaveBeenCalled();
  });

  it('lets a slow first frame through when it lands before the threshold', async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel });
    const run = guard.run(() => r.promise);
    await vi.advanceTimersByTimeAsync(4 * MIN + 50_000);
    guard.noteProgress({ renderedFrames: 1, encodedFrames: 0 });
    await vi.advanceTimersByTimeAsync(4 * MIN);
    r.resolve();
    await expect(run).resolves.toBeUndefined();
    expect(r.cancel).not.toHaveBeenCalled();
  });

  it('a dead encoder (frames stop at 66, renderMedia never settles) → cancel + RenderStalledError', async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 12 * MIN, cancel: r.cancel, totalFrames: 1800 });
    const run = guard.run(() => r.promise);
    const settled = run.catch((err: unknown) => err);
    for (let frame = 1; frame <= 66; frame++) {
      await vi.advanceTimersByTimeAsync(1_000);
      guard.noteProgress({ renderedFrames: frame, encodedFrames: frame - 2 });
    }
    await vi.advanceTimersByTimeAsync(12 * MIN - STALL_CHECK_EVERY_MS);
    expect(r.cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2 * STALL_CHECK_EVERY_MS);
    expect(r.cancel).toHaveBeenCalledTimes(1);
    const err = await settled;
    expect(err).toBeInstanceOf(RenderStalledError);
    const stalled = err as RenderStalledError;
    expect(stalled.frame).toBe(66);
    expect(stalled.message).toMatch(/^Render stalled at frame 66 of 1800: no new frame for 12 min/);
    // The job layer maps any message containing "cancel" to a user cancel.
    expect(stalled.message.toLowerCase()).not.toContain('cancel');
  });

  it('counts encoder progress and stage changes as activity, not only rendered frames', async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel });
    const run = guard.run(() => r.promise);
    guard.noteProgress({ renderedFrames: 300, encodedFrames: 100 });
    for (let encoded = 101; encoded <= 110; encoded++) {
      await vi.advanceTimersByTimeAsync(4 * MIN);
      guard.noteProgress({ renderedFrames: 300, encodedFrames: encoded });
    }
    await vi.advanceTimersByTimeAsync(4 * MIN);
    guard.noteProgress({ renderedFrames: 300, encodedFrames: 110, stitchStage: 'muxing' });
    await vi.advanceTimersByTimeAsync(4 * MIN);
    r.resolve();
    await expect(run).resolves.toBeUndefined();
    expect(r.cancel).not.toHaveBeenCalled();
  });

  it('a repeated identical progress tick is not activity', async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel });
    const settled = guard.run(() => r.promise).catch((err: unknown) => err);
    guard.noteProgress({ renderedFrames: 10, encodedFrames: 9 });
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(MIN);
      guard.noteProgress({ renderedFrames: 10, encodedFrames: 9 });
    }
    expect(await settled).toBeInstanceOf(RenderStalledError);
  });

  it('a stall before the first frame says so', async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel, totalFrames: 300 });
    const settled = guard.run(() => r.promise).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(5 * MIN + STALL_CHECK_EVERY_MS);
    const err = (await settled) as RenderStalledError;
    expect(err.frame).toBe(0);
    expect(err.message).toMatch(/^Render stalled before the first frame \(0 of 300\)/);
  });

  it('still ends the job when renderMedia ignores the cancel too (after the settle grace)', async () => {
    const r = fakeRender(true);
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel });
    let outcome: unknown = 'pending';
    void guard.run(() => r.promise).catch((err: unknown) => {
      outcome = err;
    });
    await vi.advanceTimersByTimeAsync(5 * MIN + STALL_CHECK_EVERY_MS);
    expect(r.cancel).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(STALL_SETTLE_GRACE_MS);
    expect(outcome).toBeInstanceOf(RenderStalledError);
    // A late rejection from the abandoned render is handled (no unhandled rejection).
    r.reject(new Error('FFmpeg quit with code 1 while piping frame 66'));
    await vi.advanceTimersByTimeAsync(0);
  });

  it('waits for the cancelled render to settle before failing (so its temp is released first)', async () => {
    let rejectLater!: (err: Error) => void;
    const promise = new Promise<void>((_res, rej) => {
      rejectLater = rej;
    });
    const cancel = vi.fn(() => setTimeout(() => rejectLater(new Error('renderMedia() got cancelled')), 2_000));
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel });
    let outcome: unknown = 'pending';
    void guard.run(() => promise).catch((err: unknown) => {
      outcome = err;
    });
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(outcome).toBeInstanceOf(RenderStalledError);
  });

  it("passes a render's own error through untouched and stops watching", async () => {
    const r = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: r.cancel });
    const run = guard.run(() => r.promise);
    r.reject(new Error('Timeout exceeded rendering the component'));
    await expect(run).rejects.toThrow('Timeout exceeded rendering the component');
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(r.cancel).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a second run (the starvation retry) starts its clock fresh', async () => {
    const first = fakeRender();
    const guard = createStallGuard({ stallAfterMs: 5 * MIN, cancel: first.cancel });
    const run1 = guard.run(() => first.promise);
    await vi.advanceTimersByTimeAsync(4 * MIN);
    first.reject(new Error('No frame found at position 12'));
    await expect(run1).rejects.toThrow('No frame found');
    const second = fakeRender();
    const run2 = guard.run(() => second.promise);
    await vi.advanceTimersByTimeAsync(4 * MIN);
    second.resolve();
    await expect(run2).resolves.toBeUndefined();
    expect(first.cancel).not.toHaveBeenCalled();
  });
});
