// Slow motion (docs/export-engines-plan.md Stage 4 log, "Slow motion",
// 2026-09-11): the JS model of what Remotion shows per slot against the
// source frames MEASURED on the plain Remotion exports of the slow seeds
// (t1-frame-map on `studio-t5-1080p-cut-slow*_2026-09-11*.mp4`), and the
// filter strings the copy recipe writes.
import { describe, expect, it } from 'vitest';
import { slowMotionFilters, slowMotionFirstSlot, slowMotionMediaTime, slowMotionSourceFrame, ticksPerFrame, type SlowSpanOptions } from './passthrough-slow';

const DJI = { num: 60000, den: 1001 };
const TB = { num: 1, den: 60000 };
const span = (trimBefore: number, rate: number, clipOffset = 0): SlowSpanOptions => ({ trimBefore, clipOffset, rate, fps: 30, sourceFrameRate: DJI, timeBase: TB });
const K = (o: SlowSpanOptions, slots: number[]) => slots.map((m) => slowMotionSourceFrame(o, m));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('ticksPerFrame', () => {
  it('is the whole number of time-base ticks in one source frame, or null', () => {
    expect(ticksPerFrame(TB, DJI)).toBe(1001);
    expect(ticksPerFrame({ num: 1, den: 90000 }, { num: 30000, den: 1001 })).toBe(3003);
    expect(ticksPerFrame({ num: 1, den: 12800 }, { num: 25, den: 1 })).toBe(512);
    expect(ticksPerFrame({ num: 1, den: 1000 }, { num: 30000, den: 1001 })).toBeNull();
  });
});

describe('the source frame Remotion shows per slot (measured 2026-09-11)', () => {
  it('slow4: 0.25× from source frame 450 — every second slot repeats, three slots on K 1000 at the one-tick tie', () => {
    const o = span(450, 0.25);
    expect(K(o, range(0, 12))).toEqual([899, 900, 900, 901, 901, 902, 902, 903, 903, 904, 904, 905, 905]);
    expect(K(o, [150])).toEqual([974]);
    expect(K(o, range(198, 206))).toEqual([998, 999, 999, 1000, 1000, 1000, 1001, 1001, 1002]);
    expect(K(o, [449])).toEqual([1123]);
  });

  it('slow: 0.5× from source frame 450 — one source frame per slot, the first repeat at slot 601/602 (K 1500)', () => {
    const o = span(450, 0.5);
    expect(K(o, range(0, 3))).toEqual([899, 900, 901, 902]);
    expect(K(o, [150, 449])).toEqual([1049, 1348]);
    expect(K(o, range(599, 605))).toEqual([1498, 1499, 1500, 1500, 1501, 1502, 1503]);
    expect(K(o, [749])).toEqual([1647]);
  });

  it('slow-open: 0.1× from source frame 1410 (47 s, K 2817.18) — five slots per frame, and slot 412 shows K 2899 by the integer-tick rule where the real-valued nearest is 2900', () => {
    const o = span(1410, 0.1);
    expect(K(o, range(0, 13))).toEqual([2817, 2817, 2818, 2818, 2818, 2818, 2818, 2819, 2819, 2819, 2819, 2819, 2820, 2820]);
    expect(K(o, [100, 200, 300])).toEqual([2837, 2857, 2877]);
    expect(K(o, range(405, 416))).toEqual([2898, 2898, 2899, 2899, 2899, 2899, 2899, 2899, 2900, 2900, 2900, 2900]);
    expect(K(o, [449])).toEqual([2907]);
    // The real-valued nearest at slot 412 is 2900 (t·60000/1001 = 2899.5005); Remotion truncates the media time to ticks first.
    const t = slowMotionMediaTime(o, 412);
    expect(Math.round((t * 60000) / 1001)).toBe(2900);
    expect(Math.trunc(t * 60000)).toBe(2902399); // one tick under 2902399.5 = 2899.5 frames: 500 ticks from K 2899, 501 from 2900
    // Remotion's interpolate multiplier is (startFrom + rate) − startFrom, not the rate.
    expect((1410 + 0.1) - 1410).not.toBe(0.1);
  });

  it('a span that starts mid-clip counts its slots from the clip start', () => {
    expect(slowMotionSourceFrame(span(450, 0.25, 180), 0)).toBe(slowMotionSourceFrame(span(450, 0.25), 180));
    expect(slowMotionSourceFrame(span(450, 0.25, 180), 21)).toBe(slowMotionSourceFrame(span(450, 0.25), 201));
  });

  it('rejects a rate outside (0, 1), fractional operands and a source whose frame is not whole ticks', () => {
    expect(() => slowMotionSourceFrame(span(450, 1), 0)).toThrow(/rate/);
    expect(() => slowMotionSourceFrame(span(450, 1.5), 0)).toThrow(/rate/);
    expect(() => slowMotionSourceFrame(span(450.5, 0.5), 0)).toThrow(/whole/);
    expect(() => slowMotionSourceFrame({ ...span(450, 0.5), timeBase: { num: 1, den: 1000 } }, 0)).toThrow(/whole number of ticks/);
  });
});

describe('the first slot of each source frame (where setpts places it)', () => {
  it('slow4: K 899 → 0, 900 → 1, 901 → 3 …, 1000 → 201 (three slots), 1001 → 204; a frame before the span has no slot', () => {
    const o = span(450, 0.25);
    expect([899, 900, 901, 902, 1000, 1001, 1123].map((k) => slowMotionFirstSlot(o, k))).toEqual([0, 1, 3, 5, 201, 204, 448]);
    expect(slowMotionFirstSlot(o, 898)).toBeNull();
  });

  it('matches a brute-force scan at every rate, including rates where frames are skipped (0.5 < rate < 1)', () => {
    for (const rate of [0.1, 0.25, 0.3, 0.5, 0.6, 0.75, 0.9]) {
      for (const clipOffset of [0, 37]) {
        const o = span(450, rate, clipOffset);
        const first = new Map<number, number>();
        for (let m = 0; m < 1200; m++) {
          const k = slowMotionSourceFrame(o, m);
          if (!first.has(k)) first.set(k, m);
        }
        const k0 = slowMotionSourceFrame(o, 0);
        let skipped = 0;
        for (let k = k0 - 2; k < k0 + 150; k++) {
          const expected = first.has(k) ? first.get(k)! : null;
          expect([rate, clipOffset, k, slowMotionFirstSlot(o, k)]).toEqual([rate, clipOffset, k, expected]);
          if (k >= k0 && expected === null) skipped++;
        }
        if (rate > 0.5005) expect(skipped).toBeGreaterThan(0);
        else expect(skipped).toBe(0);
      }
    }
  });
});

describe('slowMotionFilters', () => {
  it('writes the tick-exact select, the first-slot setpts (T, not t) and the fps fill', () => {
    const f = slowMotionFilters(span(450, 0.25));
    const K = 'round(t/(1001/60000))';
    const a = `max(ceil(((${K}-0.5)*(1001/60000)*30-450)/0.25-0)-1\\,0)`;
    const want = (m: string) => `floor((trunc(((0+${m})*0.25+450)/30*60000/1)+500.5)/1001)`;
    expect(f.select).toBe(`select='eq(${want(a)}\\,${K})+eq(${want(`${a}+1`)}\\,${K})+eq(${want(`${a}+2`)}\\,${K})'`);
    expect(f.setpts.startsWith("setpts='(if(eq(floor((trunc(((0+max(ceil(((round(T/(1001/60000))-0.5)")).toBe(true);
    expect(f.setpts.endsWith(")/30/TB'")).toBe(true);
    expect(f.setpts).not.toMatch(/[^A-Z]t\//);
    expect(f.fps).toBe('fps=fps=30');
  });

  it('carries the clip offset and Remotion\'s multiplier as JS prints them', () => {
    const f = slowMotionFilters(span(1410, 0.1, 180));
    expect(f.select).toContain('((180+max(');
    expect(f.select).toContain('*0.09999999999990905+1410)/30*60000/1)+500.5)/1001)');
    expect(f.select).toContain('/0.09999999999990905-180)-1\\,0)');
  });
});
