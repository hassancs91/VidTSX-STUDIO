import { describe, expect, it } from 'vitest';
import { fuseRankings, RRF_K } from './fuse';

describe('fuseRankings (RRF, K = 60)', () => {
  it('sums 1 / (60 + rank) over the two lists', () => {
    expect(RRF_K).toBe(60);
    const out = fuseRankings(['b', 'a'], [{ relPath: 'a', cosine: 0.9 }, { relPath: 'b', cosine: 0.8 }]);
    expect(out.map((x) => x.relPath)).toEqual(['a', 'b']);
    expect(out[0].score).toBeCloseTo(1 / 61 + 1 / 62, 12);
    expect(out[0]).toMatchObject({ keywordRank: 2, semanticRank: 1, cosine: 0.9 });
  });

  it('keeps items found by one list only (vectors still building, or no prompt word)', () => {
    const out = fuseRankings(['k'], [{ relPath: 's', cosine: 0.5 }]);
    expect(out.map((x) => x.relPath).sort()).toEqual(['k', 's']);
    const k = out.find((x) => x.relPath === 'k');
    const s = out.find((x) => x.relPath === 's');
    expect([k?.keywordRank, k?.semanticRank, k?.cosine]).toEqual([1, undefined, undefined]);
    expect([s?.keywordRank, s?.semanticRank]).toEqual([undefined, 1]);
  });

  it('breaks a tie by the cosine, then by relPath', () => {
    // b and c: ranks (1, 2) and (2, 1) — the same fused score.
    const tie = fuseRankings(['b', 'c'], [{ relPath: 'c', cosine: 0.7 }, { relPath: 'b', cosine: 0.6 }]);
    expect(tie.map((x) => x.relPath)).toEqual(['c', 'b']);
    const tie2 = fuseRankings(['y', 'x'], []);
    expect(fuseRankings(['x'], []).map((r) => r.relPath)).toEqual(['x']);
    expect(tie2.map((x) => x.relPath)).toEqual(['y', 'x']);
    const same = fuseRankings([], [{ relPath: 'q', cosine: 0.5 }, { relPath: 'p', cosine: 0.5 }]);
    expect(same.map((x) => x.relPath)).toEqual(['q', 'p']);
    const exact = fuseRankings(['q', 'p'], [{ relPath: 'p', cosine: 0.5 }, { relPath: 'q', cosine: 0.5 }]);
    expect(exact.map((x) => x.relPath)).toEqual(['p', 'q']);
  });
});
