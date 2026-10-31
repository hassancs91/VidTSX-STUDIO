import { describe, it, expect } from 'vitest';
import type { StudioCutPlan } from '@shared/types/studio-cut-plan';
import type { StudioProposal, StudioTimeline } from '@shared/types/studio';
import {
  buildCutProposal,
  cutItemDragBounds,
  mapCutItemToTimeline,
  MIN_CUT_SPAN,
} from './cut-proposal';

/** 20 s source: keeps [1,5], [8,12], [14.5,19] → cuts at both ends + between. */
function makePlan(overrides: Partial<StudioCutPlan> = {}): StudioCutPlan {
  return {
    version: 1,
    assetId: 'asset1',
    createdAt: '2026-08-11T00:00:00.000Z',
    styleName: 'tight',
    style: {
      internalGap: 0.4,
      head: 0.11,
      minTail: 0.14,
      maxTail: 0.4,
      margin: 5,
      softGap: 1.2,
      softMaxTail: 0.6,
      softMargin: 3,
    },
    transcript: {},
    segments: [
      { start: 1, end: 5, speechStart: 1.11, speechEnd: 4.8, soft: false },
      { start: 8, end: 12, speechStart: 8.11, speechEnd: 11.8, soft: false },
      { start: 14.5, end: 19, speechStart: 14.61, speechEnd: 18.8, soft: true },
    ],
    internalPauses: [],
    stats: {
      sourceDuration: 20,
      keptDuration: 12.5,
      removedDuration: 7.5,
      atomCount: 3,
      wordCount: 30,
      internalPauseCount: 0,
      noiseFloorDb: -48,
    },
    qaNotes: ['1 tail landed at max length'],
    ...overrides,
  };
}

describe('buildCutProposal', () => {
  it("carries the plan's QA readout with every item stamped with the asset (B3)", () => {
    const qa = {
      hardEntries: 1,
      clippedTails: 1,
      joinsChecked: 3,
      atomsChecked: 3,
      items: [
        { kind: 'hard-entry' as const, sourceTime: 8, overDb: 16.2 },
        { kind: 'clipped-tail' as const, sourceTime: 5.1, wordEnd: 4.8, overDb: 7 },
      ],
    };
    const proposal = buildCutProposal({ plan: makePlan({ qa }), words: [] });
    expect(proposal.qa).toMatchObject({ hardEntries: 1, clippedTails: 1, joinsChecked: 3, atomsChecked: 3 });
    expect(proposal.qa?.items.map((i) => [i.kind, i.sourceTime, i.assetId])).toEqual([
      ['hard-entry', 8, 'asset1'],
      ['clipped-tail', 5.1, 'asset1'],
    ]);
  });

  it('a cut whose join the QA hears as a hard entry is built unchecked with its reason; the rest stay accepted (B7)', () => {
    const qa = {
      hardEntries: 1,
      clippedTails: 0,
      joinsChecked: 3,
      atomsChecked: 3,
      items: [{ kind: 'hard-entry' as const, sourceTime: 8, overDb: 16.2 }],
    };
    const proposal = buildCutProposal({ plan: makePlan({ qa }), words: [] });
    expect(proposal.items.map((i) => [i.sourceEnd, i.status])).toEqual([
      [1, 'accepted'],
      [8, 'rejected'],
      [14.5, 'accepted'],
      [20, 'accepted'],
    ]);
    expect(proposal.items[1].qaFlag).toEqual({ kind: 'hard-entry', sourceTime: 8, overDb: 16.2 });
    expect(proposal.agentNote).toContain('1 cut starts unchecked');
  });

  it('a plan over the timeline keeps proposes only inside them and its headline counts only what it removes now (B7)', () => {
    // An applied cut already removed 6–10 s: the timeline keeps [0,6] and [10,20].
    const plan = makePlan({
      keeps: [
        { start: 0, end: 6 },
        { start: 10, end: 20 },
      ],
      segments: [
        { start: 1, end: 5, speechStart: 1.11, speechEnd: 4.8, soft: false },
        { start: 10.5, end: 12, speechStart: 10.61, speechEnd: 11.8, soft: false },
        { start: 14.5, end: 19, speechStart: 14.61, speechEnd: 18.8, soft: true },
      ],
    });
    const proposal = buildCutProposal({ plan, words: [] });
    expect(proposal.items.map((i) => [i.sourceStart, i.sourceEnd])).toEqual([
      [0, 1],
      [5, 6],
      [10, 10.5],
      [12, 14.5],
      [19, 20],
    ]);
    // 1 + 1 + 0.5 + 2.5 + 1 = 6.0 s removed of the 16.0 s still on the timeline (not "of 20.0").
    expect((proposal.agentNote ?? '').split('\n')[0]).toContain('−6.0 s of 16.0 s');
  });

  it('a plan whose keeps hold no segment proposes the whole keep, and a segment past a keep is clipped to it (B7)', () => {
    const plan = makePlan({
      keeps: [
        { start: 2, end: 4 },
        { start: 9, end: 13 },
      ],
      segments: [{ start: 8.5, end: 12, speechStart: 9.1, speechEnd: 11.8, soft: false }],
    });
    const proposal = buildCutProposal({ plan, words: [] });
    expect(proposal.items.map((i) => [i.sourceStart, i.sourceEnd])).toEqual([
      [2, 4],
      [12, 13],
    ]);
    expect((proposal.agentNote ?? '').split('\n')[0]).toContain('−3.0 s of 6.0 s');
  });

  it('a pre-B3 plan (no qa) makes a proposal without a qa field', () => {
    const proposal = buildCutProposal({ plan: makePlan(), words: [] });
    expect('qa' in proposal).toBe(false);
  });

  it('inverts keeps into cut spans, including leading and trailing silence', () => {
    const proposal = buildCutProposal({ plan: makePlan(), words: [] });
    expect(proposal.items.map((i) => [i.sourceStart, i.sourceEnd])).toEqual([
      [0, 1],
      [5, 8],
      [12, 14.5],
      [19, 20],
    ]);
    expect(proposal.kind).toBe('cut-plan');
    expect(proposal.status).toBe('proposed');
    // B4: every item keeps the planner's span beside the one a drag rewrites.
    expect(proposal.items.map((i) => i.snapped)).toEqual([
      { sourceStart: 0, sourceEnd: 1 },
      { sourceStart: 5, sourceEnd: 8 },
      { sourceStart: 12, sourceEnd: 14.5 },
      { sourceStart: 19, sourceEnd: 20 },
    ]);
  });

  it('starts every item accepted — review is veto-based', () => {
    const proposal = buildCutProposal({ plan: makePlan(), words: [] });
    expect(proposal.items.every((i) => i.status === 'accepted')).toBe(true);
  });

  it('labels short gaps long_pause and big gaps dead_air', () => {
    const proposal = buildCutProposal({ plan: makePlan(), words: [] });
    const byGap = Object.fromEntries(
      proposal.items.map((i) => [`${i.sourceStart}`, i.category]),
    );
    expect(byGap['0']).toBe('long_pause'); // 1 s
    expect(byGap['5']).toBe('dead_air'); // 3 s
    expect(byGap['12']).toBe('dead_air'); // 2.5 s
    expect(byGap['19']).toBe('long_pause'); // 1 s
  });

  it('skips gaps below the minimum span', () => {
    const plan = makePlan({
      segments: [
        { start: 0, end: 5, speechStart: 0, speechEnd: 5, soft: false },
        { start: 5.02, end: 20, speechStart: 5.02, speechEnd: 20, soft: false },
      ],
    });
    const proposal = buildCutProposal({ plan, words: [] });
    expect(proposal.items).toHaveLength(0);
    expect(0.02).toBeLessThan(MIN_CUT_SPAN);
  });

  it('captures word context: neighbours in the note, swallowed words in text', () => {
    const words = [
      { text: 'setup.', start: 4.4, end: 4.8 },
      { text: 'um', start: 6.0, end: 6.2 },
      { text: 'Now', start: 8.11, end: 8.4 },
    ];
    const proposal = buildCutProposal({ plan: makePlan(), words });
    const item = proposal.items.find((i) => i.sourceStart === 5)!;
    expect(item.note).toBe('…setup. [3.0 s] Now…');
    expect(item.text).toBe('um');
  });

  it('writes an honest headline plus the plan QA notes into agentNote', () => {
    const proposal = buildCutProposal({ plan: makePlan(), words: [], engine: 'assemblyai' });
    const lines = proposal.agentNote!.split('\n');
    expect(lines[0]).toContain('Auto Cut (tight)');
    expect(lines[0]).toContain('assemblyai');
    expect(lines[0]).toContain('−7.5 s of 20.0 s');
    expect(lines[1]).toBe('1 tail landed at max length');
  });

  it('names the resolved style in the headline when the plan carries it (B2)', () => {
    const plan = { ...makePlan(), styleDisplayName: 'natural · preset “Shorts”' };
    const headline = buildCutProposal({ plan, words: [] }).agentNote!.split('\n')[0];
    expect(headline).toContain('Auto Cut (natural · preset “Shorts”)');
  });
});

describe('mapCutItemToTimeline', () => {
  const timeline: StudioTimeline = {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', kind: 'video', assetId: 'asset1', timelineStart: 0, duration: 5, sourceIn: 0 },
          { id: 'c2', kind: 'video', assetId: 'asset1', timelineStart: 5, duration: 5, sourceIn: 10 },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        name: 'A1',
        clips: [{ id: 'm1', kind: 'audio', assetId: 'music', timelineStart: 0, duration: 30 }],
      },
    ],
  };

  it('maps a source span through sourceIn into timeline seconds', () => {
    const regions = mapCutItemToTimeline(timeline, {
      id: 'x',
      status: 'accepted',
      assetId: 'asset1',
      sourceStart: 11,
      sourceEnd: 12,
    });
    expect(regions).toEqual([
      { itemId: 'x', trackId: 'v1', clipId: 'c2', start: 6, end: 7 },
    ]);
  });

  it('yields nothing for spans no clip plays (already trimmed away)', () => {
    const regions = mapCutItemToTimeline(timeline, {
      id: 'x',
      status: 'accepted',
      assetId: 'asset1',
      sourceStart: 6,
      sourceEnd: 9,
    });
    expect(regions).toEqual([]);
  });

  it('splits a span that crosses clips into one region per clip', () => {
    const regions = mapCutItemToTimeline(timeline, {
      id: 'x',
      status: 'accepted',
      assetId: 'asset1',
      sourceStart: 4,
      sourceEnd: 11,
    });
    expect(regions).toEqual([
      { itemId: 'x', trackId: 'v1', clipId: 'c1', start: 4, end: 5 },
      { itemId: 'x', trackId: 'v1', clipId: 'c2', start: 5, end: 6 },
    ]);
  });
});

describe('cutItemDragBounds', () => {
  const proposal: StudioProposal = {
    id: 'p',
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: '',
    items: [
      { id: 'a', status: 'accepted', assetId: 'asset1', sourceStart: 2, sourceEnd: 3 },
      { id: 'b', status: 'accepted', assetId: 'asset1', sourceStart: 8, sourceEnd: 10 },
      { id: 'c', status: 'accepted', assetId: 'asset1', sourceStart: 15, sourceEnd: 16 },
    ],
  };

  it('clamps edges to the neighbouring cuts and the source ends', () => {
    const bounds = cutItemDragBounds(proposal, 'b', 20)!;
    expect(bounds.minStart).toBe(3); // previous cut's end
    expect(bounds.maxEnd).toBe(15); // next cut's start
    expect(bounds.maxStart).toBeCloseTo(10 - MIN_CUT_SPAN);
    expect(bounds.minEnd).toBeCloseTo(8 + MIN_CUT_SPAN);
  });

  it('uses the source ends when there is no neighbour', () => {
    const bounds = cutItemDragBounds(proposal, 'a', 20)!;
    expect(bounds.minStart).toBe(0);
    const last = cutItemDragBounds(proposal, 'c', 20)!;
    expect(last.maxEnd).toBe(20);
  });
});
