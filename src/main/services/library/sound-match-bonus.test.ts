// E3 fix round 3 — pins for verifier round 3's uncaught mutations on the placement bonus:
//   MI: the bonus cap dropped (`Math.min(PLACEMENT_BONUS_MAX, …)` → uncapped) — three placement hits must not
//       lift a clip over one with a real coverage lead of more than the cap;
//   MJ: the bonus applied BEFORE the match threshold — a non-match with placement hits stays a non-match.
// The fixtures are built so the numbers sit exactly between the capped and the uncapped bonus.
import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { matchLibrarySounds, nearestLibrarySounds } from './sound-match';

function sfx(id: string, tags: string[], description = ''): LibraryIndexEntry {
  return { relPath: `sfx/${id}.mp3`, origin: 'imported', addedAt: '2026-10-29T00:00:00.000Z', kind: 'audio', tags, description, probe: { duration: 1, hasAudio: true } };
}
const ids = (entries: LibraryIndexEntry[], prompt: string) =>
  matchLibrarySounds(entries, prompt, { soundClass: 'sfx' }).map((m) => m.entry.relPath.replace(/^sfx\/|\.mp3$/g, ''));

describe('the placement bonus (MI, MJ)', () => {
  it('MI — the bonus is capped: three placement hits (0.15 uncapped) never beat a 0.133 coverage lead', () => {
    // A covers click (tag) + tail (tag) = 1.00. B covers click (tag) + tail (description 0.6) = 0.867 and hits
    // all three placement words in its tags: capped +0.10 → 0.967 (second); uncapped +0.15 → 1.017 (first).
    const library = [sfx('b-latch', ['click', 'trap', 'latch', 'shut'], 'a tail'), sfx('a-plain', ['click', 'tail'])];
    const prompt = 'a click with a tail when the trap latch shut';
    const matches = matchLibrarySounds(library, prompt, { soundClass: 'sfx' });
    expect(matches.map((m) => m.entry.relPath)).toEqual(['sfx/a-plain.mp3', 'sfx/b-latch.mp3']);
    expect(matches[1].placementHits).toBe(3);
    expect(matches[1].coverage).toBeCloseTo(0.867, 2);
    expect(matches[0].coverage - matches[1].coverage).toBeGreaterThan(0.1);
  });

  it('MJ — the bonus is applied after the threshold: a 0.43 non-match with three placement hits stays a non-match', () => {
    // Ten candidates: "sharp" on two (idf 1.48), "snap" on one (idf 1.99). B covers sharp only = 0.427 < 0.5 and
    // misses the head word; its three placement hits would add 0.10 → 0.527 if the bonus came before the threshold.
    const fillers = Array.from({ length: 8 }, (_, i) => sfx(`filler-${i}`, [`other-${i}`]));
    const library = [sfx('b-latch', ['sharp', 'trap', 'latch', 'shut']), sfx('a-snap', ['sharp', 'snap']), ...fillers];
    const prompt = 'a sharp snap when the trap latch shut';
    expect(ids(library, prompt)).toEqual(['a-snap']);
    const nearest = nearestLibrarySounds(library, prompt, { soundClass: 'sfx' });
    expect(nearest.map((m) => m.entry.relPath)).toEqual(['sfx/b-latch.mp3']);
    expect(nearest[0].coverage).toBeCloseTo(0.427, 2);
    expect(nearest[0].placementHits).toBe(3);
  });

  it('a true miss scores nothing: no match and no nearest candidate', () => {
    const library = [sfx('whoosh-soft', ['whoosh', 'air']), sfx('ui-click-soft', ['ui', 'click'])];
    expect(ids(library, 'a cuckoo clock chime')).toEqual([]);
    expect(nearestLibrarySounds(library, 'a cuckoo clock chime', { soundClass: 'sfx' })).toEqual([]);
  });
});
