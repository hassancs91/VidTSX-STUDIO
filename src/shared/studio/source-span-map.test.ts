// The shared source-span → timeline-regions mapping (ASSISTANT_TIMELINE_DESIGN
// §6, §8.1 7): the renderer's `mapCutItemToTimeline` core, moved so the cut
// anchor checks a candidate against exactly what apply will do.
import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '../types/studio';
import { mapSourceSpanToTimeline } from './source-span-map';

const timeline: StudioTimeline = {
  tracks: [
    {
      id: 'v1',
      kind: 'video',
      name: 'V1',
      clips: [
        { id: 'c2', kind: 'video', assetId: 'asset1', timelineStart: 5, duration: 5, sourceIn: 10 },
        { id: 'c1', kind: 'video', assetId: 'asset1', timelineStart: 0, duration: 5, sourceIn: 0 },
      ],
    },
    {
      id: 'a1',
      kind: 'audio',
      name: 'A1',
      clips: [
        { id: 'l1', kind: 'audio', assetId: 'asset1', timelineStart: 5, duration: 5, sourceIn: 10 },
        { id: 'm1', kind: 'audio', assetId: 'music', timelineStart: 0, duration: 30 },
      ],
    },
  ],
};

describe('mapSourceSpanToTimeline', () => {
  it('maps a span through sourceIn on every track that plays the asset, ordered by start then track id', () => {
    expect(mapSourceSpanToTimeline(timeline, { assetId: 'asset1', sourceStart: 11, sourceEnd: 12 })).toEqual([
      { trackId: 'a1', clipId: 'l1', start: 6, end: 7 },
      { trackId: 'v1', clipId: 'c2', start: 6, end: 7 },
    ]);
  });

  it('splits a span across clips, in timeline order', () => {
    expect(mapSourceSpanToTimeline(timeline, { assetId: 'asset1', sourceStart: 4, sourceEnd: 11 })).toEqual([
      { trackId: 'v1', clipId: 'c1', start: 4, end: 5 },
      { trackId: 'a1', clipId: 'l1', start: 5, end: 6 },
      { trackId: 'v1', clipId: 'c2', start: 5, end: 6 },
    ]);
  });

  it('a span no clip plays (trimmed away), a touching edge, another asset → nothing', () => {
    expect(mapSourceSpanToTimeline(timeline, { assetId: 'asset1', sourceStart: 6, sourceEnd: 9 })).toEqual([]);
    expect(mapSourceSpanToTimeline(timeline, { assetId: 'asset1', sourceStart: 5, sourceEnd: 5.0000001 })).toEqual([]);
    expect(mapSourceSpanToTimeline(timeline, { assetId: 'nope', sourceStart: 0, sourceEnd: 30 })).toEqual([]);
  });

  it('a clip with no sourceIn plays from source 0', () => {
    expect(mapSourceSpanToTimeline(timeline, { assetId: 'music', sourceStart: 2, sourceEnd: 3.5 })).toEqual([
      { trackId: 'a1', clipId: 'm1', start: 2, end: 3.5 },
    ]);
  });
});
