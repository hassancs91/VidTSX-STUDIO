import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, type AutosaveState } from './autosave';

interface Doc {
  rev: number;
}

type SaveResult = { success: boolean; error?: string };

/** A save whose outcomes are scripted in order; afterwards it succeeds. */
function scriptedSave(outcomes: Array<SaveResult | Error>) {
  const written: Doc[] = [];
  const calls: Doc[] = [];
  const save = vi.fn(async (doc: Doc): Promise<SaveResult> => {
    calls.push(doc);
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    if (next && !next.success) return next;
    written.push(doc);
    return { success: true };
  });
  return { save, written, calls };
}

function harness(outcomes: Array<SaveResult | Error>, persistentAfter = 3) {
  const s = scriptedSave(outcomes);
  const states: Array<{ state: AutosaveState; error?: string }> = [];
  const autosave = createAutosave<Doc>({
    save: s.save,
    onState: (state, error) => states.push({ state, error }),
    debounceMs: 600,
    retryDelaysMs: [1000, 2000, 5000],
    persistentAfter,
  });
  autosave.reset({ rev: 0 });
  const last = () => states[states.length - 1];
  return { ...s, autosave, states, last };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createAutosave (B5 Problem 5: a failed save is never forgotten)', () => {
  it('debounces edits into one save of the latest doc', async () => {
    const h = harness([]);
    h.autosave.update({ rev: 1 });
    h.autosave.update({ rev: 2 });
    expect(h.last().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(599);
    expect(h.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.written).toEqual([{ rev: 2 }]);
    expect(h.last().state).toBe('saved');
  });

  it('a failed save keeps the doc dirty: flush() (editor close) then writes the latest doc', async () => {
    const h = harness([{ success: false, error: 'EPERM: operation not permitted, rename' }]);
    h.autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.written).toEqual([]);
    expect(h.autosave.isDirty()).toBe(true);
    expect(h.last().state).toBe('pending'); // one failure: still retrying, not yet an error
    h.autosave.update({ rev: 2 });
    const ok = await h.autosave.flush();
    expect(ok).toBe(true);
    expect(h.written).toEqual([{ rev: 2 }]);
    expect(h.autosave.isDirty()).toBe(false);
    expect(h.last().state).toBe('saved');
  });

  it('a save that throws (IPC gone) is treated like a refused one', async () => {
    const h = harness([new Error('ipc closed')]);
    h.autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600);
    expect(h.autosave.isDirty()).toBe(true);
    await h.autosave.flush();
    expect(h.written).toEqual([{ rev: 1 }]);
  });

  it('reschedules on failure with no further edit, and recovers by itself', async () => {
    const h = harness([{ success: false, error: 'EPERM' }, { success: false, error: 'EPERM' }]);
    h.autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600); // fail 1
    await vi.advanceTimersByTimeAsync(1000); // retry → fail 2
    expect(h.save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(h.save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // retry → ok
    expect(h.written).toEqual([{ rev: 1 }]);
    expect(h.last().state).toBe('saved');
  });

  it('shows a persistent error after repeated failures, keeps retrying, clears on success', async () => {
    const fail = { success: false, error: 'EBUSY: resource busy or locked' };
    const h = harness([fail, fail, fail, fail, fail]);
    h.autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600); // 1
    await vi.advanceTimersByTimeAsync(1000); // 2
    expect(h.last().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(2000); // 3 → persistent
    expect(h.last()).toEqual({ state: 'error', error: 'EBUSY: resource busy or locked' });
    await vi.advanceTimersByTimeAsync(5000); // 4 (last delay repeats)
    await vi.advanceTimersByTimeAsync(5000); // 5
    expect(h.save).toHaveBeenCalledTimes(5);
    expect(h.last().state).toBe('error');
    await vi.advanceTimersByTimeAsync(5000); // 6 → ok
    expect(h.written).toEqual([{ rev: 1 }]);
    expect(h.last().state).toBe('saved');
  });

  it('an edit during an in-flight save is saved after it, and flush waits for both', async () => {
    let release: (r: SaveResult) => void = () => undefined;
    const written: Doc[] = [];
    const save = vi.fn(async (doc: Doc): Promise<SaveResult> => {
      if (save.mock.calls.length === 1) {
        const r = await new Promise<SaveResult>((resolve) => (release = resolve));
        if (r.success) written.push(doc);
        return r;
      }
      written.push(doc);
      return { success: true };
    });
    const autosave = createAutosave<Doc>({ save, onState: () => undefined, debounceMs: 600 });
    autosave.reset({ rev: 0 });
    autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600); // save(rev 1) in flight
    autosave.update({ rev: 2 });
    const flushed = autosave.flush();
    release({ success: false, error: 'EPERM' }); // the in-flight one fails
    expect(await flushed).toBe(true);
    expect(written).toEqual([{ rev: 2 }]);
    expect(autosave.isDirty()).toBe(false);
  });

  it('flush() with nothing dirty does not save; reset() (load/restore) forgets pending work', async () => {
    const h = harness([]);
    expect(await h.autosave.flush()).toBe(true);
    expect(h.save).not.toHaveBeenCalled();
    h.autosave.update({ rev: 1 });
    h.autosave.reset({ rev: 9 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.last().state).toBe('saved');
  });

  it('dispose() stops retries', async () => {
    const h = harness([{ success: false, error: 'EPERM' }]);
    h.autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600);
    h.autosave.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.save).toHaveBeenCalledTimes(1);
  });
});

describe('takeUnsaved — handing the document to an owner that outlives the editor (B5 fix round 1)', () => {
  it('returns the latest dirty document, clears dirty and cancels the debounce', async () => {
    const h = harness([]);
    h.autosave.update({ rev: 1 });
    h.autosave.update({ rev: 2 });
    expect(h.autosave.takeUnsaved()).toEqual({ rev: 2 });
    expect(h.autosave.isDirty()).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.save).not.toHaveBeenCalled();
  });

  it('returns null when everything is on disk', async () => {
    const h = harness([]);
    expect(h.autosave.takeUnsaved()).toBeNull();
    h.autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(700);
    expect(h.written).toEqual([{ rev: 1 }]);
    expect(h.autosave.takeUnsaved()).toBeNull();
  });

  it('takes a document whose save is still in flight, and a failure of that save no longer retries', async () => {
    let release: (r: SaveResult) => void = () => {};
    const save = vi.fn(
      () =>
        new Promise<SaveResult>((resolve) => {
          release = resolve;
        }),
    );
    const autosave = createAutosave<Doc>({ save, onState: () => {}, debounceMs: 600 });
    autosave.reset({ rev: 0 });
    autosave.update({ rev: 1 });
    await vi.advanceTimersByTimeAsync(600); // the save of rev 1 is in flight
    expect(autosave.isDirty()).toBe(false);
    expect(autosave.takeUnsaved()).toEqual({ rev: 1 });
    release({ success: false, error: 'EPERM' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.isDirty()).toBe(false);
  });

  it('a later edit makes the autosave the owner again (retries resume)', async () => {
    const h = harness([{ success: false, error: 'EPERM' }]);
    h.autosave.update({ rev: 1 });
    h.autosave.takeUnsaved();
    h.autosave.update({ rev: 2 });
    await vi.advanceTimersByTimeAsync(600); // refused
    await vi.advanceTimersByTimeAsync(1000); // retried
    expect(h.written).toEqual([{ rev: 2 }]);
  });
});
