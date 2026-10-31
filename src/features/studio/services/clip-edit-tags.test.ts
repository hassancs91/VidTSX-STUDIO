import { describe, expect, it } from 'vitest';
import { withEdgeTag } from '@shared/studio';
import { collectCutLearnJoins } from '@shared/studio/cut-learn-joins';
import { TEST_NATURAL_STYLE } from '@shared/studio/cut-style-test-fixtures';
import type { StudioClip, StudioProposal, StudioProposalItem, StudioTimeline } from '../types';
import { timelineReducer, type TimelineAction } from '../hooks/useTimeline';
import { setProposalItemSpan } from './proposal-ops';
import { planTextDelete } from './text-delete';
import { splitClip } from './timeline-ops';
import { buildTranscriptDoc } from './transcript-doc';
import { ASSET, makeEnvelope, makeTimeline, master, wordSource } from './text-edit-fixtures';

// B4 "the learning signal": user trims and Transcript deletes tag the clip
// edges they place; ops that rewrite an edge drop its tag; proposal drags keep
// the snapped span beside the final one.

const FRAME = { width: 1920, height: 1080 };

function fresh(timeline: StudioTimeline) {
  return timelineReducer(
    {
      projectId: null,
      past: [],
      present: { timeline: { tracks: [] }, proposals: [], shots: [], captions: null, removedAssets: [], frame: FRAME },
      future: [],
    },
    { type: 'reset', projectId: 'p', timeline, proposals: [], shots: [], captions: null, frame: FRAME },
  );
}
type State = ReturnType<typeof fresh>;
const run = (state: State, ...actions: TimelineAction[]) => actions.reduce(timelineReducer, state);
const clipOf = (s: State | StudioTimeline, id: string): StudioClip => {
  const timeline = 'present' in s ? s.present.timeline : s;
  return master(timeline).find((c) => c.id === id)!;
};

/** V1 plays a1 0–3 (A, placed by an applied cut plan) then a1 4–8 (B, no origin): one join. */
function twoClips(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'A', kind: 'video', assetId: 'a1', timelineStart: 0, duration: 3, sourceIn: 0, origin: { by: 'agent', proposalId: 'p1' } },
          { id: 'B', kind: 'video', assetId: 'a1', timelineStart: 3, duration: 4, sourceIn: 4 },
        ],
      },
    ],
  };
}

describe('user trims tag the edge they move', () => {
  it('tags the moved edge, keeps who placed the clip, and undo restores the untagged clip', () => {
    const s = run(fresh(twoClips()), { type: 'trim', clipId: 'A', edge: 'end', seconds: 2.8 });
    expect(clipOf(s, 'A').duration).toBeCloseTo(2.8, 9);
    expect(clipOf(s, 'A').origin).toEqual({ by: 'agent', proposalId: 'p1', op: 'trim', edges: { end: 'trim' } });
    expect(clipOf(s, 'B').origin).toBeUndefined();
    const undone = run(s, { type: 'undo' });
    expect(clipOf(undone, 'A').origin).toEqual({ by: 'agent', proposalId: 'p1' });
    expect(clipOf(undone, 'A').duration).toBe(3);
  });

  it('a clip with no origin becomes a user clip; a start trim tags the start only', () => {
    const s = run(fresh(twoClips()), { type: 'trim', clipId: 'B', edge: 'start', seconds: 3.25 });
    expect(clipOf(s, 'B').sourceIn).toBeCloseTo(4.25, 9);
    expect(clipOf(s, 'B').origin).toEqual({ by: 'user', op: 'trim', edges: { start: 'trim' } });
  });

  it('a trim the neighbour blocks moves nothing and tags nothing', () => {
    const s = run(fresh(twoClips()), { type: 'trim', clipId: 'A', edge: 'end', seconds: 3.5 });
    expect(clipOf(s, 'A').duration).toBe(3);
    expect(clipOf(s, 'A').origin).toEqual({ by: 'agent', proposalId: 'p1' });
  });

  it('a ripple-all trim tags the edge as well', () => {
    const s = run(fresh(twoClips()), { type: 'trim', clipId: 'A', edge: 'end', seconds: 2.5, rippleAllTracks: true });
    expect(clipOf(s, 'B').timelineStart).toBeCloseTo(2.5, 9);
    expect(clipOf(s, 'A').origin?.edges).toEqual({ end: 'trim' });
  });

  it('both sides of a join trimmed → ONE learnable join with both edges touched', () => {
    const s = run(
      fresh(twoClips()),
      { type: 'trim', clipId: 'A', edge: 'end', seconds: 2.8 },
      { type: 'trim', clipId: 'B', edge: 'start', seconds: 3.2 },
    );
    const joins = collectCutLearnJoins(s.present.timeline, []);
    expect(joins).toHaveLength(1);
    expect(joins[0]).toMatchObject({ assetId: 'a1', tailTouched: true, headTouched: true, source: 'trim', ref: 'A|B' });
    expect(joins[0].tailEdge).toBeCloseTo(2.8, 9);
    expect(joins[0].headEdge).toBeCloseTo(4.2, 9);
  });
});

describe('ops that rewrite an edge drop its tag', () => {
  const tagged = (): StudioTimeline => {
    const timeline = twoClips();
    const a = timeline.tracks[0].clips[0];
    timeline.tracks[0].clips[0] = withEdgeTag(withEdgeTag(a, 'start', 'trim'), 'end', 'trim');
    return timeline;
  };

  it('a split hands each half only the edge it keeps', () => {
    const split = splitClip(tagged(), 'A', 1.5, 'A2');
    expect(clipOf(split, 'A').origin).toEqual({ by: 'agent', proposalId: 'p1', op: 'trim', edges: { start: 'trim' } });
    expect(clipOf(split, 'A2').origin).toEqual({ by: 'agent', proposalId: 'p1', op: 'trim', edges: { end: 'trim' } });
  });

  it('a range delete through the clip keeps only the outer edges tagged', () => {
    const s = run(fresh(tagged()), { type: 'remove-span', from: 1, to: 2, allTracks: false });
    const [left, right] = master(s.present.timeline).filter((c) => c.sourceIn !== undefined && c.sourceIn < 4);
    expect(left.origin?.edges).toEqual({ start: 'trim' });
    expect(right.origin?.edges).toEqual({ end: 'trim' });
  });
});

describe('Transcript deletes tag the edges they create', () => {
  function textDelete(state: State, pick: (text: string) => boolean): State {
    const timeline = state.present.timeline;
    const doc = buildTranscriptDoc(timeline, wordSource());
    const plan = planTextDelete({
      timeline,
      tokens: doc.tokens.filter((t) => pick(t.text)),
      words: wordSource(),
      envelopes: new Map([['a1', makeEnvelope()]]),
      assets: [ASSET],
      style: TEST_NATURAL_STYLE,
    });
    return run(state, { type: 'text-delete', spans: plan.spans, allTracks: false });
  }

  it("tags 'text-delete' (not a sample); a later trim of the edge is one; undo walks back", () => {
    const deleted = textDelete(fresh(makeTimeline()), (text) => text === 'um');
    const [left, right] = master(deleted.present.timeline);
    expect(left.id).toBe('c1');
    expect(left.origin).toEqual({ by: 'user', op: 'text-delete', edges: { end: 'text-delete' } });
    expect(right.origin).toEqual({ by: 'user', op: 'text-delete', edges: { start: 'text-delete' } });
    expect(collectCutLearnJoins(deleted.present.timeline, [])).toEqual([]);

    const end = left.timelineStart + left.duration;
    const trimmed = run(deleted, { type: 'trim', clipId: 'c1', edge: 'end', seconds: end - 0.05 });
    expect(clipOf(trimmed, 'c1').origin).toEqual({ by: 'user', op: 'trim', edges: { end: 'trim' } });
    const joins = collectCutLearnJoins(trimmed.present.timeline, []);
    expect(joins).toHaveLength(1);
    expect(joins[0]).toMatchObject({ tailTouched: true, headTouched: false, source: 'trim' });

    const back = run(trimmed, { type: 'undo' });
    expect(clipOf(back, 'c1').origin?.edges).toEqual({ end: 'text-delete' });
    const untouched = run(back, { type: 'undo' });
    expect(master(untouched.present.timeline)).toHaveLength(1);
    expect(clipOf(untouched, 'c1').origin).toBeUndefined();
  });

  it('a restore rejoins the two edges and drops their tags', () => {
    const deleted = textDelete(fresh(makeTimeline()), (text) => text === 'um');
    const [left, right] = master(deleted.present.timeline);
    const restored = run(deleted, {
      type: 'text-restore',
      beforeClipId: left.id,
      afterClipId: right.id,
      newClipId: 'back',
      allTracks: false,
    });
    expect(master(restored.present.timeline)).toHaveLength(3);
    expect(clipOf(restored, left.id).origin).toEqual({ by: 'user', op: 'text-delete' });
    expect(clipOf(restored, right.id).origin).toEqual({ by: 'user', op: 'text-delete' });
  });
});

describe('setProposalItemSpan keeps the snapped span', () => {
  const proposal = (item: StudioProposalItem): StudioProposal[] => [
    { id: 'p', kind: 'cut-plan', status: 'proposed', createdAt: '2026-10-22T00:00:00.000Z', items: [item] },
  ];
  const base: StudioProposalItem = { id: 'i', status: 'accepted', assetId: 'a1', sourceStart: 1, sourceEnd: 2 };
  const drag = (ps: StudioProposal[], start: number, end: number) => setProposalItemSpan(ps, 'p', 'i', start, end);

  it('writes the pre-drag span on the first drag and never changes it after', () => {
    const once = drag(proposal(base), 0.9, 2);
    expect(once[0].items[0]).toMatchObject({ sourceStart: 0.9, sourceEnd: 2, adjusted: true, snapped: { sourceStart: 1, sourceEnd: 2 } });
    const twice = drag(once, 0.8, 2.1);
    expect(twice[0].items[0]).toMatchObject({ sourceStart: 0.8, sourceEnd: 2.1, snapped: { sourceStart: 1, sourceEnd: 2 } });
  });

  it("keeps a creator's snapped span; an item adjusted before B4 gets none", () => {
    const created = drag(proposal({ ...base, snapped: { sourceStart: 1.1, sourceEnd: 1.9 } }), 0.9, 2);
    expect(created[0].items[0].snapped).toEqual({ sourceStart: 1.1, sourceEnd: 1.9 });
    const old = drag(proposal({ ...base, adjusted: true }), 0.9, 2);
    expect('snapped' in old[0].items[0]).toBe(false);
  });

  it('a drag that lands where it started changes nothing', () => {
    const ps = proposal(base);
    expect(drag(ps, 1, 2)[0].items[0]).toBe(ps[0].items[0]);
  });
});
