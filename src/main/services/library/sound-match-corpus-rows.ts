// E3 fix round 3 — the corpus row shape and runner shared by the round-3 / round-4 row files (the original
// 150-row `sound-match-corpus.test.ts` keeps its own rows and calls `expectCorpusRow`). Same
// conventions: 'a|b' = the FIRST result is one of these; '∅' = no match (generate); 'a|∅' = either;
// '*' = anything; `not` = never offered as a match (the matcher's top three); `music` = generate_music
// (a number = the asked length in seconds).
//
// RECALL (E-d16, fix round 4): a clip a row names must be in the ANSWER — the up-to-three labelled library
// sounds generate_sfx / generate_music show the model (`selectSoundAnswer` over every candidate, the same call
// `sound-reuse.ts` `libraryReuseAnswer` makes): the confident matches first, then the weak matches and closest
// candidates by coverage. So an 'x|∅' row is a promise that the library's clip is in front of the model.
//
// Two row conventions:
// - `describeCorpus` / `expectCorpusRow` (the 150-row file and the round-3 files — the matcher's bar): the
//   FIRST assertion is on the matcher's first match (`matches[0]`, weak or confident; none = '∅'), the recall
//   on the answer's three, `not` on the matches.
// - `describeAnswerCorpus` / `expectAnswerRow` (the round-4 files — E-d16's bar, verifier round 4's probes):
//   the named clip must be in the answer's three; if the answer's first is labelled `matched` (coverage ≥ 0.5)
//   it must be an allowed clip — EXCEPT (E-d16a) a first AT the 0.5 line (|coverage − 0.5| < 1e-9) or TIED
//   (within 1e-9) with an allowed clip among the confident matches shown, when an allowed clip is in the three:
//   such a row carries `edge: 'line' | 'tie'` (the note, asserted — a stale note fails) and is listed as a note
//   in its file. A weak match or a closest first is not asserted (a note by E-d16). '∅' = no confident first
//   (the answer may still show weak / closest sounds). A right clip that shares no word with the prompt (it
//   scores 0 — the matcher has no synonyms) makes the row '∅' with a `// vocabulary note`.
import { describe, expect, it } from 'vitest';
import { rankLibrarySounds, type SoundMatchOptions } from './sound-match';
import { CONFIDENT_COVERAGE, COVERAGE_EPSILON, selectSoundAnswer, type SoundAnswerLabel } from './sound-answer';
import { CORPUS_LIBRARY } from './sound-match-corpus.fixture';

export interface CorpusOpts {
  music?: true | number;
  not?: string[];
  /** E-d16a (round-4 rows only): the answer's confident first is not an allowed clip but sits AT the 0.5 line / TIES one. */
  edge?: 'line' | 'tie';
}
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

function matchOptionsOf(opts: CorpusOpts): SoundMatchOptions {
  const music = opts.music !== undefined;
  const minDurationSec = typeof opts.music === 'number' ? opts.music : undefined;
  return { soundClass: music ? 'music' : 'sfx', ...(minDurationSec !== undefined ? { minDurationSec } : {}) };
}

/** A row's ranking as clip ids: the matches (top three) and the nearest candidates below the threshold (top three). */
export function corpusRank(prompt: string, opts: CorpusOpts = {}): { matches: string[]; nearest: string[] } {
  const ranking = rankLibrarySounds(CORPUS_LIBRARY, prompt, matchOptionsOf(opts));
  return { matches: ranking.matches.map((m) => idOf(m.entry.relPath)), nearest: ranking.nearest.map((m) => idOf(m.entry.relPath)) };
}

/** The top-three matched clip ids for a row. */
export function corpusRun(prompt: string, opts: CorpusOpts = {}): string[] {
  return corpusRank(prompt, opts).matches;
}

export interface CorpusAnswerRow { id: string; label: SoundAnswerLabel; coverage: number }

/** The ANSWER the tool shows for a row (E-d16): the fill over every candidate; [] = a true miss (the tool generates). */
export function corpusAnswer(prompt: string, opts: CorpusOpts = {}): CorpusAnswerRow[] {
  const ranking = rankLibrarySounds(CORPUS_LIBRARY, prompt, { ...matchOptionsOf(opts), limit: CORPUS_LIBRARY.length });
  return (selectSoundAnswer(ranking, prompt)?.rows ?? []).map((r) => ({ id: idOf(r.match.entry.relPath), label: r.label, coverage: r.match.coverage }));
}

const showAnswer = (answer: CorpusAnswerRow[]): string =>
  answer.map((a) => `[${a.label}] ${a.id} ${a.coverage.toFixed(2)}`).join(' | ') || '∅ (true miss)';

function expectRecall(named: string[], answer: CorpusAnswerRow[]): boolean {
  const inThree = named.some((id) => answer.some((a) => a.id === id));
  if (named.length > 0) expect(inThree, `recall — answer ${showAnswer(answer)}`).toBe(true);
  return inThree;
}

/** One row on the matcher's bar: the first match, the recall over the answer's three (E-d16) and the `not` list. */
export function expectCorpusRow(prompt: string, expected: string, opts: CorpusOpts = {}): void {
  const { matches } = corpusRank(prompt, opts);
  if (expected !== '*') {
    const allowed = expected.split('|');
    expect(allowed, `got ${matches.join(', ') || '∅'}`).toContain(matches[0] ?? '∅');
    expectRecall(allowed.filter((id) => id !== '∅'), corpusAnswer(prompt, opts));
  }
  for (const wrong of opts.not ?? []) expect(matches).not.toContain(wrong);
}

/** One row on E-d16's bar: the right clip in the answer's three; a confident first is allowed (or an E-d16a `edge` note). */
export function expectAnswerRow(prompt: string, expected: string, opts: CorpusOpts = {}): void {
  const answer = corpusAnswer(prompt, opts);
  if (expected !== '*') {
    const allowed = expected.split('|');
    const named = allowed.filter((id) => id !== '∅');
    const inThree = expectRecall(named, answer);
    const first = answer[0];
    if (first !== undefined && first.label === 'matched' && !allowed.includes(first.id)) {
      const atLine = Math.abs(first.coverage - CONFIDENT_COVERAGE) < COVERAGE_EPSILON;
      const tied = answer.some(
        (a) => a.label === 'matched' && allowed.includes(a.id) && Math.abs(a.coverage - first.coverage) < COVERAGE_EPSILON,
      );
      const edge = named.length > 0 && inThree ? (atLine ? 'line' : tied ? 'tie' : undefined) : undefined;
      expect(edge !== undefined && opts.edge === edge, `confident first ${first.id} is not allowed (edge ${edge ?? 'none'}) — answer ${showAnswer(answer)}`).toBe(true);
    } else {
      expect(opts.edge, `stale E-d16a note — answer ${showAnswer(answer)}`).toBeUndefined();
    }
  }
  for (const wrong of opts.not ?? []) expect(corpusRun(prompt, opts)).not.toContain(wrong);
}

function describeRows(title: string, rows: CorpusRow[], count: number, expectRow: typeof expectCorpusRow): void {
  describe(title, () => {
    it(`holds ${count} rows`, () => {
      expect(rows).toHaveLength(count);
    });

    it.each(rows)('%j → %s', (prompt, expected, opts) => expectRow(prompt, expected, opts));
  });
}

/** One describe per row file on the matcher's bar: the row count (so a dropped row is noticed) and every row. */
export function describeCorpus(title: string, rows: CorpusRow[], count: number): void {
  describeRows(title, rows, count, expectCorpusRow);
}

/** One describe per round-4 row file on E-d16's bar (`expectAnswerRow`). */
export function describeAnswerCorpus(title: string, rows: CorpusRow[], count: number): void {
  describeRows(title, rows, count, expectAnswerRow);
}
