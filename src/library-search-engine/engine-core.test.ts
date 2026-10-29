import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextEmbedder } from './embedder';
import { SearchCore } from './engine-core';
import type { EngineItem, EngineModel, SearchWorkerResponse } from './types';
import { vectorFilePath } from './vector-store';

// The child's logic (worker.ts only wires it to parentPort): model load, the vector file, diff embedding, the build,
// the queue a query jumps, ranking. A fake embedder: 4 dims = letter counts of a/b/c/d, normalised.
const vec = (t: string): Float32Array => {
  const v = [...'abcd'].map((ch) => t.split(ch).length - 1 + 0.01);
  const n = Math.hypot(...v);
  return Float32Array.from(v.map((x) => x / n));
};

function fakeEmbedder() {
  const log: string[] = [];
  let gate: Promise<void> | null = null;
  const emb: TextEmbedder = {
    embedQueries: async (qs) => {
      log.push(`q:${qs.length}`);
      return qs.map(vec);
    },
    embedPassages: async (ts) => {
      log.push(`p:${ts.length}`);
      const g = gate;
      gate = null;
      if (g) await g;
      return ts.map(vec);
    },
    dispose: vi.fn(async () => undefined),
  };
  return { log, emb, holdNextPassages: (g: Promise<void>) => { gate = g; } };
}

const item = (relPath: string, text = relPath): EngineItem => ({ relPath, text, textHash: `h:${text}` });
const MODEL: EngineModel = { modelId: 'multilingual-e5-small', modelDir: 'M', cacheDir: 'C' };

let dir = '';
let file = '';
let sent: SearchWorkerResponse[] = [];
let fake = fakeEmbedder();
let loads = 0;
let core: SearchCore;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-engine-core-'));
  file = vectorFilePath(dir, MODEL.modelId);
  sent = [];
  fake = fakeEmbedder();
  loads = 0;
  core = new SearchCore({ loadEmbedder: async () => { loads += 1; return fake.emb; }, send: (m) => { sent.push(m); } });
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const rank = (requestId: string, query: string, items: EngineItem[]) => core.handle({ type: 'rank', requestId, model: MODEL, vectorFile: file, query, items });
const sync = (requestId: string, items: EngineItem[], prune = true) => core.handle({ type: 'sync', requestId, model: MODEL, vectorFile: file, items, prune });
const answer = (requestId: string) => sent.find((m) => 'requestId' in m && m.requestId === requestId && m.type !== 'syncProgress');

describe('SearchCore — rank', () => {
  it('loads the model once (modelLoaded once), embeds a small pool diff first, saves the file and ranks every item', async () => {
    const items = [item('a.mp3', 'aaa'), item('b.mp3', 'bbb'), item('c.mp3', 'ab')];
    await rank('r1', 'aaaa', items);
    await rank('r2', 'bbbb', items);
    expect(loads).toBe(1);
    expect(sent.filter((m) => m.type === 'modelLoaded')).toHaveLength(1);
    expect(fake.log).toEqual(['q:1', 'p:3', 'q:1']);
    const r1 = answer('r1');
    expect(r1?.type === 'rankResult' && r1.ranked.map((x) => x.relPath)).toEqual(['a.mp3', 'c.mp3', 'b.mp3']);
    expect(r1?.type === 'rankResult' && r1.vectors).toEqual({ ready: 3, total: 3 });
    const r2 = answer('r2');
    expect(r2?.type === 'rankResult' && r2.ranked[0].relPath).toBe('b.mp3');
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { items: Record<string, unknown> };
    expect(Object.keys(saved.items).sort()).toEqual(['a.mp3', 'b.mp3', 'c.mp3']);
  });

  it('a changed item text is re-embedded before the search (relPath + textHash key)', async () => {
    await rank('r1', 'a', [item('a.mp3', 'aaa')]);
    await rank('r2', 'a', [item('a.mp3', 'bbb')]);
    expect(fake.log).toEqual(['q:1', 'p:1', 'q:1', 'p:1']);
  });

  it('never indexes a big diff on query: over one batch (32) missing → ranks the ready ones, reports ready < total', async () => {
    const items = Array.from({ length: 40 }, (_x, i) => item(`s${i}.mp3`, `a${i}`));
    await rank('r1', 'a', items);
    expect(fake.log).toEqual(['q:1']);
    const r = answer('r1');
    expect(r?.type === 'rankResult' && r.ranked).toEqual([]);
    expect(r?.type === 'rankResult' && r.vectors).toEqual({ ready: 0, total: 40 });
  });

  it('a model-load failure answers an error for that request, and the next request retries the load', async () => {
    let fail = true;
    core = new SearchCore({ loadEmbedder: async () => { loads += 1; if (fail) throw new Error('model file missing'); return fake.emb; }, send: (m) => { sent.push(m); } });
    await rank('r1', 'a', [item('a.mp3')]);
    expect(answer('r1')).toEqual({ type: 'error', requestId: 'r1', error: 'model file missing' });
    fail = false;
    await rank('r2', 'a', [item('a.mp3')]);
    expect(answer('r2')?.type).toBe('rankResult');
    expect(loads).toBe(2);
  });

  it('unload disposes the embedder; the next request loads again', async () => {
    await rank('r1', 'a', [item('a.mp3')]);
    await core.handle({ type: 'unload' });
    expect(fake.emb.dispose).toHaveBeenCalledTimes(1);
    await rank('r2', 'a', [item('a.mp3')]);
    expect(loads).toBe(2);
  });
});

describe('SearchCore — sync (the background build, §5)', () => {
  it('embeds the missing items in batches of 32 with progress, prunes deleted entries, saves, answers ready / total', async () => {
    const first = Array.from({ length: 40 }, (_x, i) => item(`s${i}.mp3`, `a${i}`));
    await sync('s1', first);
    expect(fake.log).toEqual(['p:32', 'p:8']);
    expect(sent.filter((m) => m.type === 'syncProgress').map((m) => (m.type === 'syncProgress' ? m.ready : -1))).toEqual([0, 32, 40]);
    expect(answer('s1')).toEqual({ type: 'syncResult', requestId: 's1', ready: 40, total: 40 });
    // a second sync with one entry deleted and one added: only the new one is embedded, the deleted one is dropped
    const second = [...first.slice(1), item('new.mp3', 'bb')];
    await sync('s2', second);
    expect(fake.log.slice(2)).toEqual(['p:1']);
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { items: Record<string, unknown> };
    expect(Object.keys(saved.items)).toHaveLength(40);
    expect(saved.items['s0.mp3']).toBeUndefined();
    expect(saved.items['new.mp3']).toBeDefined();
  });

  it('a query jumps the build queue and ranks with the vectors ready so far (no diff embedding during a build)', async () => {
    const items = Array.from({ length: 64 }, (_x, i) => item(`s${i}.mp3`, `a${i}`));
    let release: () => void = () => undefined;
    fake.holdNextPassages(new Promise<void>((r) => { release = r; }));
    const building = sync('s1', items);
    await vi.waitFor(() => expect(fake.log).toEqual(['p:32']));
    const ranking = rank('r1', 'a', items);
    await new Promise((r) => setTimeout(r, 10));
    release();
    await Promise.all([building, ranking]);
    expect(fake.log).toEqual(['p:32', 'q:1', 'p:32']);
    const r = answer('r1');
    expect(r?.type === 'rankResult' && r.vectors).toEqual({ ready: 32, total: 64 });
    expect(answer('s1')).toEqual({ type: 'syncResult', requestId: 's1', ready: 64, total: 64 });
  });

  it('two syncs of the same file run one after the other (the second finds nothing left to embed)', async () => {
    const items = [item('a.mp3'), item('b.mp3')];
    await Promise.all([sync('s1', items), sync('s2', items)]);
    expect(fake.log).toEqual(['p:2']);
    expect(answer('s2')).toEqual({ type: 'syncResult', requestId: 's2', ready: 2, total: 2 });
  });
});
