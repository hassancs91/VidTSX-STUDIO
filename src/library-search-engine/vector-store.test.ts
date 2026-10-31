import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorStore, vectorFilePath } from './vector-store';

const HEADER = { modelId: 'multilingual-e5-small', pooling: 'mean' as const, prefixVersion: 1 };
const unit = (...xs: number[]): Float32Array => {
  const n = Math.hypot(...xs);
  return Float32Array.from(xs.map((x) => x / n));
};
const item = (relPath: string, textHash = `h-${relPath}`) => ({ relPath, text: relPath, textHash });

let dir = '';
let file = '';
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-vector-store-'));
  file = vectorFilePath(dir, 'multilingual-e5-small');
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const writeRaw = async (content: string): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
};

describe('vectorFilePath', () => {
  it('lives in the library dot folder: <root>/.vidtsx/search/vectors-<modelId>.json (§5)', () => {
    expect(vectorFilePath('R', 'm')).toBe(path.join('R', '.vidtsx', 'search', 'vectors-m.json'));
  });
});

describe('VectorStore', () => {
  it('starts empty with no file, and round-trips through an atomic save (no .tmp left behind)', async () => {
    const s = await VectorStore.open(file, HEADER);
    expect(s.size).toBe(0);
    expect(s.rebuiltBecause).toBe('missing');
    s.put('a.mp3', 'h1', unit(1, 0, 0));
    s.put('b.mp3', 'h2', unit(0, 1, 0));
    await s.save();
    expect(await fs.readdir(path.dirname(file))).toEqual(['vectors-multilingual-e5-small.json']);
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown> & { items: Record<string, { textHash: string; v: unknown }> };
    expect(raw).toMatchObject({ version: 1, modelId: 'multilingual-e5-small', dims: 3, pooling: 'mean', prefixVersion: 1 });
    expect(Object.keys(raw.items)).toEqual(['a.mp3', 'b.mp3']);
    expect(raw.items['a.mp3'].textHash).toBe('h1');
    expect(typeof raw.items['a.mp3'].v).toBe('string');
    const again = await VectorStore.open(file, HEADER);
    expect(again.rebuiltBecause).toBeNull();
    expect(again.size).toBe(2);
    expect(again.has(item('a.mp3', 'h1'))).toBe(true);
    expect(Array.from(again.vectorOf('a.mp3') ?? [])).toEqual(Array.from(unit(1, 0, 0)));
  });

  it('keys by relPath + textHash: a changed item text is missing again; unchanged ones are not', async () => {
    const s = await VectorStore.open(file, HEADER);
    s.put('a.mp3', 'h1', unit(1, 0));
    s.put('b.mp3', 'h2', unit(0, 1));
    expect(s.missing([item('a.mp3', 'h1'), item('b.mp3', 'CHANGED'), item('c.mp3')]).map((i) => i.relPath)).toEqual(['b.mp3', 'c.mp3']);
  });

  it.each([
    ['modelId', { ...HEADER, modelId: 'other-model' }],
    ['pooling', { ...HEADER, pooling: 'cls' }],
    ['prefixVersion', { ...HEADER, prefixVersion: 2 }],
    ['version', { ...HEADER, version: 2 }],
  ])('rebuilds (never trusts) a file whose %s differs', async (_field, header) => {
    await writeRaw(JSON.stringify({ version: 1, dims: 2, ...header, items: { 'a.mp3': { textHash: 'h', v: 'AACAPwAAAAA=' } } }));
    const s = await VectorStore.open(file, HEADER);
    expect(s.size).toBe(0);
    expect(s.rebuiltBecause).toBe('header mismatch');
  });

  it('rebuilds a corrupt file', async () => {
    await writeRaw('{ not json');
    const s = await VectorStore.open(file, HEADER);
    expect(s.size).toBe(0);
    expect(s.rebuiltBecause).toBe('corrupt');
  });

  it('adopt(dims): the first vector length is the file dims; another length clears every vector', async () => {
    const s = await VectorStore.open(file, HEADER);
    s.adopt(2);
    s.put('a.mp3', 'h1', unit(1, 0));
    s.adopt(2);
    expect(s.size).toBe(1);
    s.adopt(3);
    expect(s.size).toBe(0);
    expect(() => s.put('b.mp3', 'h', unit(1, 0))).toThrow(/dims/);
  });

  it('prune drops the entries not in the keep set (a deleted library entry, §5)', async () => {
    const s = await VectorStore.open(file, HEADER);
    s.put('a.mp3', 'h1', unit(1, 0));
    s.put('b.mp3', 'h2', unit(0, 1));
    expect(s.prune(new Set(['b.mp3']))).toBe(1);
    expect(s.has(item('a.mp3', 'h1'))).toBe(false);
    expect(s.has(item('b.mp3', 'h2'))).toBe(true);
  });

  it('rank: cosine over the items with a vector at their textHash, best first; reports ready / total', async () => {
    const s = await VectorStore.open(file, HEADER);
    s.put('a.mp3', 'h-a.mp3', unit(1, 0, 0));
    s.put('b.mp3', 'h-b.mp3', unit(0.8, 0.6, 0));
    s.put('c.mp3', 'OLD', unit(0, 0, 1));
    const r = s.rank(unit(1, 0, 0), [item('c.mp3'), item('b.mp3'), item('d.mp3'), item('a.mp3')]);
    expect(r.ranked.map((x) => x.relPath)).toEqual(['a.mp3', 'b.mp3']);
    expect(r.ranked[0].cosine).toBeCloseTo(1, 6);
    expect(r.ranked[1].cosine).toBeCloseTo(0.8, 6);
    expect(r.vectors).toEqual({ ready: 2, total: 4 });
  });

  it('save() writes nothing when nothing changed', async () => {
    const s = await VectorStore.open(file, HEADER);
    await s.save();
    await expect(fs.access(file)).rejects.toThrow();
  });
});
