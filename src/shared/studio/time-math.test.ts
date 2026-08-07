import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '../types/studio';
import {
  spanToFrames,
  timeToFrame,
  timelineDuration,
  timelineDurationInFrames,
} from './time-math';

describe('spanToFrames (cumulative rounding)', () => {
  it('converts a whole-second span exactly', () => {
    expect(spanToFrames(0, 2, 30)).toBe(60);
  });

  it('never returns a negative count', () => {
    expect(spanToFrames(5, 4, 30)).toBe(0);
  });

  it('tiles adjacent spans with no gaps or overlaps', () => {
    const fps = 30;
    // Cut points that all land off-grid — the case naive per-clip rounding
    // (round(duration * fps)) gets wrong.
    const cuts = [0, 0.517, 1.049, 1.983, 2.4, 3.716];
    let frames = 0;
    for (let i = 0; i < cuts.length - 1; i++) {
      frames += spanToFrames(cuts[i], cuts[i + 1], fps);
    }
    expect(frames).toBe(timeToFrame(cuts[cuts.length - 1], fps));
  });

  it('does not accumulate drift across 100 cuts', () => {
    const fps = 30;
    const cuts = [0];
    // Irrational-ish increments so every edge rounds independently.
    for (let i = 1; i <= 100; i++) cuts.push(cuts[i - 1] + 0.7333 + (i % 7) * 0.031);

    let sum = 0;
    let naive = 0;
    for (let i = 0; i < cuts.length - 1; i++) {
      sum += spanToFrames(cuts[i], cuts[i + 1], fps);
      naive += Math.round((cuts[i + 1] - cuts[i]) * fps);
    }
    const exact = timeToFrame(cuts[cuts.length - 1], fps);

    expect(sum).toBe(exact);
    // Guard the reason this helper exists: the naive route does drift.
    expect(Math.abs(naive - exact)).toBeGreaterThan(0);
  });
});

describe('timelineDuration', () => {
  const timeline: StudioTimeline = {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'a', kind: 'video', timelineStart: 0, duration: 4 },
          { id: 'b', kind: 'video', timelineStart: 4, duration: 2.5 },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        name: 'A1',
        clips: [{ id: 'c', kind: 'audio', timelineStart: 1, duration: 9 }],
      },
    ],
  };

  it('takes the last occupied second across all tracks', () => {
    expect(timelineDuration(timeline)).toBe(10);
    expect(timelineDurationInFrames(timeline, 30)).toBe(300);
  });

  it('reports at least one frame for an empty timeline', () => {
    expect(timelineDurationInFrames({ tracks: [] }, 30)).toBe(1);
  });
});
