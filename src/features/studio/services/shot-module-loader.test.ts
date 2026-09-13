import { describe, it, expect } from 'vitest';
import { createShotModuleLoader, type ShotLoadRequest } from './shot-module-loader';
import { orderShotLoads, shotSpans } from './shot-load-order';
import type { StudioTimeline } from '../types';

/** A controllable load: every call parks until the test resolves/rejects it. */
function harness(concurrency = 2) {
  const calls: Array<{ req: ShotLoadRequest; resolve: (c: string) => void; reject: (e: Error) => void }> = [];
  const timers: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
  let notifications = 0;
  const loader = createShotModuleLoader<string>({
    load: (req) => new Promise<string>((resolve, reject) => calls.push({ req, resolve, reject })),
    placeholder: (req) => `placeholder:${req.key}`,
    failed: (req, message) => `failed:${req.key}:${message}`,
    concurrency,
    flushDelayMs: 100,
    setTimer: (fn, ms) => {
      const t = { fn, ms, cancelled: false };
      timers.push(t);
      return t;
    },
    clearTimer: (handle) => {
      (handle as { cancelled: boolean }).cancelled = true;
    },
  });
  loader.subscribe(() => {
    notifications += 1;
  });
  const runTimers = () => {
    for (const t of timers.splice(0)) if (!t.cancelled) t.fn();
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { loader, calls, timers, runTimers, tick, notifications: () => notifications };
}

const req = (shotId: string, version = 1): ShotLoadRequest => ({ key: `${shotId}@${version}`, shotId, version, label: shotId });

describe('orderShotLoads', () => {
  const timeline = {
    tracks: [
      {
        clips: [
          { id: 'c1', tsx: { shotId: 'intro' }, timelineStart: 0, duration: 5 },
          { id: 'c2', tsx: { shotId: 'mid' }, timelineStart: 40, duration: 5 },
          { id: 'm', timelineStart: 0, duration: 100 },
          { id: 'c3', tsx: { shotId: 'late' }, timelineStart: 90, duration: 5 },
          { id: 'c4', tsx: { shotId: 'intro' }, timelineStart: 60, duration: 2 },
          { id: 'c5', tsx: { shotId: 'behind' }, timelineStart: 30, duration: 5 },
        ],
      },
    ],
  } as unknown as StudioTimeline;
  const ids = ['pool-only', 'late', 'mid', 'intro', 'behind'];

  it('loads what is under the playhead first, then outward, pool-only shots last', () => {
    expect(orderShotLoads(ids, shotSpans(timeline), 0)).toEqual(['intro', 'behind', 'mid', 'late', 'pool-only']);
  });

  it('uses the nearest of a shot’s several clips and breaks ties toward what plays next', () => {
    // At 37.5 s: behind ended 2.5 s ago, mid starts in 2.5 s → mid first.
    expect(orderShotLoads(ids, shotSpans(timeline), 37.5)).toEqual(['mid', 'behind', 'intro', 'late', 'pool-only']);
    // At 61 s the playhead is inside intro's second clip.
    expect(orderShotLoads(ids, shotSpans(timeline), 61)[0]).toBe('intro');
  });

  it('keeps the given order when nothing is on the timeline', () => {
    expect(orderShotLoads(['b', 'a', 'c'], [], 12)).toEqual(['b', 'a', 'c']);
  });
});

describe('createShotModuleLoader', () => {
  it('publishes placeholders on the first sync and never runs more than the concurrency limit', async () => {
    const h = harness(2);
    expect(h.loader.getSnapshot().synced).toBe(false);
    h.loader.sync([req('a'), req('b'), req('c'), req('d')]);
    const snap = h.loader.getSnapshot();
    expect(snap).toMatchObject({ synced: true, total: 4, settled: 0 });
    expect(snap.components.c).toBe('placeholder:c@1');
    expect(h.calls.map((c) => c.req.shotId)).toEqual(['a', 'b']);

    h.calls[0]!.resolve('A');
    await h.tick();
    expect(h.calls.map((c) => c.req.shotId)).toEqual(['a', 'b', 'c']);
  });

  it('drains the queue in the synced order, re-orderable while it drains', async () => {
    const h = harness(1);
    h.loader.sync([req('a'), req('b'), req('c'), req('d')]);
    h.loader.reprioritize(['d', 'c', 'b', 'a']);
    for (let i = 0; i < 4; i++) {
      h.calls[i]!.resolve(`X${i}`);
      await h.tick();
    }
    expect(h.calls.map((c) => c.req.shotId)).toEqual(['a', 'd', 'c', 'b']);
  });

  it('batches settles: the first arrival and the last publish at once, the ones between coalesce', async () => {
    const h = harness(6);
    h.loader.sync(['a', 'b', 'c', 'd', 'e'].map((id) => req(id)));
    const afterSync = h.notifications();

    h.calls[0]!.resolve('A'); // first arrival — the shot at the playhead: immediate
    await h.tick();
    expect(h.notifications()).toBe(afterSync + 1);
    expect(h.loader.getSnapshot().components.a).toBe('A');

    h.calls[1]!.resolve('B');
    h.calls[2]!.resolve('C');
    h.calls[3]!.reject(new Error('Unexpected token'));
    await h.tick();
    expect(h.notifications()).toBe(afterSync + 1); // held for the batch
    h.runTimers();
    expect(h.notifications()).toBe(afterSync + 2); // one publish for three settles
    expect(h.loader.getSnapshot()).toMatchObject({ settled: 4, failed: 1 });
    expect(h.loader.getSnapshot().components.d).toBe('failed:d@1:Unexpected token');

    h.calls[4]!.resolve('E'); // the last one — all loaded is never held back
    await h.tick();
    expect(h.notifications()).toBe(afterSync + 3);
    expect(h.loader.getSnapshot()).toMatchObject({ total: 5, settled: 5 });
  });

  it('keeps placeholder identity across publishes, so a loading tile never remounts', async () => {
    const h = harness(1);
    h.loader.sync([req('a'), req('b')]);
    const before = h.loader.getSnapshot().components.b;
    h.calls[0]!.resolve('A');
    await h.tick();
    expect(h.loader.getSnapshot().components.b).toBe(before);
  });

  it('a regenerated shot (new version) drops the old request, ignores its late result and loads the new one', async () => {
    const h = harness(2);
    h.loader.sync([req('a', 1), req('b', 1)]);
    h.calls[1]!.resolve('B1');
    await h.tick();

    h.loader.sync([req('a', 1), req('b', 2)]);
    expect(h.loader.getSnapshot().components.b).toBe('placeholder:b@2');
    h.calls[0]!.resolve('A1');
    await h.tick();
    const v2 = h.calls.find((c) => c.req.key === 'b@2')!;
    v2.resolve('B2');
    await h.tick();
    h.runTimers();
    expect(h.loader.getSnapshot().components).toEqual({ a: 'A1', b: 'B2' });
  });

  it('a result that lands for a request dropped mid-load is ignored', async () => {
    const h = harness(1);
    h.loader.sync([req('a', 1)]);
    h.loader.sync([req('a', 2)]);
    h.calls[0]!.resolve('stale v1');
    await h.tick();
    expect(h.loader.getSnapshot().components.a).toBe('placeholder:a@2');
    h.calls[1]!.resolve('fresh v2');
    await h.tick();
    expect(h.loader.getSnapshot().components.a).toBe('fresh v2');
  });

  it('a sync that changes nothing publishes nothing', () => {
    const h = harness(2);
    h.loader.sync([req('a'), req('b')]);
    const n = h.notifications();
    h.loader.sync([req('b'), req('a')]);
    expect(h.notifications()).toBe(n);
  });

  it('dispose stops the queue and silences late results', async () => {
    const h = harness(1);
    h.loader.sync([req('a'), req('b')]);
    const n = h.notifications();
    h.loader.dispose();
    h.calls[0]!.resolve('A');
    await h.tick();
    expect(h.calls).toHaveLength(1);
    expect(h.notifications()).toBe(n);
  });
});
