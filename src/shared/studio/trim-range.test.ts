import { describe, it, expect } from 'vitest';
import type { StudioProject, StudioTimeline } from '../types/studio';
import { serializeTimeline } from './serialize';
import { spanToFrames, timeToFrame } from './time-math';
import { rangeDurationInFrames, trimTimelineToRange } from './trim-range';

const FPS = 30;

function base(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'a', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0 },
          {
            id: 'b',
            kind: 'video',
            assetId: 'x',
            timelineStart: 4,
            duration: 4,
            sourceIn: 10,
            fadeInSec: 1,
            fadeOutSec: 1,
          },
          { id: 'c', kind: 'video', assetId: 'x', timelineStart: 8, duration: 4, sourceIn: 20 },
        ],
      },
    ],
    markers: [
      { id: 'm1', time: 1 },
      { id: 'm2', time: 6, label: 'Mid' },
    ],
  };
}

describe('trimTimelineToRange', () => {
  it('drops clips outside the window and re-anchors the rest at 0', () => {
    const next = trimTimelineToRange(base(), 4, 8, FPS);
    const clips = next.tracks[0].clips;
    expect(clips.map((c) => c.id)).toEqual(['b']);
    expect(clips[0].timelineStart).toBe(0);
    expect(clips[0].duration).toBe(4);
    expect(clips[0].sourceIn).toBe(10);
    // Untouched clip keeps its fades — nothing was cut off it.
    expect(clips[0].fadeInSec).toBe(1);
    expect(clips[0].fadeOutSec).toBe(1);
  });

  it('cuts edge-crossing clips like a split: sourceIn advances, edge fades drop', () => {
    const next = trimTimelineToRange(base(), 5, 11, FPS);
    const clips = next.tracks[0].clips;
    expect(clips.map((c) => c.id)).toEqual(['b', 'c']);
    // b lost 1 s of head: starts at 0, plays source from 11, fade-in gone.
    expect(clips[0]).toMatchObject({ timelineStart: 0, duration: 3, sourceIn: 11 });
    expect(clips[0].fadeInSec).toBeUndefined();
    expect(clips[0].fadeOutSec).toBe(1);
    // c lost 1 s of tail: 3..6 in range coords, source untouched.
    expect(clips[1]).toMatchObject({ timelineStart: 3, duration: 3, sourceIn: 20 });
  });

  it('keeps only in-window markers, shifted', () => {
    const next = trimTimelineToRange(base(), 4, 8, FPS);
    expect(next.markers).toEqual([{ id: 'm2', time: 2, label: 'Mid' }]);
    const none = trimTimelineToRange(base(), 2, 5, FPS);
    expect('markers' in none).toBe(false);
  });

  it('snaps off-grid edges to frames so serialized spans tile exactly', () => {
    const timeline = base();
    const rangeIn = 3.517; // off the 30 fps grid on purpose
    const rangeOut = 9.049;
    const next = trimTimelineToRange(timeline, rangeIn, rangeOut, FPS);
    const project: StudioProject = {
      schemaVersion: 1,
      id: 'p',
      name: 'p',
      createdAt: '',
      updatedAt: '',
      settings: { width: 1920, height: 1080, fps: FPS, agent: {} },
      assets: [],
      timeline: next,
      proposals: [],
    };
    const serialized = serializeTimeline(project, () => 'http://x/asset');
    const frames = serialized.tracks[0].clips.reduce((sum, c) => sum + c.durationInFrames, 0);
    // Clips a|b|c cover the whole window, so their frame counts must sum to
    // the window's exact frame length — the §16.7 frame-accuracy contract.
    expect(frames).toBe(rangeDurationInFrames(rangeIn, rangeOut, FPS));
    expect(frames).toBe(spanToFrames(rangeIn, rangeOut, FPS));
  });

  it('is identity on an invalid window', () => {
    const timeline = base();
    expect(trimTimelineToRange(timeline, 5, 5, FPS)).toBe(timeline);
    expect(trimTimelineToRange(timeline, 8, 4, FPS)).toBe(timeline);
    expect(trimTimelineToRange(timeline, Number.NaN, 4, FPS)).toBe(timeline);
  });

  it('clamps a negative rangeIn to 0', () => {
    const next = trimTimelineToRange(base(), -2, 4, FPS);
    expect(next.tracks[0].clips[0]).toMatchObject({ id: 'a', timelineStart: 0, duration: 4 });
  });
});

describe('rangeDurationInFrames', () => {
  it('matches the cumulative-rounding span length', () => {
    expect(rangeDurationInFrames(0, 2, FPS)).toBe(60);
    expect(rangeDurationInFrames(3.517, 9.049, FPS)).toBe(
      timeToFrame(9.049, FPS) - timeToFrame(3.517, FPS),
    );
  });
});
