import { describe, expect, it } from 'vitest';
import {
  concatListText,
  createProxyProgress,
  isManifestReusable,
  pendingSegments,
  planSegments,
  segmentFileName,
  segmentSeconds,
  type SegmentPlanManifest,
} from './proxy-segments';

describe('planSegments', () => {
  it('unknown duration → one open-ended segment (the old single-pass behaviour)', () => {
    expect(planSegments(0)).toEqual([{ index: 0, startSec: 0, durationSec: null, fileName: 'seg-0000.mp4' }]);
    expect(planSegments(Number.NaN)).toHaveLength(1);
  });

  it('anything up to one window is a single segment', () => {
    expect(planSegments(45)).toHaveLength(1);
    expect(planSegments(60)).toHaveLength(1);
  });

  it('folds a stub tail into the previous window instead of making a 5 s segment', () => {
    const plan = planSegments(65);
    expect(plan).toHaveLength(1);
    expect(plan[0].durationSec).toBeNull();
  });

  it('keeps a tail that is worth its own segment', () => {
    const plan = planSegments(75);
    expect(plan.map((s) => [s.startSec, s.durationSec])).toEqual([
      [0, 60],
      [60, null],
    ]);
  });

  it('the video-2 master (632.18 s) becomes 11 windows, the last open-ended', () => {
    const plan = planSegments(632.18);
    expect(plan).toHaveLength(11);
    expect(plan[0]).toEqual({ index: 0, startSec: 0, durationSec: 60, fileName: 'seg-0000.mp4' });
    expect(plan[10]).toEqual({ index: 10, startSec: 600, durationSec: null, fileName: 'seg-0010.mp4' });
    // Only the final window is open-ended; every other one is exactly the window.
    expect(plan.slice(0, -1).every((s) => s.durationSec === 60)).toBe(true);
  });

  it('honours a custom window (a 10 s tail is kept, a 5 s one is folded)', () => {
    expect(planSegments(100, 30)).toHaveLength(4);
    expect(planSegments(95, 30)).toHaveLength(3);
  });

  it('names sort lexically in index order', () => {
    expect(segmentFileName(7)).toBe('seg-0007.mp4');
    expect(segmentFileName(123)).toBe('seg-0123.mp4');
  });
});

describe('segmentSeconds', () => {
  it('resolves the open-ended tail against the total', () => {
    const plan = planSegments(632.18);
    expect(segmentSeconds(plan[0], 632.18)).toBe(60);
    expect(segmentSeconds(plan[10], 632.18)).toBeCloseTo(32.18, 5);
  });
});

describe('pendingSegments (resume)', () => {
  it('skips whatever is already on disk, in any order', () => {
    const plan = planSegments(200);
    const pending = pendingSegments(plan, ['seg-0002.mp4', 'seg-0000.mp4', 'audio.mp4', 'plan.json']);
    expect(pending.map((s) => s.index)).toEqual([1, 3]);
  });

  it('a fresh folder needs everything', () => {
    expect(pendingSegments(planSegments(200), [])).toHaveLength(4);
  });

  it('ignores a stray .part file — only a renamed, complete segment counts', () => {
    const pending = pendingSegments(planSegments(120), ['seg-0000.mp4.part.mp4']);
    expect(pending.map((s) => s.index)).toEqual([0, 1]);
  });
});

describe('isManifestReusable', () => {
  const expected: SegmentPlanManifest = {
    version: 1,
    profile: 'x264-720p-g15-crf26',
    windowSec: 60,
    sourceBytes: 6_700_000_000,
    sourceMtimeMs: 1_700_000_000_000,
    segmentCount: 11,
  };

  it('accepts an identical manifest', () => {
    expect(isManifestReusable({ ...expected }, expected)).toBe(true);
  });

  it('rejects a different encoder profile — old segments must not be concatenated into a new proxy', () => {
    expect(isManifestReusable({ ...expected, profile: 'x264-540p-g1-crf28' }, expected)).toBe(false);
  });

  it('rejects a source that changed underneath the cache', () => {
    expect(isManifestReusable({ ...expected, sourceBytes: 1 }, expected)).toBe(false);
    expect(isManifestReusable({ ...expected, sourceMtimeMs: 2 }, expected)).toBe(false);
  });

  it('rejects a different window or count, and garbage', () => {
    expect(isManifestReusable({ ...expected, windowSec: 30 }, expected)).toBe(false);
    expect(isManifestReusable({ ...expected, segmentCount: 3 }, expected)).toBe(false);
    expect(isManifestReusable(null, expected)).toBe(false);
    expect(isManifestReusable('nope', expected)).toBe(false);
    expect(isManifestReusable({}, expected)).toBe(false);
  });
});

describe('concatListText', () => {
  it('lists relative names in order, each with its explicit span', () => {
    expect(
      concatListText([
        { fileName: 'seg-0000.mp4', durationSec: 60.0033 },
        { fileName: 'seg-0001.mp4', durationSec: 13.1 },
      ]),
    ).toBe("file 'seg-0000.mp4'\nduration 60.003300\nfile 'seg-0001.mp4'\nduration 13.100000\n");
  });

  it('escapes a single quote the way the concat demuxer wants', () => {
    expect(concatListText([{ fileName: "it's.mp4", durationSec: 1 }])).toBe("file 'it'\\''s.mp4'\nduration 1.000000\n");
  });
});

describe('createProxyProgress', () => {
  const total = 632.18;
  const plan = planSegments(total);

  function capture() {
    const seen: number[] = [];
    return { seen, on: (p: number) => seen.push(p) };
  }

  it('reports an in-flight segment by its own ffmpeg time, against the whole job', () => {
    const { seen, on } = capture();
    const progress = createProxyProgress(plan, total, true, on);
    progress.segmentTick(plan[0], 30);
    // 30 s of ~665 units of work (632 video + 31.6 audio + 1% concat) ≈ 4.5%.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeGreaterThan(4);
    expect(seen[0]).toBeLessThan(5);
  });

  it('segments already on disk from an earlier run count in full immediately', () => {
    const { seen, on } = capture();
    const progress = createProxyProgress(plan, total, false, on);
    for (const s of plan.slice(0, 5)) progress.segmentDone(s);
    // 300 s of 632 s video, no audio, 1% concat reserved → ~47%.
    expect(seen.at(-1)).toBeGreaterThan(46);
    expect(seen.at(-1)).toBeLessThan(48);
  });

  it('never goes backwards when a restarted segment reports from 0 again', () => {
    const { seen, on } = capture();
    const progress = createProxyProgress(plan, total, true, on);
    progress.segmentDone(plan[0]);
    progress.segmentTick(plan[1], 45);
    const before = seen.at(-1)!;
    progress.segmentTick(plan[1], 0); // e.g. a hwaccel fallback re-ran the segment
    progress.segmentTick(plan[1], 10);
    expect(seen.at(-1)).toBe(before);
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1])).toBe(true);
  });

  it('a tick cannot overshoot its segment', () => {
    const { seen, on } = capture();
    const progress = createProxyProgress(plan, total, false, on);
    progress.segmentTick(plan[0], 999);
    const capped = seen.at(-1)!;
    progress.segmentDone(plan[0]);
    expect(seen.at(-1)).toBe(capped);
  });

  it('audio is a small slice and concat is the last 1%; concatDone lands on exactly 100', () => {
    const { seen, on } = capture();
    const progress = createProxyProgress(plan, total, true, on);
    for (const s of plan) progress.segmentDone(s);
    const videoOnly = seen.at(-1)!;
    expect(videoOnly).toBeGreaterThan(93);
    expect(videoOnly).toBeLessThan(95);
    progress.audioTick(total / 2);
    progress.audioDone();
    expect(seen.at(-1)).toBeCloseTo(99, 0);
    progress.concatDone();
    expect(seen.at(-1)).toBe(100);
  });

  it('a done segment ignores late ticks', () => {
    const { seen, on } = capture();
    const progress = createProxyProgress(plan, total, false, on);
    progress.segmentDone(plan[0]);
    const n = seen.length;
    progress.segmentTick(plan[0], 12);
    expect(seen.length).toBe(n);
  });

  it('single open-ended segment (unknown duration) still terminates at 100', () => {
    const { seen, on } = capture();
    const single = planSegments(0);
    const progress = createProxyProgress(single, 0, true, on);
    progress.segmentTick(single[0], 10); // nothing to divide by — no emit
    expect(seen).toHaveLength(0);
    progress.concatDone();
    expect(seen).toHaveLength(0); // total unknown: the caller shows an indeterminate bar
  });
});
