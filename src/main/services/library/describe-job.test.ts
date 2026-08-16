import { describe, expect, it, vi } from 'vitest';
import type { LibraryDescribeJobEvent } from '../../../shared/ipc/types/library';
import { LibraryDescribeJobEngine, type DescribeJobDeps } from './describe-job';
import { resolveDescribeAvailability } from './describe-availability';
import { cleanDescription, isDescribable, mediaTypeFor } from './describe-asset';

const ROOT = '/lib';

/** Collect the event stream and resolve when the batch reaches a terminal state. */
function runBatch(
  deps: Partial<DescribeJobDeps>,
  relPaths: string[],
): { engine: LibraryDescribeJobEngine; events: LibraryDescribeJobEvent[]; finished: Promise<void> } {
  const engine = new LibraryDescribeJobEngine({
    describable: (p) => p.endsWith('.png'),
    describe: async (_root, relPath) => ({ description: `desc for ${relPath}` }),
    ...deps,
  });
  const events: LibraryDescribeJobEvent[] = [];
  let resolve!: () => void;
  const finished = new Promise<void>((r) => (resolve = r));
  engine.onEvent((event) => {
    events.push(event);
    if (event.status === 'batch-done' || event.status === 'batch-canceled') resolve();
  });
  engine.start(ROOT, relPaths);
  return { engine, events, finished };
}

describe('describe-asset helpers', () => {
  it('treats only vision-carryable image formats as describable', () => {
    expect(isDescribable('logos/a.png')).toBe(true);
    expect(isDescribable('logos/a.JPG')).toBe(true);
    expect(isDescribable('a.webp')).toBe(true);
    expect(isDescribable('footage/clip.mp4')).toBe(false);
    expect(isDescribable('notes.txt')).toBe(false);
    expect(isDescribable('noext')).toBe(false);
  });

  it('maps extensions to attachment media types', () => {
    expect(mediaTypeFor('a.jpeg')).toBe('image/jpeg');
    expect(mediaTypeFor('a.PNG')).toBe('image/png');
    expect(mediaTypeFor('a.mp4')).toBeUndefined();
  });

  it('cleans a model reply down to one bare line', () => {
    expect(cleanDescription('  "primary logo, white on transparent"  ')).toBe(
      'primary logo, white on transparent',
    );
    expect(cleanDescription('- a bullet reply')).toBe('a bullet reply');
    expect(cleanDescription('\n\nfirst line\nsecond line')).toBe('first line');
    expect(cleanDescription('“smart quoted”')).toBe('smart quoted');
  });
});

describe('describe availability (L2 Rev 3 — no provider degrades, never breaks)', () => {
  it('reports no-provider when nothing is configured', () => {
    const result = resolveDescribeAvailability({ providers: [] });
    expect(result).toEqual({
      available: false,
      reason: 'no-provider',
      message: 'No AI provider is configured.',
    });
  });

  it('reports no-default when providers exist but none is active', () => {
    const result = resolveDescribeAvailability({
      providers: [{ id: 'anthropic', authMode: 'api-key', apiKey: 'k' }],
    });
    expect(result.available).toBe(false);
    expect(result.available === false && result.reason).toBe('no-default');
  });

  it('reports no-key for an api-key provider configured in name only', () => {
    const result = resolveDescribeAvailability({
      providers: [{ id: 'anthropic', name: 'Anthropic', authMode: 'api-key' }],
      activeProvider: 'anthropic',
    });
    expect(result.available === false && result.reason).toBe('no-key');
    expect(result.available === false && result.message).toContain('Anthropic');
  });

  it('accepts a subscription provider with no key, and a keyed api-key provider', () => {
    expect(
      resolveDescribeAvailability({
        providers: [{ id: 'agent-sdk', authMode: 'subscription' }],
        activeProvider: 'agent-sdk',
      }),
    ).toEqual({ available: true, providerId: 'agent-sdk' });
    expect(
      resolveDescribeAvailability({
        providers: [{ id: 'anthropic', authMode: 'api-key', apiKey: 'k' }],
        activeProvider: 'anthropic',
      }).available,
    ).toBe(true);
  });

  it('ignores disabled providers, including a disabled active one', () => {
    const result = resolveDescribeAvailability({
      providers: [{ id: 'anthropic', authMode: 'api-key', apiKey: 'k', enabled: false }],
      activeProvider: 'anthropic',
    });
    expect(result.available === false && result.reason).toBe('no-provider');
  });
});

describe('describe batch job', () => {
  it('describes every item and reports per-item then batch progress', async () => {
    const { events, finished } = runBatch({}, ['a.png', 'b.png']);
    await finished;

    expect(events.filter((e) => e.status === 'queued').map((e) => e.relPath)).toEqual([
      'a.png',
      'b.png',
    ]);
    const ready = events.filter((e) => e.status === 'ready');
    expect(ready.map((e) => e.description).sort()).toEqual(['desc for a.png', 'desc for b.png']);
    expect(ready.every((e) => e.total === 2)).toBe(true);

    const last = events[events.length - 1];
    expect(last).toMatchObject({ status: 'batch-done', succeeded: 2, failed: 0, done: 2, total: 2 });
  });

  // The rule from L2: failures are per-item, never batch-fatal.
  it('isolates a failure — the other assets still get described', async () => {
    const describe_ = vi.fn(async (_root: string, relPath: string) => {
      if (relPath === 'bad.png') throw new Error('provider refused the image');
      return { description: `desc for ${relPath}` };
    });
    const { events, finished } = runBatch({ describe: describe_ }, [
      'a.png',
      'bad.png',
      'c.png',
    ]);
    await finished;

    expect(describe_).toHaveBeenCalledTimes(3);
    const failed = events.filter((e) => e.status === 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ relPath: 'bad.png', error: 'provider refused the image' });
    expect(events.filter((e) => e.status === 'ready').map((e) => e.relPath).sort()).toEqual([
      'a.png',
      'c.png',
    ]);
    expect(events[events.length - 1]).toMatchObject({
      status: 'batch-done',
      succeeded: 2,
      failed: 1,
    });
  });

  it('survives a listener that throws', async () => {
    const engine = new LibraryDescribeJobEngine({
      describable: () => true,
      describe: async () => ({ description: 'ok' }),
    });
    engine.onEvent(() => {
      throw new Error('bad listener');
    });
    const seen: LibraryDescribeJobEvent[] = [];
    const done = new Promise<void>((resolve) =>
      engine.onEvent((e) => {
        seen.push(e);
        if (e.status === 'batch-done') resolve();
      }),
    );
    engine.start(ROOT, ['a.png']);
    await done;
    expect(seen.some((e) => e.status === 'ready')).toBe(true);
  });

  it('filters non-images out of the batch before counting the total', async () => {
    const describe_ = vi.fn(async () => ({ description: 'ok' }));
    const { events, finished } = runBatch({ describe: describe_ }, [
      'a.png',
      'clip.mp4',
      'notes.txt',
    ]);
    await finished;
    expect(describe_).toHaveBeenCalledTimes(1);
    expect(events[0].total).toBe(1);
  });

  it('dedupes repeated paths in one selection', async () => {
    const describe_ = vi.fn(async () => ({ description: 'ok' }));
    const { finished } = runBatch({ describe: describe_ }, ['a.png', 'a.png', 'b.png']);
    await finished;
    expect(describe_).toHaveBeenCalledTimes(2);
  });

  it('refuses to start with nothing describable, or while a batch runs', async () => {
    const engine = new LibraryDescribeJobEngine({
      describable: (p) => p.endsWith('.png'),
      describe: () => new Promise(() => {}), // never settles — keeps the batch open
    });
    expect(engine.start(ROOT, ['clip.mp4'])).toEqual({
      started: false,
      total: 0,
      error: 'No describable images in the selection',
    });

    expect(engine.start(ROOT, ['a.png']).started).toBe(true);
    expect(engine.start(ROOT, ['b.png'])).toMatchObject({ started: false });
    expect(engine.isRunning).toBe(true);
    engine.shutdown();
  });

  it('cancels an in-flight batch and reports it as canceled', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const engine = new LibraryDescribeJobEngine({
      describable: () => true,
      describe: async () => {
        await gate;
        return { description: 'ok' };
      },
    });
    const events: LibraryDescribeJobEvent[] = [];
    const done = new Promise<void>((resolve) =>
      engine.onEvent((e) => {
        events.push(e);
        if (e.status === 'batch-canceled') resolve();
      }),
    );
    engine.start(ROOT, ['a.png']);
    expect(engine.cancel()).toBe(true);
    release();
    await done;

    // The cancel is reported and no per-item result leaks out after it.
    expect(events.some((e) => e.status === 'ready')).toBe(false);
    expect(engine.isRunning).toBe(false);
    expect(engine.cancel()).toBe(false);
  });
});
