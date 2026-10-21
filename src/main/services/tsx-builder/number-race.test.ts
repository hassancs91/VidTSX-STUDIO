import { describe, expect, it } from 'vitest';
import { checkNumbers, describeNumberCheck, type SweepFrame } from './number-check';
import type { FrameTextItem } from './frame-text';

const piece = { width: 1080, height: 1350 };
const node = (t: string, x: number, y: number, h = 40): FrameTextItem => ({ t, x, y, w: t.length * h * 0.55, h, o: 1 });
/** A number with its unit set as its own node right beside it, as E2 drew "0.25" + "s". */
const withUnit = (value: string, unit: string, x: number, y: number, h = 128): FrameTextItem[] => {
  const n = node(value, x, y, h);
  return [n, node(unit, n.x + n.w + 4, y, h)];
};
const rows = (v: number) => Math.round(v).toLocaleString('en-US');

/** E2's race: the scan's 2 s over f30-150, the index's 2 ms over f30-60; the end state on f0-23, zeros f24-29. */
function e2(frame: number): SweepFrame {
  const scan = frame < 24 ? 1 : frame < 30 ? 0 : Math.min(1, (frame - 30) / 120);
  const steps = frame < 24 ? 20 : frame < 30 ? 0 : Math.min(20, Math.floor((frame - 30) / 1.5));
  return {
    frame,
    items: [
      node(rows(scan * 1_000_000), 60, 525, 128),
      node('ROWS READ', 60, 640, 36),
      ...withUnit((scan * 2).toFixed(2), 's', 713, 525),
      node('50,000× FEWER READS', 370, 696, 36),
      node(String(steps), 60, 1020, 128),
      node('STEPS', 60, 1132, 36),
      ...withUnit((steps * 0.1).toFixed(1), 'ms', 713, 1020),
    ],
  };
}

/** R2's race: the unit inside the node; the scan 2 s over f30-210, the index 0.1 ms every 3 frames to f90. */
function r2(frame: number): SweepFrame {
  const lit = frame < 24 ? 1000 : frame < 30 ? 0 : Math.min(1000, Math.floor(((frame - 30) / 180) * 1000));
  const k = frame < 24 ? 20 : frame < 30 ? 0 : Math.min(20, Math.floor((frame - 30) / 3));
  return {
    frame,
    items: [
      node(`${((lit / 1000) * 2).toFixed(2)} s`, 700, 700, 68),
      node('1000× FASTER', 540, 790, 34),
      node(`${(k * 0.1).toFixed(1)} ms`, 700, 1110, 56),
    ],
  };
}

/** A right 1000× race: one clock at 2 s per 180 frames, so the index's 2 ms is done on its first frame. */
function oneClock(frame: number): SweepFrame {
  const t = frame < 30 ? 2 : Math.min(2, ((frame - 30) / 180) * 2);
  const index = frame < 30 ? 0.002 : Math.min(0.002, t);
  return {
    frame,
    items: [...withUnit(t.toFixed(2), 's', 713, 525), ...withUnit((index * 1000).toFixed(1), 'ms', 713, 1020)],
  };
}

const sweep = (fn: (f: number) => SweepFrame) => Array.from({ length: 240 }, (_, f) => fn(f));

describe('the race check (P5-1)', () => {
  it("calls E2's two clocks a RACE: the motion ~4×, the counters 1,000×", () => {
    const check = checkNumbers(sweep(e2), piece);
    expect(check.ok).toBe(false);
    expect(check.splits).toHaveLength(0);
    expect(check.races).toHaveLength(1);
    expect(check.races[0]).toMatchObject({ slow: '2.00', fast: '2.0' });
    expect(check.races[0].motionRatio).toBeCloseTo(4, 0);
    expect(check.races[0].counterRatio).toBeCloseTo(1000, -1);
  });

  it('reads a unit written inside the node (R2) the same way', () => {
    const check = checkNumbers(sweep(r2), piece);
    expect(check.ok).toBe(false);
    expect(check.races).toHaveLength(1);
    expect(check.races[0]).toMatchObject({ slow: '2.00 s', fast: '2.0 ms' });
  });

  it('passes a race on one clock, where the 1,000× faster side finishes on its first frame', () => {
    const check = checkNumbers(sweep(oneClock), piece);
    expect(check.races).toHaveLength(0);
    expect(check.ok).toBe(true);
  });

  it('passes two time counters at the same rate that stop at different frames', () => {
    const check = checkNumbers(
      sweep((frame) => {
        const t = Math.max(0, frame - 20) * 0.1;
        return { frame, items: [node(`${Math.min(18, t).toFixed(1)} min`, 60, 300), node(`${Math.min(6, t).toFixed(1)} min`, 60, 900)] };
      }),
      piece,
    );
    expect(check.races).toHaveLength(0);
  });

  it('does not compare counters of unlike units (rows against steps)', () => {
    const check = checkNumbers(
      sweep((frame) => {
        const f = Math.max(0, frame - 30);
        return { frame, items: [node(rows(Math.min(1_000_000, f * 8000)), 60, 300), node('ROWS', 400, 300), node(String(Math.min(20, f)), 60, 900), node('STEPS', 400, 900)] };
      }),
      piece,
    );
    expect(check.races).toHaveLength(0);
  });

  it('names both sides, the two ratios, and quotes a fixed ratio badge against the motion (P5-2)', () => {
    const text = describeNumberCheck(checkNumbers(sweep(e2), piece));
    expect(text).toContain('Verdict: RACE.');
    expect(text).toMatch(/"2\.00" runs f30-150 and "2\.0" f3\d-60: the motion says ~4\.\d×, the counters 1,000×/);
    expect(text).toContain('The fixed "50,000× FEWER READS" states the counters\' ratio; the motion shows ~4.1×.');
    expect(text).toContain('ONE clock');
    expect(text).toContain('50,000× FEWER READS". A unit or a given is fine');
  });
});
