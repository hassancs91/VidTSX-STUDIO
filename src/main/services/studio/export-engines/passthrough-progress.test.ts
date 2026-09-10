import { describe, expect, it } from 'vitest';
import type { ExportSpan } from '../../../../shared/studio/export-spans';
import { estimateRemainingSeconds, formatRemaining, measuredRates, progressMessage } from './passthrough-progress';

const copy = (from: number, frames: number): ExportSpan =>
  ({ kind: 'copy', from, frames, assetId: 'a', assetPath: 'C:/a.mp4', sourceFrame: from, firstFrameCeil: false }) as ExportSpan;
const browser = (from: number, frames: number): ExportSpan => ({ kind: 'browser', from, frames, reason: 'transition' });

// 15 s copied, a 1 s crossfade window, 14 s copied — the xfade seed's plan.
const spans = [copy(0, 420), browser(420, 30), copy(450, 450)];

describe('measuredRates', () => {
  it('keeps the defaults until a span of that kind has finished', () => {
    expect(measuredRates([], 30)).toEqual({ copyFps: 90, browserFps: 1 });
    expect(measuredRates([{ kind: 'copy', frames: 420, ms: 4000 }], 30)).toEqual({ copyFps: 105, browserFps: 1 });
    expect(measuredRates([{ kind: 'browser', frames: 30, ms: 60000 }], 30).browserFps).toBe(0.5);
  });
});

describe('estimateRemainingSeconds', () => {
  it('charges browser frames at the browser rate and the rest at the copy rate', () => {
    // Nothing done, defaults: 30 browser frames at 1/s + 870 copied at 90/s.
    expect(estimateRemainingSeconds({ spans, index: 0, framesInSpan: 0, done: [], fps: 30 })).toBeCloseTo(30 + 870 / 90, 5);
    // Inside the browser span with 10 frames painted, the first copy measured at 105 fps.
    const done = [{ kind: 'copy' as const, frames: 420, ms: 4000 }];
    expect(estimateRemainingSeconds({ spans, index: 1, framesInSpan: 10, done, fps: 30 })).toBeCloseTo(20 + 450 / 105, 5);
  });
});

describe('progressMessage', () => {
  it('names the copied share, the span in flight within its kind, and the estimate', () => {
    expect(progressMessage({ spans, index: 0, framesInSpan: 210, done: [], fps: 30 })).toBe('Copied 23 % · copying 1 of 2 spans · under a minute left');
    const done = [{ kind: 'copy' as const, frames: 420, ms: 4000 }];
    expect(progressMessage({ spans, index: 1, framesInSpan: 0, done, fps: 30 })).toBe('Copied 46 % · rendering 1 of 1 spans · under a minute left');
    const long = [copy(0, 9000), browser(9000, 900), copy(9900, 9000)];
    expect(progressMessage({ spans: long, index: 1, framesInSpan: 0, done, fps: 30 })).toBe('Copied 47 % · rendering 1 of 1 spans · about 16 min left');
    // The tick after the last span: everything copied counts, nothing is in flight.
    expect(progressMessage({ spans, index: 3, framesInSpan: 0, done, fps: 30 })).toBe('Copied 96 % · under a minute left');
    // A span that just finished counts as copied on its closing tick (index moved past it).
    expect(progressMessage({ spans, index: 1, framesInSpan: 0, done, fps: 30 })).toMatch(/^Copied 46 %/);
  });
});

describe('formatRemaining', () => {
  it('rounds to minutes and hours', () => {
    expect(formatRemaining(59)).toBe('under a minute left');
    expect(formatRemaining(150)).toBe('about 3 min left');
    expect(formatRemaining(3600)).toBe('about 1 h left');
    expect(formatRemaining(5400)).toBe('about 1 h 30 min left');
  });
});
