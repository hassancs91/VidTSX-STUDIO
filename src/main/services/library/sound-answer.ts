// E3 fix round 4 (E-d16 + E-d16a + E-d16b): WHICH library sounds generate_sfx / generate_music show the model
// instead of generating — the answer-level recall fill. Pure: a `rankLibrarySounds()` ranking (pass a `limit`
// that keeps every candidate) and the prompt in, at most three labelled rows out. The matcher (`sound-match.ts`)
// is not changed by this: it still decides what MATCHES; this file decides what is SHOWN.
//
// The rows: first the CONFIDENT matches (coverage ≥ 0.5), in the matcher's own order; then the remaining
// slots from the below-threshold sounds — WEAK matches (a head-rule match under 0.5) and CLOSEST
// candidates (coverage > 0, not a match) together — in two groups (E-d16b, the word-diversity rule): first
// the sounds that cover a prompt word NO shown confident row covers, then the sounds that only repeat
// covered words; each group by coverage, a closest before a weak match on a tie (coverages compared with an
// epsilon — E-d16a), and within one label the matcher's order. "Covers a word" = the word adds to that
// sound's coverage: any of the matcher's fields, any strength (`sound-answer-words.ts` states the rule). So a
// right clip the head rule passed over ("a cracked screen" → break-glass-crack beside power-down) is in front
// of the model, an exact-0.5 or tied first ("a breaking screen" → power-down) brings the break clips along,
// and a confident clip that carries only the noun ("a sparkling screen" → power-down, `screen`) brings a
// carrier of the other word (sparkle-soft) rather than more screen clips. With no confident row shown every
// scoring sound covers some word, so the order is E-d16a's; with three, no slot is left.
//
// The answer's kind follows the rows the model SEES: a `matched` row → 'match' ("The library already
// has …"); else a `weak match` row → 'weak' (the library "may have" the sound); else 'nearest' (fix
// round 3's "No library sound matched … well"). No row at all → null: a TRUE miss, the tool generates.

import type { SoundMatch, SoundRanking } from './sound-match';
import { promptSoundWords, wordsCoveredBy } from './sound-answer-words';

export type SoundAnswerLabel = 'matched' | 'weak match' | 'closest';
export type SoundAnswerKind = 'match' | 'weak' | 'nearest';

export interface SoundAnswerRow {
  match: SoundMatch;
  label: SoundAnswerLabel;
}

export interface SoundAnswer {
  kind: SoundAnswerKind;
  /** At most `ANSWER_SIZE`, in the order the model reads them. */
  rows: SoundAnswerRow[];
  /** Rows labelled `matched`. */
  confident: number;
  /** Rows labelled `weak match`. */
  weak: number;
}

/** How many library sounds an answer shows. */
export const ANSWER_SIZE = 3;
/** The matcher's own match threshold (`sound-match.ts` MATCH_COVERAGE): a match below it passed by the head rule. */
export const CONFIDENT_COVERAGE = 0.5;
/** Coverages closer than this are a tie (float error, e.g. two 0.3 sums reached by different paths). */
export const COVERAGE_EPSILON = 1e-9;

/** `matched` at or above the threshold, else `weak match` — only for entries of `ranking.matches`. */
export function labelOfMatch(match: SoundMatch): SoundAnswerLabel {
  return match.coverage >= CONFIDENT_COVERAGE ? 'matched' : 'weak match';
}

/** Below-threshold order: coverage (epsilon), then a closest before a weak match; the sort is stable. */
function byCoverageClosestFirst(a: SoundAnswerRow, b: SoundAnswerRow): number {
  const gap = b.match.coverage - a.match.coverage;
  if (Math.abs(gap) >= COVERAGE_EPSILON) return gap;
  if (a.label === b.label) return 0;
  return a.label === 'closest' ? -1 : 1;
}

/**
 * E-d16b: the below-threshold rows (already in E-d16a's order) regrouped — those covering a prompt word no SHOWN
 * confident row covers first, then the rest, each group keeping its order. No confident row shown: every scoring row
 * covers some word, so nothing moves; three shown: no slot is left.
 */
function newWordsFirst(below: SoundAnswerRow[], shown: SoundAnswerRow[], prompt: string): SoundAnswerRow[] {
  if (shown.length === 0 || shown.length >= ANSWER_SIZE) return below;
  const words = promptSoundWords(prompt);
  const covered = new Set(shown.flatMap((row) => wordsCoveredBy(row.match.entry, words)));
  const fresh = below.filter((row) => wordsCoveredBy(row.match.entry, words).some((word) => !covered.has(word)));
  return [...fresh, ...below.filter((row) => !fresh.includes(row))];
}

/** The rows the tool shows for a ranking of `prompt`, or null when nothing scored (a TRUE miss). */
export function selectSoundAnswer(ranking: SoundRanking, prompt: string): SoundAnswer | null {
  const confident: SoundAnswerRow[] = [];
  const below: SoundAnswerRow[] = [];
  for (const match of ranking.matches) {
    const label = labelOfMatch(match);
    (label === 'matched' ? confident : below).push({ match, label });
  }
  for (const match of ranking.nearest) below.push({ match, label: 'closest' });
  below.sort(byCoverageClosestFirst);

  const shown = confident.slice(0, ANSWER_SIZE);
  const rows = [...shown, ...newWordsFirst(below, shown, prompt)].slice(0, ANSWER_SIZE);
  if (rows.length === 0) return null;
  const count = (label: SoundAnswerLabel): number => rows.filter((r) => r.label === label).length;
  const confidentShown = count('matched');
  const weakShown = count('weak match');
  const kind: SoundAnswerKind = confidentShown > 0 ? 'match' : weakShown > 0 ? 'weak' : 'nearest';
  return { kind, rows, confident: confidentShown, weak: weakShown };
}
