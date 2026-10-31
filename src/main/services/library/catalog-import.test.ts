import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LibraryIndexEntry, LibraryIndexFile } from '../../../shared/types/asset-library';

/**
 * E4 (T6 "Importer"): the catalog importer on a temp library root with the REAL
 * store (`upsertEntry`, the per-root chain) and the REAL bundled ffprobe — only
 * `electron` (and, defensively, the settings store) is mocked. Fixtures are WAVs
 * written from JS (a unit suite must not depend on another repo on disk); the 51
 * real mp3s go through the live run (docs/studio/end-to-end/E4/HANDOFF.md).
 */

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));
vi.mock('../settings-db', () => ({ getValue: () => undefined, setValue: () => undefined }));

import { applyCatalogImport, planCatalogImport, type CatalogSource } from './catalog-import';
import { NO_LICENCE_NOTE } from './catalog-import-map';
import { getLibraryIndexPath } from './library-paths';
import { scanLibrary } from './library-store';
import { markLibraryUsedIn } from './library-used-in';

/** 48 kHz mono 16-bit PCM sine — exact length, no encoder delay. */
function wav(seconds: number, freq: number): Buffer {
  const rate = 48000;
  const n = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * freq * i) / rate)), 44 + i * 2);
  return buf;
}

const sha = async (abs: string): Promise<string> =>
  crypto.createHash('sha256').update(await fs.readFile(abs)).digest('hex');

/**
 * Every folder (a `<rel>/` line — so an EMPTY folder a dry run created shows up, verifier round 1 N1) and every
 * file (`<rel> <sha256>`) under `dir`, dot-folders included, sorted.
 */
async function snapshot(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(`${path.relative(base, abs)}/`, ...(await snapshot(abs, base)));
    else out.push(`${path.relative(base, abs)} ${await sha(abs)}`);
  }
  return out.sort();
}

const LICENCE = 'ElevenLabs generated (text-to-sfx); owner: the repo author';
const WHOOSH = {
  id: 'whoosh-soft', file: 'clips/whoosh-soft.wav', category: 'motion', tags: ['whoosh', 'air'], duration_s: 0.68,
  peak_dbfs: -1.6, loudness_lufs: -20, source: 'elevenlabs:sound-generation', model: 'eleven_text_to_sound_v2',
  license: LICENCE, prompt: 'A short, soft air whoosh.', used_in: ['short-1-chess', 'video-2'],
};
const CHORD = {
  id: 'piano-c-maj', file: 'clips/piano-c-maj.wav', desc: 'C major triad', function: 'content',
  source: 'gen_chords.py (deterministic additive synth)', duration_s: 2.6, used_in: ['short-9-chords'],
};
const GHOST = { ...WHOOSH, id: 'ghost', file: 'clips/ghost.wav', used_in: [] };
const PAD = {
  id: 'ambient-pad', file: 'clips/ambient-pad.wav', category: 'ambient', tags: ['ambient', 'bed'], duration_s: 1.6,
  requested_ms: 1500, peak_dbfs: -4.9, loudness_lufs: -20, source: 'elevenlabs:music', model: 'music_v2',
  force_instrumental: true, license: 'ElevenLabs generated (text-to-music)', prompt: 'A minimal bed.', used_in: [],
};

let root = '';
let sfxDir = '';
let musicDir = '';
let sources: CatalogSource[] = [];

const readIndex = async (): Promise<LibraryIndexFile> =>
  JSON.parse(await fs.readFile(getLibraryIndexPath(root), 'utf-8')) as LibraryIndexFile;
const entryOf = async (rel: string): Promise<LibraryIndexEntry | undefined> =>
  (await readIndex()).entries.find((e) => e.relPath === rel);
const actions = (items: { relPath: string; action: string }[]): string[][] => items.map((i) => [i.relPath, i.action]);
async function writeCatalog(file: string, clips: unknown[]): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ note: 'test', clips }), 'utf-8');
  return file;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-catalog-import-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(root);
  sfxDir = path.join(tmpDir, 'editor', 'media', 'library', 'sfx');
  musicDir = path.join(tmpDir, 'editor', 'media', 'library', 'music');
  await fs.mkdir(path.join(sfxDir, 'clips'), { recursive: true });
  await fs.mkdir(path.join(musicDir, 'clips'), { recursive: true });
  await fs.writeFile(path.join(sfxDir, 'clips', 'whoosh-soft.wav'), wav(0.5, 440));
  await fs.writeFile(path.join(sfxDir, 'clips', 'piano-c-maj.wav'), wav(1.0, 262));
  await fs.writeFile(path.join(musicDir, 'clips', 'ambient-pad.wav'), wav(1.5, 110));
  await fs.writeFile(path.join(musicDir, 'clips', 'lofi-warm.wav'), wav(0.75, 220));
  sources = [
    { section: 'sfx', catalogPath: await writeCatalog(path.join(sfxDir, 'catalog.json'), [WHOOSH, CHORD, GHOST]), clipsDir: sfxDir },
    { section: 'music', catalogPath: await writeCatalog(path.join(musicDir, 'catalog.json'), [PAD]), clipsDir: musicDir },
  ];
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('E4 catalog importer (sequential: dry run → import → re-runs)', () => {
  it('the dry run (plan) writes nothing and states every file, target and the mapped fields', async () => {
    const before = await snapshot(root);
    const plan = await planCatalogImport(root, sources);
    expect(await snapshot(root)).toEqual(before);
    await expect(fs.access(path.join(root, '.vidtsx'))).rejects.toThrow();
    expect(actions(plan.items)).toEqual([
      ['sfx/whoosh-soft.wav', 'copy'], ['sfx/piano-c-maj.wav', 'copy'], ['sfx/ghost.wav', 'missing-source'],
      ['music/ambient-pad.wav', 'copy'],
    ]);
    expect(plan.items[0].mapped?.audio).toMatchObject({ category: 'motion', peakKind: 'sample', license: LICENCE });
    expect(plan.items[3].mapped?.dropped).toEqual(['requested_ms', 'force_instrumental']);
    expect(plan.problems).toEqual([]);
  });

  it('imports byte-identical files with the mapped fields and a measured probe', async () => {
    const results = await applyCatalogImport(root, await planCatalogImport(root, sources));
    expect(results.filter((r) => r.action === 'copy').every((r) => r.ok)).toBe(true);
    expect(await sha(path.join(root, 'sfx', 'whoosh-soft.wav'))).toBe(await sha(path.join(sfxDir, 'clips', 'whoosh-soft.wav')));
    expect(await sha(path.join(root, 'music', 'ambient-pad.wav'))).toBe(await sha(path.join(musicDir, 'clips', 'ambient-pad.wav')));
    const index = await readIndex();
    expect([index.version, index.rev]).toEqual([1, 2]);
    expect(index.entries.map((e) => e.relPath).sort()).toEqual(['music/ambient-pad.wav', 'sfx/piano-c-maj.wav', 'sfx/whoosh-soft.wav']);
    const w = await entryOf('sfx/whoosh-soft.wav');
    expect(w).toMatchObject({
      kind: 'audio', origin: 'imported', description: WHOOSH.prompt, tags: ['whoosh', 'air'],
      usedIn: ['short-1-chess', 'video-2'],
      audio: { category: 'motion', loudnessLufs: -20, peakDbfs: -1.6, peakKind: 'sample',
        source: 'elevenlabs:sound-generation', model: 'eleven_text_to_sound_v2', license: LICENCE },
    });
    expect(Math.abs((w?.probe?.duration ?? 0) - 0.5)).toBeLessThan(0.01);
    expect(results.find((r) => r.relPath === 'sfx/whoosh-soft.wav')?.probeDuration).toBeCloseTo(0.5, 2);
    const c = await entryOf('sfx/piano-c-maj.wav');
    expect(c?.description).toBe(`C major triad (${NO_LICENCE_NOTE})`);
    expect(c?.audio).toEqual({ source: CHORD.source });
    expect(c?.usedIn).toEqual(['short-9-chords']);
    expect(Math.abs((c?.probe?.duration ?? 0) - 1.0)).toBeLessThan(0.01);
  });

  it('a second run changes nothing: every clip unchanged, index.json byte-equal, no new file', async () => {
    const before = await snapshot(root);
    const plan = await planCatalogImport(root, sources);
    expect(plan.items.map((i) => i.action)).toEqual(['unchanged', 'unchanged', 'missing-source', 'unchanged']);
    await applyCatalogImport(root, plan);
    expect(await snapshot(root)).toEqual(before);
  });

  it('a changed catalog COPY updates that one entry, fields only (clips still from the original folder)', async () => {
    const before = await readIndex();
    const copy = await writeCatalog(path.join(tmpDir, 'copy', 'catalog.json'), [{ ...WHOOSH, tags: [...WHOOSH.tags, 'extra-tag'] }, CHORD]);
    const changed: CatalogSource[] = [{ section: 'sfx', catalogPath: copy, clipsDir: sfxDir }];
    const plan = await planCatalogImport(root, changed);
    expect(plan.items.map((i) => [i.action, i.changed])).toEqual([['update', ['tags']], ['unchanged', []]]);
    await applyCatalogImport(root, plan);
    const after = await readIndex();
    expect(after.entries).toHaveLength(3);
    for (const e of after.entries) {
      const b = before.entries.find((x) => x.relPath === e.relPath);
      if (e.relPath === 'sfx/whoosh-soft.wav') expect(e).toEqual({ ...b, tags: ['whoosh', 'air', 'extra-tag'], mtimeMs: e.mtimeMs, probe: e.probe, probeStamp: e.probeStamp });
      else expect(e).toEqual(b);
    }
  });

  it('keeps a Studio project id E2 marked and only appends a new catalog value', async () => {
    await markLibraryUsedIn(root, ['sfx/whoosh-soft.wav'], 'proj-studio-1');
    const more = await writeCatalog(path.join(tmpDir, 'copy2', 'catalog.json'), [{ ...WHOOSH, tags: [...WHOOSH.tags, 'extra-tag'], used_in: [...WHOOSH.used_in, 'short-99'] }]);
    const plan = await planCatalogImport(root, [{ section: 'sfx', catalogPath: more, clipsDir: sfxDir }]);
    expect(plan.items.map((i) => [i.action, i.changed])).toEqual([['update', ['usedIn']]]);
    await applyCatalogImport(root, plan);
    expect((await entryOf('sfx/whoosh-soft.wav'))?.usedIn).toEqual(['short-1-chess', 'video-2', 'proj-studio-1', 'short-99']);
  });

  it('never overwrites different bytes already at the target (conflict)', async () => {
    const target = path.join(root, 'music', 'lofi-warm.wav');
    await fs.writeFile(target, wav(0.3, 880));
    const mine = await sha(target);
    const cat = await writeCatalog(path.join(tmpDir, 'music2', 'catalog.json'), [{ ...PAD, id: 'lofi-warm', file: 'clips/lofi-warm.wav' }]);
    const plan = await planCatalogImport(root, [{ section: 'music', catalogPath: cat, clipsDir: musicDir }]);
    expect(actions(plan.items)).toEqual([['music/lofi-warm.wav', 'conflict']]);
    const [r] = await applyCatalogImport(root, plan);
    expect(r.ok).toBe(false);
    expect(await sha(target)).toBe(mine);
    expect(await entryOf('music/lofi-warm.wav')).toBeUndefined();
    await fs.rm(target);
  });

  it('finds a clip the user moved (same bytes) and does not copy it again', async () => {
    await fs.mkdir(path.join(root, 'synth'));
    await fs.rename(path.join(root, 'sfx', 'piano-c-maj.wav'), path.join(root, 'synth', 'piano-c-maj.wav'));
    await scanLibrary(root); // re-keys the entry by hash, fields kept
    const plan = await planCatalogImport(root, sources);
    expect(plan.items[1]).toMatchObject({ relPath: 'synth/piano-c-maj.wav', action: 'unchanged' });
    await applyCatalogImport(root, plan);
    await expect(fs.access(path.join(root, 'sfx', 'piano-c-maj.wav'))).rejects.toThrow();
    expect((await entryOf('synth/piano-c-maj.wav'))?.usedIn).toEqual(['short-9-chords']);
  });
});
