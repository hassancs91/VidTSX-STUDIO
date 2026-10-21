import { describe, expect, it } from 'vitest';
import { checkNumbers, describeNumberCheck, numberShape, numbersDiffer, numberTracks, type SweepFrame } from './number-check';
import type { FrameTextItem } from './frame-text';

const piece = { width: 1080, height: 1350 };
const node = (t: string, x: number, y: number, h = 40): FrameTextItem => ({ t, x, y, w: t.length * h * 0.55, h, o: 1 });
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

/** E3's shape: years 0→30 over f100-220 (4 frames a year), holds before and after. */
function compound(frame: number, oneClock: boolean): SweepFrame {
  const t = Math.min(30, Math.max(0, (frame - 100) / 4));
  const year = Math.floor(t);
  const at = oneClock ? year : t;
  const simple = 10000 + 800 * at;
  const comp = 10000 * 1.08 ** at;
  return {
    frame,
    items: [
      node('Interest on your interest', 60, 40),
      node('YEAR', 60, 120, 30),
      node(String(year), 180, 110, 60),
      node(money(simple), 100, 900),
      node(money(comp), 600, 900 - comp / 400), // rides on top of the growing jar
      node('1 coin = $200', 60, 1280, 24),
      node('3.0× more', 800, 1280, 24), // a result typed in at its final value
    ],
  };
}

const frames = (oneClock: boolean) => Array.from({ length: 240 }, (_, f) => compound(f, oneClock));

describe('numberShape', () => {
  it('keeps the words and drops the values', () => {
    expect(numberShape('+$1,371 this year')).toBe('+$# this year');
    expect(numberShape('YEAR 7')).toBe('YEAR #');
    expect(numberShape('3.0×')).toBe('#×');
  });
});

describe('numberTracks', () => {
  it('follows a label that rides on a growing pile as one track', () => {
    const tracks = numberTracks(frames(false), piece);
    const pile = tracks.filter((t) => t.points.some((p) => p.value === '$100,627'));
    expect(pile).toHaveLength(1);
    expect(pile[0].points.length).toBe(240);
  });
});

describe('checkNumbers', () => {
  it("SPLITs a floor(t) step label beside totals drawn from the continuous t (E3's slip)", () => {
    const check = checkNumbers(frames(false), piece);
    expect(check.ok).toBe(false);
    expect(check.stepLabels).toBe(1);
    const others = check.splits.map((s) => s.other);
    expect(others.some((o) => o.startsWith('$1'))).toBe(true);
    // 3 of every 4 growing frames move while the year holds.
    expect(check.splits[0].frames.length).toBeGreaterThan(60);
    expect(check.splits[0].step).toMatch(/^YEAR \d+$/);
    expect(check.splits[0].example.length).toBeGreaterThanOrEqual(2);
  });

  it('passes when every number comes from the one integer step', () => {
    const check = checkNumbers(frames(true), piece);
    expect(check.ok).toBe(true);
    expect(check.splits).toEqual([]);
    expect(check.moving).toBe(true);
  });

  it('lists numbers fixed on every frame without blocking on them', () => {
    const check = checkNumbers(frames(true), piece);
    expect(check.fixed).toEqual(expect.arrayContaining(['1 coin = $200', '3.0× more']));
    expect(describeNumberCheck(check)).toContain('Fixed on every frame while other numbers move (not blocking)');
  });

  it('a piece whose numbers never move has nothing to split and lists nothing', () => {
    const still = Array.from({ length: 30 }, (_, frame) => ({ frame, items: [node('YEAR', 0, 0), node('30', 120, 0), node('$100,627', 0, 100)] }));
    const check = checkNumbers(still, piece);
    expect(check).toMatchObject({ ok: true, moving: false, fixed: [] });
    expect(describeNumberCheck(check)).toContain('No number on screen changes');
  });

  it('does not take two counters that tick together for two clocks', () => {
    // Steps and time both from one integer step, a counter that eases between steps would split.
    const race = Array.from({ length: 120 }, (_, frame) => {
      const step = Math.min(20, Math.floor(frame / 5));
      return { frame, items: [node('STEP', 0, 0), node(String(step), 140, 0), node(`${(step * 0.1).toFixed(1)} ms`, 0, 100)] };
    });
    expect(checkNumbers(race, piece).ok).toBe(true);
  });

  it('does not pair the two sides of a race that stop at different frames (E2: tree steps end at f60, the scan at f150)', () => {
    const race = Array.from({ length: 240 }, (_, frame) => {
      const steps = Math.min(20, Math.max(0, Math.floor((frame - 30) / 1.5)));
      const rows = Math.min(1_000_000, Math.max(0, Math.round(((frame - 30) / 120) * 1_000_000)));
      return { frame, items: [node(String(rows), 200, 580), node('ROWS READ', 100, 660), node(String(steps), 90, 1080), node('STEPS', 90, 1150)] };
    });
    expect(checkNumbers(race, piece).ok).toBe(true);
  });

  it('reports two numbers that read the same and move the same once', () => {
    const twin = frames(false).map((f) => ({ ...f, items: [...f.items, { ...f.items[3], x: 900 }] }));
    const text = describeNumberCheck(checkNumbers(twin, piece));
    expect(text).toContain('(2 numbers)');
  });

  it('describes a split with the frames and what they read', () => {
    const text = describeNumberCheck(checkNumbers(frames(false), piece), ', every 2th frame');
    expect(text).toContain('Verdict: SPLIT');
    expect(text).toMatch(/changed on \d+ frames while "YEAR \d+" held/);
    expect(text).toContain('Fix: compute the step as ONE integer per frame');
  });
});

describe('numbersDiffer', () => {
  const ft = (...lines: string[]) => ({ lines: lines.map((text) => ({ text, faint: false })), more: 0 });
  it('is true only when two frames show different numbers', () => {
    expect(numbersDiffer([ft('YEAR 7', '$16,000'), ft('YEAR 8', '$16,800')])).toBe(true);
    expect(numbersDiffer([ft('YEAR 30', '$100,627'), ft('$100,627', 'YEAR 30')])).toBe(false);
    expect(numbersDiffer([ft('Title'), null, ft('Title')])).toBe(false);
  });
});
