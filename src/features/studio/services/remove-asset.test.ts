import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioMediaAsset, StudioTimeline } from '../types';
import { timelineReducer, type TimelineAction } from '../hooks/useTimeline';

// Reducer integration for feedback item 6: removing media from the pool is
// ONE undo step that carries the asset snapshot, so undo brings back the
// asset (via the sync effect) together with its clips.

function asset(id: string): StudioMediaAsset {
  return {
    id,
    kind: 'video',
    path: `C:\\footage\\${id}.mp4`,
    probe: { duration: 10, width: 1920, height: 1080, fps: 30, hasAudio: true },
  };
}

function clip(id: string, assetId: string, timelineStart: number): StudioClip {
  return { id, kind: 'video', assetId, timelineStart, duration: 1, sourceIn: 0 };
}

function timeline(): StudioTimeline {
  return {
    tracks: [
      { id: 'v1', kind: 'video', name: 'V1', clips: [clip('c1', 'raw', 0), clip('c2', 'other', 1), clip('c3', 'raw', 2)] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [{ ...clip('m1', 'raw', 0), kind: 'audio' }] },
    ],
  };
}

function fresh() {
  return timelineReducer(
    {
      projectId: null,
      past: [],
      present: { timeline: { tracks: [] }, proposals: [], shots: [], captions: null, removedAssets: [] },
      future: [],
    },
    { type: 'reset', projectId: 'p', timeline: timeline(), proposals: [], shots: [], captions: null },
  );
}

function dispatch(state: ReturnType<typeof fresh>, ...actions: TimelineAction[]) {
  return actions.reduce(timelineReducer, state);
}

const clipIds = (s: ReturnType<typeof fresh>) =>
  s.present.timeline.tracks.map((t) => t.clips.map((c) => c.id));

describe('remove-asset', () => {
  it('drops every clip playing the asset on every track and records the snapshot, one undo step', () => {
    const s0 = fresh();
    const s1 = dispatch(s0, { type: 'remove-asset', asset: asset('raw'), index: 0 });
    expect(clipIds(s1)).toEqual([['c2'], []]);
    expect(s1.present.removedAssets).toEqual([{ asset: asset('raw'), index: 0 }]);
    expect(s1.past).toHaveLength(1);

    const s2 = dispatch(s1, { type: 'undo' });
    expect(clipIds(s2)).toEqual([['c1', 'c2', 'c3'], ['m1']]);
    expect(s2.present.removedAssets).toEqual([]);

    const s3 = dispatch(s2, { type: 'redo' });
    expect(clipIds(s3)).toEqual([['c2'], []]);
    expect(s3.present.removedAssets.map((r) => r.asset.id)).toEqual(['raw']);
  });

  it('an unused asset still commits (undo can bring it back) and a repeat is a no-op', () => {
    const s0 = fresh();
    const s1 = dispatch(s0, { type: 'remove-asset', asset: asset('unused'), index: 3 });
    expect(s1.present.timeline).toBe(s0.present.timeline);
    expect(s1.present.removedAssets).toEqual([{ asset: asset('unused'), index: 3 }]);
    expect(s1.past).toHaveLength(1);
    expect(dispatch(s1, { type: 'remove-asset', asset: asset('unused'), index: 3 })).toBe(s1);
  });

  it('reset clears the removed list', () => {
    const s1 = dispatch(fresh(), { type: 'remove-asset', asset: asset('raw'), index: 0 });
    const s2 = timelineReducer(s1, {
      type: 'reset',
      projectId: 'q',
      timeline: timeline(),
      proposals: [],
      shots: [],
      captions: null,
    });
    expect(s2.present.removedAssets).toEqual([]);
  });
});
