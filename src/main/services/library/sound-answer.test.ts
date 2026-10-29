// E3 fix round 4 (E-d16 + E-d16a) — the pure selection of the THREE library sounds generate_sfx /
// generate_music answer: the confident matches (coverage ≥ 0.5) first in the matcher's order, then the
// below-threshold sounds — weak matches and closest candidates together — by coverage, a closest before
// a weak match on a tie (epsilon compare). Synthetic rankings here; the real matcher over the 51-clip
// fixture is in agent-tools/audio-tools-fill.test.ts and the corpus files.
import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { SoundMatch, SoundRanking } from './sound-match';
import { COVERAGE_EPSILON, labelOfMatch, selectSoundAnswer } from './sound-answer';

function sm(id: string, coverage: number, placementHits = 0): SoundMatch {
  const entry: LibraryIndexEntry = { relPath: `sfx/${id}.mp3`, origin: 'imported', addedAt: '2026-10-29T00:00:00.000Z', kind: 'audio' };
  return { entry, coverage, strongHits: 1, placementHits };
}
const ranking = (matches: SoundMatch[], nearest: SoundMatch[] = []): SoundRanking => ({ matches, nearest });
const shown = (r: SoundRanking): string[] =>
  (selectSoundAnswer(r)?.rows ?? []).map((row) => `${row.label}:${row.match.entry.relPath.slice(4, -4)}`);

describe('selectSoundAnswer — the answer-level recall fill (E-d16 + E-d16a)', () => {
  it('nothing scores → null (a TRUE miss: the tool generates)', () => {
    expect(selectSoundAnswer(ranking([], []))).toBeNull();
  });

  it('three or more confident matches → the first three, all `matched`, in the matcher\'s order (not re-sorted by coverage)', () => {
    const r = ranking([sm('a', 0.6, 2), sm('b', 0.7), sm('c', 0.5), sm('d', 0.9)], [sm('n', 0.4)]);
    expect(shown(r)).toEqual(['matched:a', 'matched:b', 'matched:c']);
    const answer = selectSoundAnswer(r);
    expect(answer?.kind).toBe('match');
    expect(answer?.confident).toBe(3);
    expect(answer?.weak).toBe(0);
  });

  it('a weak match (a head-rule match under 0.5) and closest candidates fill by coverage → `weak` (the "may have" answer)', () => {
    // "a cracked screen" at 7967c6f: power-down weak 0.43, break-glass-crack 0.34, pop-reveal / scan-hum 0.26
    const r = ranking([sm('power-down', 0.4294)], [sm('break-glass-crack', 0.3424), sm('pop-reveal', 0.2576), sm('scan-hum', 0.2576)]);
    expect(shown(r)).toEqual(['weak match:power-down', 'closest:break-glass-crack', 'closest:pop-reveal']);
    expect(selectSoundAnswer(r)?.kind).toBe('weak');
    expect(selectSoundAnswer(r)?.weak).toBe(1);
  });

  it('E-d16a "a breaking screen": power-down at exactly 0.50 stays matched; both break clips (closest 0.30) beat the two weak 0.30 matches on the tie', () => {
    const r = ranking(
      [sm('power-down', 0.5), sm('pop-reveal', 0.3), sm('scan-hum', 0.3)],
      [sm('break-crash-digital', 0.3), sm('break-glass-crack', 0.3), sm('crunch-bite', 0.18)],
    );
    expect(shown(r)).toEqual(['matched:power-down', 'closest:break-crash-digital', 'closest:break-glass-crack']);
    expect(selectSoundAnswer(r)?.kind).toBe('match');
    expect(selectSoundAnswer(r)?.confident).toBe(1);
  });

  it('a tie is an epsilon compare: a weak match 1e-12 above a closest one still yields to it', () => {
    const r = ranking([sm('chime-reward', 0.3 + 1e-12)], [sm('pencil-scribble', 0.3)]);
    expect(shown(r)).toEqual(['closest:pencil-scribble', 'weak match:chime-reward']);
    expect(COVERAGE_EPSILON).toBeLessThan(1e-6);
    // …but a real gap is not a tie
    expect(shown(ranking([sm('w', 0.31)], [sm('n', 0.3)]))).toEqual(['weak match:w', 'closest:n']);
  });

  it('a closest candidate above a weak match by coverage goes first; ties within one label keep the matcher\'s order', () => {
    const r = ranking([sm('weak-1', 0.32)], [sm('near-a', 0.45), sm('near-b', 0.32), sm('near-c', 0.32)]);
    expect(shown(r)).toEqual(['closest:near-a', 'closest:near-b', 'closest:near-c']);
    // no weak match SHOWN → worded as a pure miss (the kind follows the rows the model sees)
    expect(selectSoundAnswer(r)?.kind).toBe('nearest');
    const r2 = ranking([sm('w1', 0.3), sm('w2', 0.3)], [sm('n1', 0.2)]);
    expect(shown(r2)).toEqual(['weak match:w1', 'weak match:w2', 'closest:n1']);
  });

  it('confident + weak + closest mix: the confident first, then the below-threshold ones by coverage', () => {
    const r = ranking([sm('conf', 0.55), sm('weak', 0.35)], [sm('near', 0.4), sm('near2', 0.1)]);
    expect(shown(r)).toEqual(['matched:conf', 'closest:near', 'weak match:weak']);
    expect(selectSoundAnswer(r)).toMatchObject({ kind: 'match', confident: 1, weak: 1 });
  });

  it('a pure miss (nearest only) → `nearest`, at most three `closest` rows', () => {
    const r = ranking([], [sm('a', 0.49), sm('b', 0.2), sm('c', 0.2), sm('d', 0.1)]);
    expect(shown(r)).toEqual(['closest:a', 'closest:b', 'closest:c']);
    expect(selectSoundAnswer(r)).toMatchObject({ kind: 'nearest', confident: 0, weak: 0 });
  });

  it('fewer than three candidates → only those (never padded)', () => {
    expect(shown(ranking([sm('stream-soft', 0.5)], [sm('dash-zip', 0.3)]))).toEqual(['matched:stream-soft', 'closest:dash-zip']);
    expect(shown(ranking([sm('only', 0.8)]))).toEqual(['matched:only']);
  });

  it('labelOfMatch: ≥ 0.5 is `matched`, a match under it is `weak match` (the matcher\'s own threshold)', () => {
    expect(labelOfMatch(sm('x', 0.5))).toBe('matched');
    expect(labelOfMatch(sm('x', 0.4999))).toBe('weak match');
  });
});
