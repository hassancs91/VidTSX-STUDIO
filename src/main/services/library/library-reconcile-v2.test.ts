import { describe, expect, it, vi } from 'vitest';
import type { LibraryIndexFile } from '../../../shared/types/asset-library';
import type { StudioAssetProbe } from '../../../shared/types/studio';
import { reconcileIndex, type DiskFileStat } from './library-reconcile';

/** Index v2 (E1): kind on every entry, probe kept / refreshed / carried by tombstones. */

const NOW = '2026-10-23T12:00:00.000Z';
const LATER = '2026-10-24T12:00:00.000Z';
const P = (duration: number): StudioAssetProbe => ({ duration, hasAudio: true });
const file = (relPath: string, size = 100, mtimeMs = 1000): DiskFileStat => ({ relPath, size, mtimeMs });
const hasher = (map: Record<string, string> = {}) => async (relPath: string) => map[relPath] ?? `hash-of-${relPath}`;

function prober(duration = 3.25) {
  return vi.fn(async (_relPath: string, kind: string) => (kind === 'audio' || kind === 'video' ? P(duration) : undefined));
}

const indexed = (): LibraryIndexFile => ({
  version: 1,
  rev: 2,
  entries: [
    {
      relPath: 'sfx/whoosh.mp3', hash: 'h-whoosh', origin: 'generated', addedAt: NOW, kind: 'audio',
      probe: P(1.5), tags: ['whoosh'], audio: { category: 'motion' }, usedIn: ['p1'], size: 100, mtimeMs: 1000,
    },
  ],
  tombstones: [],
});

describe('reconcileIndex — index v2 (E1)', () => {
  it('new files get kind from the one table and a probe for audio/video only', async () => {
    const probeOf = prober();
    const next = await reconcileIndex(
      { version: 1, entries: [], tombstones: [] },
      [file('a.opus'), file('b.mts'), file('c.avif'), file('d.glb'), file('e.bin')],
      hasher(), NOW, probeOf,
    );
    expect(next.entries.map((e) => [e.relPath, e.kind, e.probe?.duration])).toEqual([
      ['a.opus', 'audio', 3.25], ['b.mts', 'video', 3.25], ['c.avif', 'image', undefined],
      ['d.glb', 'model3d', undefined], ['e.bin', 'other', undefined],
    ]);
  });

  it('an unchanged entry keeps its probe and is not re-probed', async () => {
    const probeOf = prober();
    const next = await reconcileIndex(indexed(), [file('sfx/whoosh.mp3')], hasher(), NOW, probeOf);
    expect(next.entries[0]).toEqual(indexed().entries[0]);
    expect(probeOf).not.toHaveBeenCalled();
  });

  it('an edited-in-place file gets a REFRESHED probe (was: cleared); v2 fields kept', async () => {
    const next = await reconcileIndex(indexed(), [file('sfx/whoosh.mp3', 222, 2000)], hasher(), NOW, prober(4));
    expect(next.entries[0]).toMatchObject({ probe: P(4), tags: ['whoosh'], audio: { category: 'motion' }, usedIn: ['p1'], size: 222 });
  });

  it('an edited file whose probe cannot run now is left without one (the back-fill catches up)', async () => {
    const next = await reconcileIndex(indexed(), [file('sfx/whoosh.mp3', 222, 2000)], hasher(), NOW, async () => undefined);
    expect(next.entries[0].probe).toBeUndefined();
    expect(next.entries[0].kind).toBe('audio');
  });

  it('a move keeps probe and every v2 field without probing', async () => {
    const probeOf = prober();
    const next = await reconcileIndex(indexed(), [file('moved/whoosh.mp3')], hasher({ 'moved/whoosh.mp3': 'h-whoosh' }), NOW, probeOf);
    expect(next.entries[0]).toEqual({ ...indexed().entries[0], relPath: 'moved/whoosh.mp3' });
    expect(probeOf).not.toHaveBeenCalled();
  });

  it('delete → re-import of the same bytes resurrects probe, kind and the v2 fields', async () => {
    const gone = await reconcileIndex(indexed(), [], hasher(), NOW, prober());
    expect(gone.tombstones[0]).toMatchObject({ kind: 'audio', probe: P(1.5), tags: ['whoosh'], usedIn: ['p1'] });
    const probeOf = prober();
    const back = await reconcileIndex(gone, [file('again.mp3')], hasher({ 'again.mp3': 'h-whoosh' }), LATER, probeOf);
    expect(back.entries[0]).toMatchObject({
      relPath: 'again.mp3', origin: 'generated', kind: 'audio', probe: P(1.5),
      tags: ['whoosh'], audio: { category: 'motion' }, usedIn: ['p1'],
    });
    expect(probeOf).not.toHaveBeenCalled();
  });

  it('a resurrected pre-E1 tombstone (no probe) is probed', async () => {
    const pre: LibraryIndexFile = {
      version: 1, entries: [],
      tombstones: [{ relPath: 'x.wav', hash: 'h-x', origin: 'imported', addedAt: NOW, missingSince: NOW }],
    };
    const back = await reconcileIndex(pre, [file('x.wav')], hasher({ 'x.wav': 'h-x' }), NOW, prober(9));
    expect(back.entries[0]).toMatchObject({ kind: 'audio', probe: P(9) });
  });

  it('a pre-E1 entry (no kind) gains its kind without a write of anything else', async () => {
    const pre: LibraryIndexFile = {
      version: 1, tombstones: [],
      entries: [{ relPath: 'v.mp4', hash: 'h', origin: 'imported', addedAt: NOW, size: 100, mtimeMs: 1000 }],
    };
    const next = await reconcileIndex(pre, [file('v.mp4')], hasher(), NOW, prober());
    expect(next.entries[0]).toEqual({ ...pre.entries[0], kind: 'video' });
  });
});
