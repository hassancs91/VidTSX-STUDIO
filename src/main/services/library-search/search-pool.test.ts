import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { rankLibrarySounds } from '../library/sound-match';
import { searchPool } from './search-pool';

const e = (relPath: string, over: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry => ({ relPath, origin: 'imported', addedAt: 'a', ...over });
const paths = (xs: LibraryIndexEntry[]): string[] => xs.map((x) => x.relPath);

describe('searchPool', () => {
  const lib = [
    e('sfx/hit.mp3', { kind: 'audio', probe: { duration: 1, hasAudio: true } }),
    e('music/bed.mp3', { kind: 'audio', probe: { duration: 60, hasAudio: true } }),
    e('loose/tone.wav', { kind: 'audio' }),
    e('loose/long.wav', { kind: 'audio', probe: { duration: 45, hasAudio: true } }),
    e('images/logo.png', { kind: 'image' }),
    e('b-roll/city.mp4'),
    e('sfx2/other.mp3', { kind: 'audio', probe: { duration: 2, hasAudio: true } }),
  ];

  it('keeps every entry with no filter', () => {
    expect(paths(searchPool(lib, { query: 'x' }))).toEqual(paths(lib));
  });

  it('filters by kind (the entry kind, else the extension)', () => {
    expect(paths(searchPool(lib, { query: 'x', kinds: ['video'] }))).toEqual(['b-roll/city.mp4']);
    expect(paths(searchPool(lib, { query: 'x', kinds: ['image', 'video'] }))).toEqual(['images/logo.png', 'b-roll/city.mp4']);
  });

  it("applies E3's sound class: a music bed is not an effect, an unknown clip is either", () => {
    expect(paths(searchPool(lib, { query: 'x', kinds: ['audio'], soundClass: 'sfx' }))).toEqual(['sfx/hit.mp3', 'loose/tone.wav', 'sfx2/other.mp3']);
    expect(paths(searchPool(lib, { query: 'x', kinds: ['audio'], soundClass: 'music' }))).toEqual(['music/bed.mp3', 'loose/tone.wav', 'loose/long.wav']);
  });

  it('drops clips shorter than minDurationSec and keeps an unprobed one', () => {
    expect(paths(searchPool(lib, { query: 'x', kinds: ['audio'], soundClass: 'music', minDurationSec: 50 }))).toEqual(['music/bed.mp3', 'loose/tone.wav']);
  });

  it('narrows to a scope folder (relPath prefix, whole segments only)', () => {
    expect(paths(searchPool(lib, { query: 'x', scope: 'sfx' }))).toEqual(['sfx/hit.mp3']);
    expect(paths(searchPool(lib, { query: 'x', scope: 'sfx/' }))).toEqual(['sfx/hit.mp3']);
    expect(paths(searchPool(lib, { query: 'x', scope: '' }))).toEqual(paths(lib));
  });

  it("equals the matcher's own candidate set on the 51-clip corpus (sfx and music, with and without a length)", () => {
    // Every candidate of `rankLibrarySounds` scores on a prompt made of every word of the library, so its two lists
    // together are exactly its `isCandidate` set.
    const all = CORPUS_LIBRARY.map((c) => [c.relPath.split('/').pop()?.replace(/\.mp3$/, '').replace(/-/g, ' '), ...(c.tags ?? [])].join(' ')).join(' ');
    for (const opts of [{ soundClass: 'sfx' as const }, { soundClass: 'music' as const }, { soundClass: 'music' as const, minDurationSec: 60 }]) {
      const r = rankLibrarySounds(CORPUS_LIBRARY, all, { ...opts, limit: 999 });
      const matcher = new Set([...r.matches, ...r.nearest].map((m) => m.entry.relPath));
      expect(new Set(paths(searchPool(CORPUS_LIBRARY, { query: all, kinds: ['audio'], ...opts })))).toEqual(matcher);
    }
  });
});
