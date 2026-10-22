// B4 — which joins did the user touch? Trims (tagged clip edges) pair into
// joins on the master lane; dragged proposal edges count while the timeline
// still has them untrimmed; Transcript-delete edges and old data teach nothing.

import { describe, it, expect } from 'vitest';
import { clipLearnJoins, collectCutLearnJoins, proposalLearnJoins } from './cut-learn-joins';
import type { StudioClip, StudioClipOrigin, StudioProposal, StudioProposalItem } from '../types/studio';

function clip(id: string, assetId: string, timelineStart: number, sourceIn: number, duration: number, edges?: StudioClipOrigin['edges']): StudioClip {
  return {
    id,
    kind: 'video',
    assetId,
    timelineStart,
    duration,
    sourceIn,
    ...(edges ? { origin: { by: 'agent', proposalId: 'p0', op: 'trim', edges } } : {}),
  };
}

function cutPlan(items: StudioProposalItem[], status: StudioProposal['status'] = 'applied'): StudioProposal {
  return { id: 'p1', kind: 'cut-plan', status, createdAt: '2026-10-22T00:00:00Z', items };
}

function item(id: string, final: [number, number], snapped?: [number, number], status: StudioProposalItem['status'] = 'accepted'): StudioProposalItem {
  return {
    id,
    status,
    assetId: 'A',
    sourceStart: final[0],
    sourceEnd: final[1],
    ...(snapped ? { snapped: { sourceStart: snapped[0], sourceEnd: snapped[1] }, adjusted: true } : {}),
  };
}

describe('clipLearnJoins', () => {
  it('pairs two same-source neighbours into one join and keeps only the trimmed edges', () => {
    const joins = clipLearnJoins([
      clip('c2', 'A', 4, 10, 3, { start: 'trim' }),
      clip('c1', 'A', 0, 0, 4, { end: 'trim' }),
    ]);
    expect(joins).toEqual([
      { assetId: 'A', tailEdge: 4, headEdge: 10, tailTouched: true, headTouched: true, source: 'trim', ref: 'c1|c2' },
    ]);
  });

  it('a join with one trimmed side measures that side only; untouched joins are skipped', () => {
    const joins = clipLearnJoins([
      clip('c1', 'A', 0, 0, 4, { end: 'trim' }),
      clip('c2', 'A', 4, 10, 3),
      clip('c3', 'A', 7, 20, 2),
    ]);
    expect(joins).toEqual([
      { assetId: 'A', tailEdge: 4, headEdge: 10, tailTouched: true, headTouched: false, source: 'trim', ref: 'c1|c2' },
    ]);
  });

  it('different sources are not one join: each trimmed edge stands alone', () => {
    const joins = clipLearnJoins([
      clip('c1', 'A', 0, 0, 4, { end: 'trim' }),
      clip('c2', 'B', 4, 10, 3, { start: 'trim' }),
    ]);
    expect(joins).toEqual([
      { assetId: 'A', tailEdge: 4, tailTouched: true, headTouched: false, source: 'trim', ref: 'c1' },
      { assetId: 'B', headEdge: 10, tailTouched: false, headTouched: true, source: 'trim', ref: 'c2' },
    ]);
  });

  it('Transcript-delete edges were placed by the style: no sample', () => {
    expect(
      clipLearnJoins([
        clip('c1', 'A', 0, 0, 4, { end: 'text-delete' }),
        clip('c2', 'A', 4, 10, 3, { start: 'text-delete' }),
      ]),
    ).toEqual([]);
  });

  it('a clip with speed maps its end through the source', () => {
    const joins = clipLearnJoins([{ ...clip('c1', 'A', 0, 2, 4, { end: 'trim' }), speed: 1.5 }]);
    expect(joins[0].tailEdge).toBe(8);
  });
});

describe('proposalLearnJoins', () => {
  // After applying a cut of [4, 10]: the master lane keeps [0, 4] and [10, 13].
  const lane = [clip('c1', 'A', 0, 0, 4), clip('c2', 'A', 4, 10, 3)];

  it('a dragged edge (final ≠ snapped) still on the timeline is touched; the other edge is not', () => {
    const joins = proposalLearnJoins([cutPlan([item('i1', [4, 10], [3.8, 10])])], lane);
    expect(joins).toEqual([
      { assetId: 'A', tailEdge: 4, headEdge: 10, tailTouched: true, headTouched: false, source: 'proposal', ref: 'i1' },
    ]);
  });

  it('an undragged item, an item without `snapped` (made before B4), a rejected item or an unapplied plan teach nothing', () => {
    expect(proposalLearnJoins([cutPlan([item('i1', [4, 10], [4, 10])])], lane)).toEqual([]);
    expect(proposalLearnJoins([cutPlan([item('i1', [4, 10])])], lane)).toEqual([]);
    expect(proposalLearnJoins([cutPlan([item('i1', [4, 10], [3.8, 10], 'rejected')])], lane)).toEqual([]);
    expect(proposalLearnJoins([cutPlan([item('i1', [4, 10], [3.8, 10])], 'proposed')], lane)).toEqual([]);
  });

  it('a later trim of that edge supersedes the drag; an edge the timeline lost is stale', () => {
    const trimmed = [clip('c1', 'A', 0, 0, 4, { end: 'trim' }), clip('c2', 'A', 4, 10, 3)];
    expect(proposalLearnJoins([cutPlan([item('i1', [4, 10], [3.8, 10])])], trimmed)).toEqual([]);
    const moved = [clip('c1', 'A', 0, 0, 3.5), clip('c2', 'A', 3.5, 10, 3)];
    expect(proposalLearnJoins([cutPlan([item('i1', [4, 10], [3.8, 10])])], moved)).toEqual([]);
  });
});

describe('collectCutLearnJoins', () => {
  it('reads the master lane: the trim sample once, not again from the proposal', () => {
    const timeline = {
      tracks: [{ id: 'v1', kind: 'video' as const, name: 'V1', clips: [clip('c1', 'A', 0, 0, 4.1, { end: 'trim' }), clip('c2', 'A', 4.1, 10, 3)] }],
    };
    const joins = collectCutLearnJoins(timeline, [cutPlan([item('i1', [4, 10], [3.8, 10])])]);
    expect(joins.map((j) => [j.source, j.tailEdge, j.tailTouched])).toEqual([['trim', 4.1, true]]);
  });
});
