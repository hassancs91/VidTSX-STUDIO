// E3 fix round 3 — the corpus row shape and runner shared by the round-3 row files (the original
// 150-row `sound-match-corpus.test.ts` keeps its own rows and calls `expectCorpusRow`). Same
// conventions: 'a|b' = the FIRST result is one of these; '∅' = no match (generate); 'a|∅' = either;
// '*' = anything; `not` = never offered in the top three; `music` = generate_music (a number = the
// asked length in seconds). RECALL (E-d15, the miss rule): a clip a row names must be FOUND — in
// the matches, or among the three nearest the tool shows on a miss — so an 'x|∅' row is a promise
// that the library's clip is within the model's reach; a row whose clip scores nothing is '∅'.
import { describe, expect, it } from 'vitest';
import { rankLibrarySounds } from './sound-match';
import { CORPUS_LIBRARY } from './sound-match-corpus.fixture';

export interface CorpusOpts { music?: true | number; not?: string[] }
export type CorpusRow = [prompt: string, expected: string, opts?: CorpusOpts];

/** Acceptable firsts where clips tie for a real reason. */
export const W = 'whoosh-soft|whoosh-wind|whoosh-reverse|whoosh-data-burst';
export const IMPACT = 'impact-soft|impact-deep-soft';
export const HIT = 'impact-soft|stamp-hit';
export const THUD = 'impact-soft|knock-solid';
export const CLICK = 'ui-click-soft|ui-toggle-on';
export const CHIME = 'chime-reward|chime-magic';
export const POP = 'pop-reveal|party-popper';
export const CRASH = 'break-crash-digital|crash-tumble';
export const ZAP = 'glitch-zap|zap-electric';
/** `double-knock` is a chess-capture tag: a bare "knock" fairly finds either; "door" settles it. */
export const KNOCK = 'knock-solid|chess-piece-capture';
export const WIND = 'wind-soft|whoosh-wind';
/** The `snap` category clips plus the trap: a bare "snap" is any of them. */
export const SNAP = 'trap-snap|ui-click-soft|ui-send|ui-toggle-on';
export const FAIL = 'break-crash-digital|power-down|break-glass-crack';
export const M: CorpusOpts = { music: true };
/** F3: the stem collisions that must never be offered (run → dash-zip, shut → trap-snap, blow → flame-snuff). */
export const NO_DASH: CorpusOpts = { not: ['dash-zip'] };
export const NO_TRAP: CorpusOpts = { not: ['trap-snap'] };
export const NO_SNUFF: CorpusOpts = { not: ['flame-snuff'] };

export const idOf = (relPath: string): string => (relPath.split('/').pop() ?? relPath).replace(/\.mp3$/, '');

/** A row's ranking as clip ids: the matches (top three) and the nearest candidates below the threshold (top three). */
export function corpusRank(prompt: string, opts: CorpusOpts = {}): { matches: string[]; nearest: string[] } {
  const music = opts.music !== undefined;
  const minDurationSec = typeof opts.music === 'number' ? opts.music : undefined;
  const ranking = rankLibrarySounds(CORPUS_LIBRARY, prompt, {
    soundClass: music ? 'music' : 'sfx',
    ...(minDurationSec !== undefined ? { minDurationSec } : {}),
  });
  return { matches: ranking.matches.map((m) => idOf(m.entry.relPath)), nearest: ranking.nearest.map((m) => idOf(m.entry.relPath)) };
}

/** The top-three matched clip ids for a row. */
export function corpusRun(prompt: string, opts: CorpusOpts = {}): string[] {
  return corpusRank(prompt, opts).matches;
}

/** One row's assertions: the first result, the recall (E-d15) and the `not` list. */
export function expectCorpusRow(prompt: string, expected: string, opts: CorpusOpts = {}): void {
  const { matches, nearest } = corpusRank(prompt, opts);
  if (expected !== '*') {
    const allowed = expected.split('|');
    expect(allowed, `got ${matches.join(', ') || '∅'}`).toContain(matches[0] ?? '∅');
    const named = allowed.filter((id) => id !== '∅');
    if (named.length > 0) {
      const found = named.some((id) => matches.includes(id) || nearest.includes(id));
      expect(found, `recall — matches ${matches.join(', ') || '∅'} · nearest ${nearest.join(', ') || '∅'}`).toBe(true);
    }
  }
  for (const wrong of opts.not ?? []) expect(matches).not.toContain(wrong);
}

/** One describe per row file: the row count (so a dropped row is noticed) and every row. */
export function describeCorpus(title: string, rows: CorpusRow[], count: number): void {
  describe(title, () => {
    it(`holds ${count} rows`, () => {
      expect(rows).toHaveLength(count);
    });

    it.each(rows)('%j → %s', (prompt, expected, opts) => expectCorpusRow(prompt, expected, opts));
  });
}
