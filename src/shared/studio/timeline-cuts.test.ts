// Assistant timeline read §2 (docs/studio/ASSISTANT_TIMELINE_DESIGN.md): the one
// model of the master track's joins, cuts and gaps that get_timeline, the cuts
// line in "State of the edit" and the cut anchor all share.
import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioTimeline, StudioTrack } from '../types/studio';
import { formatTimelineTc, masterTimelineModel, summarizeMasterCuts, timelineLength } from './timeline-cuts';

const A = 'asset-e3v';

function clip(id: string, start: number, duration: number, extra: Partial<StudioClip> = {}): StudioClip {
  return { id, kind: 'video', assetId: A, timelineStart: start, duration, sourceIn: 0, ...extra };
}

function track(id: string, kind: StudioTrack['kind'], clips: StudioClip[], extra: Partial<StudioTrack> = {}): StudioTrack {
  return { id, kind, name: id.toUpperCase(), clips, ...extra };
}

/** The e3v-whoosh project: V1 = e3v-c1 0–3 s src 0–3, e3v-c2 3–6 s src 4–7; A1 empty. */
function twoClip(): StudioTimeline {
  return {
    tracks: [
      track('v1', 'video', [clip('e3v-c1', 0, 3, { sourceIn: 0 }), clip('e3v-c2', 3, 3, { sourceIn: 4 })]),
      track('a1', 'audio', []),
    ],
  };
}

const v1 = (clips: StudioClip[]): StudioTimeline => ({ tracks: [track('v1', 'video', clips)] });

describe('masterTimelineModel — joins, cuts, gaps', () => {
  it('the 2-clip project has one cut at 3.00 (left e3v-c1, right e3v-c2)', () => {
    const m = masterTimelineModel(twoClip());
    expect(m?.track.id).toBe('v1');
    expect(m?.clips.map((c) => c.id)).toEqual(['e3v-c1', 'e3v-c2']);
    expect(m?.cuts).toHaveLength(1);
    expect(m?.cuts[0]).toMatchObject({ n: 1, time: 3 });
    expect(m?.cuts[0].left.id).toBe('e3v-c1');
    expect(m?.cuts[0].right.id).toBe('e3v-c2');
    expect(m?.gaps).toEqual([]);
  });

  it('a split with continuous source is a join, not a cut', () => {
    const m = masterTimelineModel(v1([clip('c1', 0, 3, { sourceIn: 0 }), clip('c2', 3, 3, { sourceIn: 3 })]));
    expect(m?.joins).toEqual([expect.objectContaining({ time: 3, rightIndex: 1, cut: null })]);
    expect(m?.cuts).toEqual([]);
  });

  it('a split of one image is not a cut', () => {
    const img = (id: string, start: number) => clip(id, start, 2, { kind: 'image', assetId: 'still', sourceIn: undefined });
    const m = masterTimelineModel(v1([img('i1', 0), img('i2', 2)]));
    expect(m?.joins).toHaveLength(1);
    expect(m?.cuts).toEqual([]);
  });

  it('a join with a transitionOut is a cut even with continuous source', () => {
    const m = masterTimelineModel(
      v1([clip('c1', 0, 3, { sourceIn: 0, transitionOut: { kind: 'cross-dissolve', duration: 0.5 } }), clip('c2', 3, 3, { sourceIn: 3 })]),
    );
    expect(m?.cuts).toHaveLength(1);
    expect(m?.cuts[0]).toMatchObject({ n: 1, time: 3 });
  });

  it('a 0.5 s gap is a gap, not a cut, and it is counted', () => {
    const tl = v1([clip('c1', 0, 3), clip('c2', 3.5, 3, { sourceIn: 4 })]);
    const m = masterTimelineModel(tl);
    expect(m?.cuts).toEqual([]);
    expect(m?.joins).toEqual([]);
    expect(m?.gaps).toEqual([{ start: 3, end: 3.5, beforeIndex: 1 }]);
    expect(summarizeMasterCuts(tl)).toEqual({ trackName: 'V1', clipCount: 2, gapCount: 1, cuts: [] });
  });

  it('a first clip that starts late makes a leading gap', () => {
    const m = masterTimelineModel(v1([clip('c1', 1, 3)]));
    expect(m?.gaps).toEqual([{ start: 0, end: 1, beforeIndex: 0 }]);
    // within JOIN_EPS of 0 is no gap
    expect(masterTimelineModel(v1([clip('c1', 0.001, 3)]))?.gaps).toEqual([]);
  });

  it('an overlap is a cut at the right clip’s start', () => {
    const m = masterTimelineModel(v1([clip('c1', 0, 3), clip('c2', 2.5, 3, { sourceIn: 6 })]));
    expect(m?.cuts).toHaveLength(1);
    expect(m?.cuts[0]).toMatchObject({ n: 1, time: 2.5 });
  });

  it('clips are taken in timelineStart order, and cuts number 1, 2, … over the whole timeline', () => {
    const m = masterTimelineModel(v1([clip('c3', 6, 3, { sourceIn: 20 }), clip('c1', 0, 3), clip('c2', 3, 3, { sourceIn: 10 })]));
    expect(m?.clips.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(m?.cuts.map((c) => [c.n, c.time, c.left.id, c.right.id])).toEqual([
      [1, 3, 'c1', 'c2'],
      [2, 6, 'c2', 'c3'],
    ]);
  });

  it('the master is the LAST non-empty video track', () => {
    const tl: StudioTimeline = {
      tracks: [
        track('v2', 'video', [clip('top1', 0, 2), clip('top2', 2, 2, { sourceIn: 9 })]),
        track('v1', 'video', [clip('base1', 0, 5)]),
        track('v3', 'video', []),
        track('a1', 'audio', [clip('aud', 0, 5, { kind: 'audio' })]),
      ],
    };
    const m = masterTimelineModel(tl);
    expect(m?.track.id).toBe('v1');
    expect(m?.cuts).toEqual([]);
  });

  it('the first non-empty audio track is the master when no video track has clips', () => {
    const tl: StudioTimeline = {
      tracks: [
        track('v1', 'video', []),
        track('a1', 'audio', []),
        track('a2', 'audio', [clip('vo1', 0, 4, { kind: 'audio', assetId: 'vo' }), clip('vo2', 4, 4, { kind: 'audio', assetId: 'vo', sourceIn: 9 })]),
        track('a3', 'audio', [clip('bed', 0, 8, { kind: 'audio', assetId: 'bed' })]),
      ],
    };
    const m = masterTimelineModel(tl);
    expect(m?.track.id).toBe('a2');
    expect(m?.cuts.map((c) => c.time)).toEqual([4]);
  });

  it('TSX clips on the master make cuts', () => {
    const tsx = (id: string, start: number): StudioClip => ({
      id, kind: 'tsx', timelineStart: start, duration: 2, tsx: { shotId: 'title', mode: 'cutaway' },
    });
    const m = masterTimelineModel(v1([clip('c1', 0, 3), tsx('t1', 3), tsx('t2', 5), clip('c2', 7, 3, { sourceIn: 3 })]));
    expect(m?.cuts.map((c) => c.time)).toEqual([3, 5, 7]);
  });

  it('equal speeds with continuous source join; unequal speeds cut', () => {
    const fast = (id: string, start: number, sourceIn: number, speed: number) => clip(id, start, 2, { sourceIn, speed });
    expect(masterTimelineModel(v1([fast('c1', 0, 0, 2), fast('c2', 2, 4, 2)]))?.cuts).toEqual([]);
    expect(masterTimelineModel(v1([fast('c1', 0, 0, 2), fast('c2', 2, 4, 1)]))?.cuts).toHaveLength(1);
    // speed 1 vs undefined is equal
    expect(masterTimelineModel(v1([clip('c1', 0, 2, { speed: 1 }), clip('c2', 2, 2, { sourceIn: 2 })]))?.cuts).toEqual([]);
  });

  it('another asset or another kind at a join is a cut', () => {
    expect(masterTimelineModel(v1([clip('c1', 0, 3), clip('c2', 3, 3, { sourceIn: 3, assetId: 'other' })]))?.cuts).toHaveLength(1);
    expect(masterTimelineModel(v1([clip('c1', 0, 3), clip('c2', 3, 3, { sourceIn: 3, kind: 'audio' })]))?.cuts).toHaveLength(1);
  });

  it('an empty timeline (or one with no video / audio clips) has no master', () => {
    expect(masterTimelineModel({ tracks: [] })).toBeNull();
    expect(masterTimelineModel({ tracks: [track('v1', 'video', []), track('a1', 'audio', [])] })).toBeNull();
    expect(summarizeMasterCuts({ tracks: [track('v1', 'video', [])] })).toBeUndefined();
  });
});

describe('summarizeMasterCuts', () => {
  it('the 2-clip project: V1, 2 clips, no gap, one cut at 3', () => {
    expect(summarizeMasterCuts(twoClip())).toEqual({ trackName: 'V1', clipCount: 2, gapCount: 0, cuts: [3] });
  });
});

describe('timelineLength', () => {
  it('is the largest end over every clip of every track', () => {
    const tl = twoClip();
    expect(timelineLength(tl)).toBe(6);
    tl.tracks.push(track('o1', 'overlay', [clip('ov', 5, 4, { kind: 'image' })]));
    expect(timelineLength(tl)).toBe(9);
    expect(timelineLength({ tracks: [] })).toBe(0);
  });
});

describe('formatTimelineTc', () => {
  it('prints M:SS.ss, rounding to the centisecond', () => {
    expect(formatTimelineTc(0)).toBe('0:00.00');
    expect(formatTimelineTc(3)).toBe('0:03.00');
    expect(formatTimelineTc(59.996)).toBe('1:00.00');
    expect(formatTimelineTc(125.5)).toBe('2:05.50');
    expect(formatTimelineTc(3600)).toBe('60:00.00');
    expect(formatTimelineTc(-1)).toBe('0:00.00');
    expect(formatTimelineTc(2.75)).toBe('0:02.75');
  });
});
