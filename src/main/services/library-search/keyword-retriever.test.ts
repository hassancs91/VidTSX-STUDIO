import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { rankLibrarySounds } from '../library/sound-match';
import { CONFIDENT_COVERAGE, selectSoundAnswer } from '../library/sound-answer';
import { keywordList } from './keyword-retriever';
import { searchPool } from './search-pool';

const idOf = (relPath: string): string => (relPath.split('/').pop() ?? '').replace(/\.mp3$/, '');

/** S1's (a) ordered list (`run-a-keywords.cjs`), written out independently of the product code. */
function s1List(prompt: string, soundClass: 'sfx' | 'music', minDurationSec?: number): string[] {
  const ranking = rankLibrarySounds(CORPUS_LIBRARY, prompt, { soundClass, minDurationSec, limit: CORPUS_LIBRARY.length });
  const head = (selectSoundAnswer(ranking, prompt)?.rows ?? []).map((a) => idOf(a.match.entry.relPath));
  const confident = ranking.matches.filter((m) => m.coverage >= CONFIDENT_COVERAGE);
  const below = [...ranking.matches.filter((m) => m.coverage < CONFIDENT_COVERAGE), ...ranking.nearest].sort((a, b) => b.coverage - a.coverage);
  return [...head, ...[...confident, ...below].map((m) => idOf(m.entry.relPath)).filter((id) => !head.includes(id))];
}

function audioList(query: string, soundClass: 'sfx' | 'music', minDurationSec?: number) {
  const request = { query, kinds: ['audio' as const], soundClass, minDurationSec };
  return keywordList(searchPool(CORPUS_LIBRARY, request), request);
}

describe('keywordList — audio with a sound class (Basic = E3 today)', () => {
  const prompts: Array<[string, 'sfx' | 'music', number?]> = [
    ['a cracked screen', 'sfx'],
    ['things falling over', 'sfx'],
    ['a soft whoosh at the first cut', 'sfx'],
    ['a sparkling screen', 'sfx'],
    ['warm lo-fi bed', 'music', 60],
    ['calm piano', 'music'],
    ['a cuckoo clock chime', 'sfx'],
  ];

  it.each(prompts)("orders %j like S1's (a) list: the answer's rows, other confident matches, the rest by coverage", (prompt, cls, min) => {
    expect(audioList(prompt, cls, min).map((h) => idOf(h.entry.relPath))).toEqual(s1List(prompt, cls, min));
  });

  it("starts with selectSoundAnswer's rows, same clips, same order", () => {
    const ranking = rankLibrarySounds(CORPUS_LIBRARY, 'a cracked screen', { soundClass: 'sfx', limit: CORPUS_LIBRARY.length });
    const three = selectSoundAnswer(ranking, 'a cracked screen')?.rows.map((r) => r.match.entry.relPath);
    expect(audioList('a cracked screen', 'sfx').slice(0, 3).map((h) => h.entry.relPath)).toEqual(three);
  });

  it('leaves out clips no prompt word reaches, and gives each hit its coverage and covered words', () => {
    const list = audioList('a cracked screen', 'sfx');
    expect(list.length).toBeLessThan(45);
    for (const h of list) {
      expect(h.coverage).toBeGreaterThan(0);
      expect(h.words.length).toBeGreaterThan(0);
    }
    expect(list.find((h) => h.entry.relPath === 'sfx/break-glass-crack.mp3')?.words).toContain('cracked');
  });

  it('is empty on a true miss', () => {
    expect(audioList('zzqx vvbn', 'sfx')).toEqual([]);
  });
});

describe('keywordList — any other request (a coverage ranking over name / tags / description)', () => {
  const e = (relPath: string, over: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry => ({ relPath, origin: 'imported', addedAt: 'a', ...over });
  const lib = [
    e('images/blue-sky.png', { kind: 'image', tags: ['sky'] }),
    e('images/red-car.png', { kind: 'image', tags: ['car', 'vehicle'] }),
    e('b-roll/city-traffic.mp4', { kind: 'video', description: 'Cars and a red bus in city traffic at night.' }),
    e('images/cat.png', { kind: 'image' }),
  ];

  it('ranks by the share of query words each entry covers, best first, and drops entries with none', () => {
    const list = keywordList(lib, { query: 'red car' });
    expect(list.map((h) => h.entry.relPath)).toEqual(['images/red-car.png', 'b-roll/city-traffic.mp4']);
    expect(list[0].coverage).toBeCloseTo(1, 6);
    expect(list[0].words).toEqual(['red', 'car']);
    expect(list[1].coverage).toBeGreaterThan(0);
    expect(list[1].coverage).toBeLessThan(1);
  });

  it('ties by relPath and is empty when nothing is covered', () => {
    expect(keywordList(lib, { query: 'sky' }).map((h) => h.entry.relPath)).toEqual(['images/blue-sky.png']);
    expect(keywordList(lib, { query: 'zzqx' })).toEqual([]);
    expect(keywordList([e('b/logo.png'), e('a/logo.png')], { query: 'logo' }).map((h) => h.entry.relPath)).toEqual(['a/logo.png', 'b/logo.png']);
  });
});
