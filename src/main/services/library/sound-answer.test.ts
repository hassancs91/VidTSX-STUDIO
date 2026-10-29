// E3 fix round 4 (E-d16 + E-d16a + E-d16b) — the pure selection of the THREE library sounds generate_sfx /
// generate_music answer: the confident matches (coverage ≥ 0.5) first in the matcher's order, then the
// below-threshold sounds — weak matches and closest candidates together — where (E-d16b) a sound covering a
// prompt word no shown confident row covers goes ahead of the rest, each group by coverage with a closest
// before a weak match on a tie (epsilon compare). Synthetic rankings here; the real matcher over the 51-clip
// fixture is in agent-tools/audio-tools-fill.test.ts, sound-answer-words.test.ts and the corpus files.
import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { SoundMatch, SoundRanking } from './sound-match';
import { COVERAGE_EPSILON, labelOfMatch, selectSoundAnswer } from './sound-answer';

function sm(id: string, coverage: number, placementHits = 0, text: { tags?: string[]; description?: string } = {}): SoundMatch {
  const entry: LibraryIndexEntry = { relPath: `sfx/${id}.mp3`, origin: 'imported', addedAt: '2026-10-29T00:00:00.000Z', kind: 'audio', ...text };
  return { entry, coverage, strongHits: 1, placementHits };
}
const tagged = (id: string, coverage: number, ...tags: string[]): SoundMatch => sm(id, coverage, 0, { tags });
const ranking = (matches: SoundMatch[], nearest: SoundMatch[] = []): SoundRanking => ({ matches, nearest });
/** No prompt words → the E-d16b rule has nothing to diversify: the E-d16a order. */
const shown = (r: SoundRanking, prompt = ''): string[] =>
  (selectSoundAnswer(r, prompt)?.rows ?? []).map((row) => `${row.label}:${row.match.entry.relPath.slice(4, -4)}`);

describe('selectSoundAnswer — the answer-level recall fill (E-d16 + E-d16a)', () => {
  it('nothing scores → null (a TRUE miss: the tool generates)', () => {
    expect(selectSoundAnswer(ranking([], []), 'a dog bark')).toBeNull();
  });

  it('three or more confident matches → the first three, all `matched`, in the matcher\'s order (not re-sorted by coverage)', () => {
    const r = ranking([sm('a', 0.6, 2), sm('b', 0.7), sm('c', 0.5), sm('d', 0.9)], [sm('n', 0.4)]);
    expect(shown(r)).toEqual(['matched:a', 'matched:b', 'matched:c']);
    const answer = selectSoundAnswer(r, '');
    expect(answer?.kind).toBe('match');
    expect(answer?.confident).toBe(3);
    expect(answer?.weak).toBe(0);
  });

  it('a weak match (a head-rule match under 0.5) and closest candidates fill by coverage → `weak` (the "may have" answer)', () => {
    // "a cracked screen" at 7967c6f: power-down weak 0.43, break-glass-crack 0.34, pop-reveal / scan-hum 0.26
    const r = ranking([sm('power-down', 0.4294)], [sm('break-glass-crack', 0.3424), sm('pop-reveal', 0.2576), sm('scan-hum', 0.2576)]);
    expect(shown(r)).toEqual(['weak match:power-down', 'closest:break-glass-crack', 'closest:pop-reveal']);
    expect(selectSoundAnswer(r, '')?.kind).toBe('weak');
    expect(selectSoundAnswer(r, '')?.weak).toBe(1);
  });

  it('E-d16a "a breaking screen": power-down at exactly 0.50 stays matched; both break clips (closest 0.30) beat the two weak 0.30 matches on the tie', () => {
    const r = ranking(
      [sm('power-down', 0.5), sm('pop-reveal', 0.3), sm('scan-hum', 0.3)],
      [sm('break-crash-digital', 0.3), sm('break-glass-crack', 0.3), sm('crunch-bite', 0.18)],
    );
    expect(shown(r)).toEqual(['matched:power-down', 'closest:break-crash-digital', 'closest:break-glass-crack']);
    expect(selectSoundAnswer(r, '')?.kind).toBe('match');
    expect(selectSoundAnswer(r, '')?.confident).toBe(1);
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
    expect(selectSoundAnswer(r, '')?.kind).toBe('nearest');
    const r2 = ranking([sm('w1', 0.3), sm('w2', 0.3)], [sm('n1', 0.2)]);
    expect(shown(r2)).toEqual(['weak match:w1', 'weak match:w2', 'closest:n1']);
  });

  it('confident + weak + closest mix: the confident first, then the below-threshold ones by coverage', () => {
    const r = ranking([sm('conf', 0.55), sm('weak', 0.35)], [sm('near', 0.4), sm('near2', 0.1)]);
    expect(shown(r)).toEqual(['matched:conf', 'closest:near', 'weak match:weak']);
    expect(selectSoundAnswer(r, '')).toMatchObject({ kind: 'match', confident: 1, weak: 1 });
  });

  it('a pure miss (nearest only) → `nearest`, at most three `closest` rows', () => {
    const r = ranking([], [sm('a', 0.49), sm('b', 0.2), sm('c', 0.2), sm('d', 0.1)]);
    expect(shown(r)).toEqual(['closest:a', 'closest:b', 'closest:c']);
    expect(selectSoundAnswer(r, '')).toMatchObject({ kind: 'nearest', confident: 0, weak: 0 });
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

describe('selectSoundAnswer — the word-diversity rule (E-d16b)', () => {
  // "a sparkling screen" at 7967c6f (fixture text, abridged): power-down covers `screen` (tag) only; pop-reveal covers both
  // words through its DESCRIPTION ("a tiny subtle sparkle … on screen"); scan-hum covers `screen` only; sparkle-soft `sparkling`.
  const sparkling = (): SoundRanking => ranking(
    [tagged('power-down', 0.5294, 'screen', 'device'), sm('pop-reveal', 0.4902, 0, { tags: ['pop', 'reveal'], description: 'A gentle pop with a tiny subtle sparkle for content on screen.' }),
      sm('scan-hum', 0.3203, 0, { tags: ['scan', 'hum'], description: 'A scanner passing over a screen.' })],
    [tagged('sparkle-soft', 0.2786, 'sparkle', 'twinkle'), tagged('chime-magic', 0.1672, 'chime', 'magic')],
  );

  it('the diversity order: a below row covering a word no shown confident row covers goes ahead of rows that only repeat covered words', () => {
    // E-d16a alone: power-down | pop-reveal | scan-hum — no sparkle at all. E-d16b: scan-hum repeats `screen` → behind both carriers.
    expect(shown(sparkling())).toEqual(['matched:power-down', 'weak match:pop-reveal', 'weak match:scan-hum']);
    expect(shown(sparkling(), 'a sparkling screen')).toEqual(['matched:power-down', 'weak match:pop-reveal', 'closest:sparkle-soft']);
    // the same rows when the prompt has no uncovered word: E-d16a's order
    expect(shown(sparkling(), 'a screen')).toEqual(['matched:power-down', 'weak match:pop-reveal', 'weak match:scan-hum']);
    expect(selectSoundAnswer(sparkling(), 'a sparkling screen')).toMatchObject({ kind: 'match', confident: 1, weak: 1 });
  });

  it('a description hit covers a word (any field, any strength): a shown row whose text carries every word leaves E-d16a\'s order', () => {
    // power-down's description "one soft click" covers `clicking` → nothing is uncovered → no reorder (the "a clicking screen" limit)
    const r = ranking(
      [sm('power-down', 0.71, 0, { tags: ['screen'], description: 'one soft click followed by a descending whine' }), tagged('pop-reveal', 0.33, 'pop')],
      [tagged('ui-click-soft', 0.29, 'click', 'ui')],
    );
    expect(shown(r, 'a clicking screen')).toEqual(['matched:power-down', 'weak match:pop-reveal', 'closest:ui-click-soft']);
    const r2 = ranking([...r.matches, tagged('scan-hum', 0.33, 'scan')], r.nearest);
    expect(shown(r2, 'a clicking screen')).toEqual(['matched:power-down', 'weak match:pop-reveal', 'weak match:scan-hum']);
  });

  it('a tie inside a group keeps E-d16a\'s rule (a closest before a weak match) — in the new-word group and in the rest', () => {
    const r = ranking(
      [tagged('conf', 0.6, 'screen'), tagged('w-screen', 0.45, 'screen'), tagged('w-click', 0.3, 'click')],
      [tagged('n-screen', 0.45, 'screen'), tagged('n-click', 0.3, 'click')],
    );
    expect(shown(r, 'a clicking screen')).toEqual(['matched:conf', 'closest:n-click', 'weak match:w-click']);
    const r2 = ranking([r.matches[0], r.matches[1]], r.nearest);
    expect(shown(r2, 'a clicking screen')).toEqual(['matched:conf', 'closest:n-click', 'closest:n-screen']);
  });

  it('the confident rows are untouched: kept first in the matcher\'s order, and three of them leave no slot', () => {
    const two = ranking([tagged('c1', 0.7, 'screen'), tagged('c2', 0.55, 'screen')], [tagged('n-screen', 0.48, 'screen'), tagged('n-click', 0.3, 'click')]);
    expect(shown(two, 'a clicking screen')).toEqual(['matched:c1', 'matched:c2', 'closest:n-click']);
    const three = ranking([tagged('c1', 0.6, 'screen'), tagged('c2', 0.9, 'screen'), tagged('c3', 0.5, 'screen')], [tagged('n-click', 0.45, 'click')]);
    expect(shown(three, 'a clicking screen')).toEqual(['matched:c1', 'matched:c2', 'matched:c3']);
  });

  it('every prompt word already covered → E-d16a\'s order unchanged', () => {
    const r = ranking([tagged('both', 0.8, 'click', 'screen'), tagged('w', 0.4, 'screen')], [tagged('n2', 0.4, 'screen'), tagged('n', 0.3, 'click')]);
    expect(shown(r, 'a clicking screen')).toEqual(['matched:both', 'closest:n2', 'weak match:w']);
    expect(shown(r, 'a clicking screen')).toEqual(shown(r));
  });

  it('no confident row → E-d16a\'s order (every scoring row covers some word, so nothing is reordered)', () => {
    const r = ranking([tagged('power-down', 0.4294, 'screen')], [tagged('pop-reveal', 0.3, 'screen'), tagged('scan-hum', 0.29, 'screen'), tagged('break-glass-crack', 0.2, 'crack')]);
    expect(shown(r, 'a cracked screen')).toEqual(['weak match:power-down', 'closest:pop-reveal', 'closest:scan-hum']);
  });

  it('placement words never count as prompt words (`promptTerms` bonus): a clip naming only a placement word is not a new-word row', () => {
    const r = ranking([tagged('conf', 0.6, 'screen'), tagged('w', 0.45, 'screen')], [tagged('n-click', 0.3, 'click')]);
    expect(shown(r, 'a clicking screen')).toEqual(['matched:conf', 'closest:n-click', 'weak match:w']);
    expect(shown(r, 'a screen when the slide changes')).toEqual(['matched:conf', 'weak match:w', 'closest:n-click']);
    const slide = ranking([tagged('conf', 0.6, 'screen'), tagged('w', 0.45, 'screen')], [tagged('n-slide', 0.3, 'slide')]);
    expect(shown(slide, 'a screen when the slide changes')).toEqual(['matched:conf', 'weak match:w', 'closest:n-slide']);
  });
});
