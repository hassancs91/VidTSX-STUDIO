import { describe, expect, it } from 'vitest';
import { linearSlope, median, syncVerdict } from './sync-verdict';

const rows = (errors: number[], step = 1) => errors.map((errorMs, i) => ({ t: 10 + i * step, errorMs }));

describe('sync verdict (verify_sync.py report(), T8)', () => {
  it('median and least-squares slope match numpy', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(linearSlope([0, 1, 2, 3], [1, 3, 5, 7])).toBeCloseTo(2, 10);
    expect(linearSlope([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('passes a file whose median offset is under 25 ms and does not drift', () => {
    const v = syncVerdict(rows([4, -6, 3, 8, 0, 2]), 16);
    expect(v.verdict).toBe('pass');
    expect(v.offsetMs).toBe(2.5);
    expect(v.confident).toBe(6);
    expect(v.used).toBe(6);
    expect(v.attempted).toBe(16);
    expect(v.spanSec).toBe(5);
    expect(v.message).toMatch(/^In sync: audio \+2\.5 ms vs the picture/);
  });

  it('fails a file whose audio is 100 ms behind the picture, sign and size reported', () => {
    const v = syncVerdict(rows([101, 98, 103, 99, 100]), 16);
    expect(v.verdict).toBe('fail');
    expect(v.offsetMs).toBe(100);
    expect(v.message).toMatch(/audio 100(\.0)? ms BEHIND the picture/);
    const ahead = syncVerdict(rows([-40, -42, -41]), 16);
    expect(ahead.verdict).toBe('fail');
    expect(ahead.message).toMatch(/AHEAD/);
  });

  it('the tolerance is strict: |offset| < 25 ms, so 25.0 fails', () => {
    expect(syncVerdict(rows([25, 25, 25]), 3).verdict).toBe('fail');
    expect(syncVerdict(rows([24.9, 24.9, 24.9]), 3).verdict).toBe('pass');
  });

  it('fails on drift over the measured span even when the median is in tolerance', () => {
    // −30 … +30 ms over 6 s: slope 10 ms/s × span 6 s = 60 ms > 40.
    const v = syncVerdict(rows([-30, -20, -10, 0, 10, 20, 30]), 16);
    expect(v.offsetMs).toBe(0);
    expect(v.driftMsPerSec).toBeCloseTo(10, 6);
    expect(v.driftOverSpanMs).toBeCloseTo(60, 6);
    expect(v.verdict).toBe('fail');
    expect(v.message).toMatch(/drifts/);
  });

  it('drops a wild outlier before fitting the drift, but still counts it as confident', () => {
    const v = syncVerdict(rows([1, 2, 0, 400, 1, -1]), 16);
    expect(v.confident).toBe(6);
    expect(v.used).toBe(5);
    expect(v.verdict).toBe('pass');
    expect(Math.abs(v.driftOverSpanMs ?? 99)).toBeLessThan(5);
  });

  it('is inconclusive under 3 confident probes — never a pass', () => {
    const v = syncVerdict(rows([1, 2]), 16);
    expect(v.verdict).toBe('inconclusive');
    expect(v.offsetMs).toBeNull();
    expect(v.message).toBe('Not enough to judge: only 2 of 16 probes found the camera picture confidently (3 needed).');
    expect(syncVerdict([], 0).verdict).toBe('inconclusive');
  });
});
