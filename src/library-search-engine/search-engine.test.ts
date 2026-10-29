import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLD_TIMEOUT_MS, IDLE_UNLOAD_MS, LibrarySearchEngine, WARM_TIMEOUT_MS } from './search-engine';
import type { EngineChild, EngineModel, SearchWorkerRequest, SearchWorkerResponse } from './types';

// The utilityProcess host (§7), driven through a fake child: lazy spawn, request ids, 5 s cold / 2 s warm timeouts,
// death → reject + respawn, idle unload, the background sync with progress.
interface FakeChild extends EngineChild {
  posted: SearchWorkerRequest[];
  reply(msg: SearchWorkerResponse): void;
  exit(code: number): void;
  killed: boolean;
}

function fakeChild(): FakeChild {
  let onMessage: (m: SearchWorkerResponse) => void = () => undefined;
  let onExit: (c: number) => void = () => undefined;
  const child: FakeChild = {
    posted: [],
    killed: false,
    postMessage: (m) => { child.posted.push(m); },
    onMessage: (l) => { onMessage = l; },
    onExit: (l) => { onExit = l; },
    kill: () => { child.killed = true; onExit(0); },
    reply: (m) => onMessage(m),
    exit: (c) => onExit(c),
  };
  return child;
}

const MODEL: EngineModel = { modelId: 'multilingual-e5-small', modelDir: 'M', cacheDir: 'C' };
const ITEMS = [{ relPath: 'a.mp3', text: 'a', textHash: 'h' }];
let children: FakeChild[] = [];
let model: EngineModel | null = MODEL;
let vectors: Array<{ ready: number; total: number; building: boolean }> = [];
let engine: LibrarySearchEngine;

const last = (): FakeChild => children[children.length - 1];
const lastRequestId = (): string => {
  const m = last().posted[last().posted.length - 1];
  return m && 'requestId' in m ? m.requestId : '';
};

beforeEach(() => {
  vi.useFakeTimers();
  children = [];
  model = MODEL;
  vectors = [];
  engine = new LibrarySearchEngine({
    fork: () => { const c = fakeChild(); children.push(c); return c; },
    model: () => model,
    vectorFile: (id) => `R/.vidtsx/search/vectors-${id}.json`,
    onVectors: (v) => { vectors.push(v); },
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LibrarySearchEngine — rank', () => {
  it('spawns lazily, once, and correlates answers by request id', async () => {
    expect(children).toHaveLength(0);
    const p1 = engine.rank('soft whoosh', ITEMS);
    const id1 = lastRequestId();
    const p2 = engine.rank('thud', ITEMS);
    const id2 = lastRequestId();
    expect(children).toHaveLength(1);
    expect(id1).not.toBe(id2);
    expect(last().posted[0]).toEqual({ type: 'rank', requestId: id1, model: MODEL, vectorFile: 'R/.vidtsx/search/vectors-multilingual-e5-small.json', query: 'soft whoosh', items: ITEMS });
    last().reply({ type: 'rankResult', requestId: id2, ranked: [{ relPath: 'a.mp3', cosine: 0.2 }], vectors: { ready: 1, total: 1 } });
    last().reply({ type: 'rankResult', requestId: id1, ranked: [{ relPath: 'a.mp3', cosine: 0.9 }], vectors: { ready: 1, total: 1 } });
    expect(await p1).toEqual({ ranked: [{ relPath: 'a.mp3', cosine: 0.9 }], vectors: { ready: 1, total: 1 } });
    expect((await p2).ranked[0].cosine).toBe(0.2);
  });

  it(`cold (model not loaded yet): gives up after ${COLD_TIMEOUT_MS} ms with 'model loading'; a late answer is ignored`, async () => {
    const p = engine.rank('a', ITEMS);
    const id = lastRequestId();
    const failed = expect(p).rejects.toThrow('model loading');
    await vi.advanceTimersByTimeAsync(COLD_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    last().reply({ type: 'rankResult', requestId: id, ranked: [], vectors: { ready: 0, total: 1 } });
  });

  it(`warm (after modelLoaded): times out at ${WARM_TIMEOUT_MS} ms with a timeout reason`, async () => {
    const p0 = engine.rank('a', ITEMS);
    last().reply({ type: 'modelLoaded', modelId: MODEL.modelId, loadMs: 1400 });
    last().reply({ type: 'rankResult', requestId: lastRequestId(), ranked: [], vectors: { ready: 1, total: 1 } });
    await p0;
    expect(engine.isLoaded()).toBe(true);
    const p = engine.rank('b', ITEMS);
    const failed = expect(p).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(WARM_TIMEOUT_MS);
    await failed;
  });

  it("an error answer rejects that request with the worker's message", async () => {
    const p = engine.rank('a', ITEMS);
    last().reply({ type: 'error', requestId: lastRequestId(), error: 'model file missing' });
    await expect(p).rejects.toThrow('model file missing');
  });

  it('a dead child rejects every pending call; the next call spawns a new one', async () => {
    const p1 = engine.rank('a', ITEMS);
    const p2 = engine.sync(ITEMS, true);
    last().exit(3);
    await expect(p1).rejects.toThrow(/exited \(code 3\)/);
    await expect(p2).rejects.toThrow(/exited \(code 3\)/);
    expect(engine.isLoaded()).toBe(false);
    void engine.rank('b', ITEMS).catch(() => undefined);
    expect(children).toHaveLength(2);
  });

  it("with no model on disk it rejects 'model not downloaded' and spawns nothing", async () => {
    model = null;
    await expect(engine.rank('a', ITEMS)).rejects.toThrow('model not downloaded');
    expect(children).toHaveLength(0);
  });

  it(`unloads after ${IDLE_UNLOAD_MS / 60_000} min idle (kills the child); the next call respawns`, async () => {
    const p = engine.rank('a', ITEMS);
    last().reply({ type: 'rankResult', requestId: lastRequestId(), ranked: [], vectors: { ready: 1, total: 1 } });
    await p;
    await vi.advanceTimersByTimeAsync(IDLE_UNLOAD_MS - 1000);
    expect(last().killed).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(last().killed).toBe(true);
    void engine.rank('b', ITEMS).catch(() => undefined);
    expect(children).toHaveLength(2);
  });
});

describe('LibrarySearchEngine — sync (the background build)', () => {
  it('has no short timeout, reports progress as building, then ready / total; no idle unload mid-build', async () => {
    const p = engine.sync(ITEMS, true);
    const id = lastRequestId();
    expect(last().posted[0]).toMatchObject({ type: 'sync', requestId: id, prune: true, items: ITEMS, model: MODEL });
    expect(engine.isBuilding()).toBe(true);
    last().reply({ type: 'syncProgress', requestId: id, ready: 0, total: 1 });
    await vi.advanceTimersByTimeAsync(IDLE_UNLOAD_MS + 60_000);
    expect(last().killed).toBe(false);
    last().reply({ type: 'syncResult', requestId: id, ready: 1, total: 1 });
    expect(await p).toEqual({ ready: 1, total: 1 });
    expect(engine.isBuilding()).toBe(false);
    expect(vectors).toEqual([{ ready: 0, total: 1, building: true }, { ready: 1, total: 1, building: false }]);
  });
});
