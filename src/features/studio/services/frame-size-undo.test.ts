import { describe, expect, it } from 'vitest';
import { timelineReducer, type TimelineAction } from '../hooks/useTimeline';
import { setFrameSize } from './project-format';
import type { StudioClip, StudioTimeline } from '../types';

// A1: Project settings → Frame size is one Ctrl+Z step on the same history as
// the timeline, so an undo after a size change puts the old size back.

const FRAME = { width: 1920, height: 1080 };

function timeline(): StudioTimeline {
  const clip: StudioClip = { id: 'c1', kind: 'video', assetId: 'a1', timelineStart: 0, duration: 4, sourceIn: 0 };
  return { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [clip] }] };
}

function fresh() {
  return timelineReducer(
    {
      projectId: null,
      past: [],
      present: { timeline: { tracks: [] }, proposals: [], shots: [], captions: null, removedAssets: [], frame: FRAME },
      future: [],
    },
    { type: 'reset', projectId: 'p', timeline: timeline(), proposals: [], shots: [], captions: null, frame: FRAME },
  );
}

const run = (state: ReturnType<typeof fresh>, ...actions: TimelineAction[]) => actions.reduce(timelineReducer, state);

describe('setFrameSize (pure)', () => {
  it('returns a new frame for a usable change and the same object otherwise', () => {
    expect(setFrameSize(FRAME, 3840, 2160)).toEqual({ width: 3840, height: 2160 });
    expect(setFrameSize(FRAME, 1920, 1080)).toBe(FRAME);
    for (const [w, h] of [[1921, 1080], [8, 1080], [7682, 2160], [1920.5, 1080], [Number.NaN, 1080]]) {
      expect(setFrameSize(FRAME, w, h)).toBe(FRAME);
    }
  });
});

describe('set-frame-size in the timeline reducer (A1)', () => {
  it('is one undo step, and redo puts the new size back', () => {
    const s1 = run(fresh(), { type: 'set-frame-size', width: 3840, height: 2160 });
    expect(s1.present.frame).toEqual({ width: 3840, height: 2160 });
    expect(s1.past).toHaveLength(1);
    const s2 = run(s1, { type: 'undo' });
    expect(s2.present.frame).toEqual(FRAME);
    expect(s2.past).toHaveLength(0);
    expect(run(s2, { type: 'redo' }).present.frame).toEqual({ width: 3840, height: 2160 });
  });

  it('records no step for an unchanged or unusable size', () => {
    const s0 = fresh();
    expect(run(s0, { type: 'set-frame-size', width: 1920, height: 1080 })).toBe(s0);
    expect(run(s0, { type: 'set-frame-size', width: 1919, height: 1080 })).toBe(s0);
  });

  it('interleaves with timeline edits on one history and survives them untouched', () => {
    const s = run(
      fresh(),
      { type: 'set-frame-size', width: 1080, height: 1920 },
      { type: 'split', clipId: 'c1', seconds: 2 },
    );
    expect(s.past).toHaveLength(2);
    expect(s.present.frame).toEqual({ width: 1080, height: 1920 });
    expect(s.present.timeline.tracks[0].clips).toHaveLength(2);
    const undoSplit = run(s, { type: 'undo' });
    expect(undoSplit.present.frame).toEqual({ width: 1080, height: 1920 });
    expect(undoSplit.present.timeline.tracks[0].clips).toHaveLength(1);
    expect(run(undoSplit, { type: 'undo' }).present.frame).toEqual(FRAME);
  });

  it('a reset adopts the opened project size and clears the history', () => {
    const s = run(fresh(), { type: 'set-frame-size', width: 3840, height: 2160 }, {
      type: 'reset', projectId: 'q', timeline: timeline(), proposals: [], shots: [], captions: null, frame: { width: 1080, height: 1080 },
    });
    expect(s.present.frame).toEqual({ width: 1080, height: 1080 });
    expect(s.past).toHaveLength(0);
  });
});
