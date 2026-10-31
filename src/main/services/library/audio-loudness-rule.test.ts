// The loudness rule generated sound is filed under (E2, T6 / Q2): the `gen_sfx.py normalize_clip()` port,
// pure — the ffmpeg side is audio-normalize.test.ts.
import { describe, expect, it } from 'vitest';
import {
  correctiveGain,
  isOverCeiling,
  LOUDNESS_CEILING_DBFS,
  LOUDNESS_CEILING_MARGIN_DB,
  LOUDNESS_MAX_CORRECTIVE_PASSES,
  LOUDNESS_TARGET_LUFS,
  parseLoudnormStats,
  planLoudnessGain,
} from './audio-loudness-rule';

const STATS_BLOCK = [
  '[Parsed_loudnorm_0 @ 000001d2] ',
  '{',
  '\t"input_i" : "-12.34",',
  '\t"input_tp" : "-0.31",',
  '\t"input_lra" : "1.20",',
  '\t"input_thresh" : "-22.34",',
  '\t"output_i" : "-20.01",',
  '\t"output_tp" : "-8.00",',
  '\t"output_lra" : "1.20",',
  '\t"output_thresh" : "-30.01",',
  '\t"normalization_type" : "dynamic",',
  '\t"target_offset" : "0.01"',
  '}',
].join('\n');

describe('parseLoudnormStats', () => {
  it('reads input_i and input_tp off the analysis pass stderr', () => {
    expect(parseLoudnormStats(`size=N/A time=00:00:03.00 bitrate=N/A speed= 300x\n${STATS_BLOCK}\n`)).toEqual({
      integratedLufs: -12.34,
      truePeakDbtp: -0.31,
    });
  });

  it('maps -inf to -Infinity; null without a block or with a non-number', () => {
    expect(parseLoudnormStats('{ "input_i" : "-inf", "input_tp" : "-inf" }')).toEqual({
      integratedLufs: -Infinity,
      truePeakDbtp: -Infinity,
    });
    expect(parseLoudnormStats('ffmpeg exited with code 1')).toBeNull();
    expect(parseLoudnormStats('{ "input_i" : "abc", "input_tp" : "-1.00" }')).toBeNull();
  });
});

describe('planLoudnessGain (the gen_sfx.py rule)', () => {
  const plan = (i: number, tp: number) => planLoudnessGain({ integratedLufs: i, truePeakDbtp: tp });

  it('defaults: −20 LUFS under a −1.5 dBTP ceiling', () => {
    expect(LOUDNESS_TARGET_LUFS).toBe(-20);
    expect(LOUDNESS_CEILING_DBFS).toBe(-1.5);
  });

  it('gain down when the clip is loud; the ceiling does not bind', () => {
    expect(plan(-12, -0.3)).toEqual({ gainDb: -8, clamped: false, gated: false, skipped: false });
  });

  it('gain up when the clip is quiet and the peak has room', () => {
    expect(plan(-30, -23)).toEqual({ gainDb: 10, clamped: false, gated: false, skipped: false });
  });

  it('clamps to ceiling − peak when −20 LUFS would push the peak over the ceiling', () => {
    expect(plan(-30, -6)).toEqual({ gainDb: 4.5, clamped: true, gated: false, skipped: false });
  });

  it('gated or unmeasurable loudness → peak-normalize to the ceiling', () => {
    expect(plan(-70, -12)).toEqual({ gainDb: 10.5, clamped: false, gated: true, skipped: false });
    expect(plan(-Infinity, -0.3)).toEqual({ gainDb: -1.2, clamped: false, gated: true, skipped: false });
    expect(plan(-50.01, -12).gated).toBe(true);
    expect(plan(-49.99, -12).gated).toBe(false);
  });

  it('a gain under 0.1 dB is skipped (no re-encode); 0.1 itself is applied', () => {
    expect(plan(-20.05, -8)).toEqual({ gainDb: 0, clamped: false, gated: false, skipped: true });
    expect(plan(-19.9, -8)).toEqual({ gainDb: -0.1, clamped: false, gated: false, skipped: false });
  });

  it('digital silence (no peak) is left alone', () => {
    expect(plan(-Infinity, -Infinity)).toEqual({ gainDb: 0, clamped: false, gated: true, skipped: true });
  });

  it('takes a custom target and ceiling', () => {
    expect(planLoudnessGain({ integratedLufs: -20, truePeakDbtp: -3 }, -14, -1)).toEqual({
      gainDb: 2,
      clamped: true,
      gated: false,
      skipped: false,
    });
  });

  it('the 0.1 dB skip never keeps a file whose peak is OVER the ceiling (E-d11)', () => {
    expect(plan(-20.05, -1.45)).toEqual({ gainDb: -0.05, clamped: true, gated: false, skipped: false });
    expect(plan(-70, -1.45)).toEqual({ gainDb: -0.05, clamped: false, gated: true, skipped: false });
    // At the ceiling as recorded (two decimals) is not over: still skipped.
    expect(plan(-20.05, -1.4951)).toMatchObject({ gainDb: 0, skipped: true });
  });
});

describe('the encoded-file ceiling check (E-d11)', () => {
  it('constants: a 0.1 dB margin, at most two corrective passes', () => {
    expect(LOUDNESS_CEILING_MARGIN_DB).toBe(0.1);
    expect(LOUDNESS_MAX_CORRECTIVE_PASSES).toBe(2);
  });

  it('isOverCeiling compares the RECORDED (two-decimal) peak; silence and NaN are never over', () => {
    expect(isOverCeiling(-1.44)).toBe(true);
    expect(isOverCeiling(-1.494)).toBe(true);
    expect(isOverCeiling(-1.4951)).toBe(false);
    expect(isOverCeiling(-1.5)).toBe(false);
    expect(isOverCeiling(-1.86)).toBe(false);
    expect(isOverCeiling(-Infinity)).toBe(false);
    expect(isOverCeiling(Number.NaN)).toBe(false);
    expect(isOverCeiling(-0.9, -1)).toBe(true);
  });

  it('correctiveGain lowers the applied gain by the overshoot plus the margin', () => {
    expect(correctiveGain(7.22, -1.44)).toBe(7.06);
    expect(correctiveGain(4.18, -1.27)).toBe(3.85);
    expect(correctiveGain(-8, -0.8, -1)).toBe(-8.3);
  });
});
