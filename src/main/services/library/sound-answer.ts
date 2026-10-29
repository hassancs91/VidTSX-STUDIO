// E3 fix round 4 (E-d16 + E-d16a): WHICH library sounds generate_sfx / generate_music show the model
// instead of generating — the answer-level recall fill. Pure: a `rankLibrarySounds()` ranking in (pass a
// `limit` that keeps every candidate), at most three labelled rows out. The matcher (`sound-match.ts`)
// is not changed by this: it still decides what MATCHES; this file decides what is SHOWN.
//
// The rows: first the CONFIDENT matches (coverage ≥ 0.5), in the matcher's own order; then the remaining
// slots from the below-threshold sounds — WEAK matches (a head-rule match under 0.5) and CLOSEST
// candidates (coverage > 0, not a match) together — by coverage, a closest before a weak match on a tie
// (coverages compared with an epsilon), and within one label the matcher's order. So a right clip the
// head rule passed over ("a cracked screen" → break-glass-crack beside power-down) is in front of the
// model, and an exact-0.5 or tied first ("a breaking screen" → power-down) brings the break clips along.
//
// The answer's kind follows the rows the model SEES: a `matched` row → 'match' ("The library already
// has …"); else a `weak match` row → 'weak' (the library "may have" the sound); else 'nearest' (fix
// round 3's "No library sound matched … well"). No row at all → null: a TRUE miss, the tool generates.

import type { SoundMatch, SoundRanking } from './sound-match';

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

/** The rows the tool shows for a ranking, or null when nothing scored (a TRUE miss). */
export function selectSoundAnswer(ranking: SoundRanking): SoundAnswer | null {
  const confident: SoundAnswerRow[] = [];
  const below: SoundAnswerRow[] = [];
  for (const match of ranking.matches) {
    const label = labelOfMatch(match);
    (label === 'matched' ? confident : below).push({ match, label });
  }
  for (const match of ranking.nearest) below.push({ match, label: 'closest' });
  below.sort(byCoverageClosestFirst);

  const rows = [...confident, ...below].slice(0, ANSWER_SIZE);
  if (rows.length === 0) return null;
  const count = (label: SoundAnswerLabel): number => rows.filter((r) => r.label === label).length;
  const confidentShown = count('matched');
  const weakShown = count('weak match');
  const kind: SoundAnswerKind = confidentShown > 0 ? 'match' : weakShown > 0 ? 'weak' : 'nearest';
  return { kind, rows, confident: confidentShown, weak: weakShown };
}
