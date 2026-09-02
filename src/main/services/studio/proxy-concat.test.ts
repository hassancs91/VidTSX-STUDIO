import { describe, expect, it } from 'vitest';
import { planConcatEntries, videoOffsetSec, type MediaTiming } from './proxy-concat';
import { planSegments } from './proxy-segments';

const timing = (startSec: number, durationSec: number): MediaTiming => ({
  startSec,
  durationSec,
  videoStartSec: null,
  audioStartSec: null,
});

describe('planConcatEntries', () => {
  it("each file's span is the distance to the next file's first frame; the last uses its own duration", () => {
    const plan = planSegments(200);
    // Segments cut at 60 s windows of a 59.94 fps source start on the first
    // frame at or after the cut, which is not exactly on the window edge.
    const entries = planConcatEntries(plan, [
      timing(0, 60.0033),
      timing(60.01, 60.01),
      timing(120.0033, 60.0033),
      timing(180.013, 19.99),
    ]);
    expect(entries.map((e) => e.fileName)).toEqual(['seg-0000.mp4', 'seg-0001.mp4', 'seg-0002.mp4', 'seg-0003.mp4']);
    expect(entries.map((e) => e.durationSec)).toEqual([60.01, 120.0033 - 60.01, 180.013 - 120.0033, 19.99]);
  });

  it('refuses a plan and timing list that disagree in length', () => {
    expect(() => planConcatEntries(planSegments(200), [timing(0, 60)])).toThrow(/mismatch/);
  });

  it('refuses a non-positive span (a segment that ended up empty or out of order)', () => {
    const plan = planSegments(120);
    expect(() => planConcatEntries(plan, [timing(60, 60), timing(60, 60)])).toThrow(/non-positive/);
  });
});

describe('videoOffsetSec', () => {
  it('is zero when the streams start together, or when either start is unknown', () => {
    expect(videoOffsetSec({ ...timing(0, 1), videoStartSec: 0, audioStartSec: 0 })).toBe(0);
    expect(videoOffsetSec({ ...timing(0, 1), videoStartSec: 0.0005, audioStartSec: 0 })).toBe(0);
    expect(videoOffsetSec(timing(0, 1))).toBe(0);
  });

  it('is the video-minus-audio start when they differ by more than a millisecond', () => {
    expect(videoOffsetSec({ ...timing(0, 1), videoStartSec: 0.05, audioStartSec: 0 })).toBeCloseTo(0.05, 9);
    expect(videoOffsetSec({ ...timing(0, 1), videoStartSec: 0, audioStartSec: 0.02 })).toBeCloseTo(-0.02, 9);
  });
});
