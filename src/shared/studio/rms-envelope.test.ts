// The October knobs of the reference pipeline's AudioProbe (tools/cutlib.py):
// zcr, the fricative-aware snap_tail and snap_head — on synthetic envelopes
// built to the cases cutlib's docstrings record from video-14.

import { describe, it, expect } from 'vitest';
import { RmsEnvelope } from './rms-envelope';

const BPS = 50; // the waveform cache's PEAKS_PER_SECOND (20 ms buckets)
const FLOOR = -60;

interface Span {
  from: number;
  to: number;
  db: number;
  zcr?: number;
}

/** Floor-level room tone (ZCR 1200) with the given spans painted over it. */
function envelope(durationSec: number, spans: Span[], withZcr = true): RmsEnvelope {
  const n = Math.round(durationSec * BPS);
  const db: number[] = [];
  const zcr: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / BPS;
    const hit = spans.find((s) => t >= s.from && t < s.to);
    db.push(hit ? hit.db : FLOOR);
    zcr.push(hit?.zcr ?? 1200);
  }
  return new RmsEnvelope(db, BPS, withZcr ? zcr : undefined);
}

/** Power-mean of two levels with weights — what a straddling window reads. */
function mix(dbA: number, wA: number, dbB: number, wB: number): number {
  return 10 * Math.log10((wA * 10 ** (dbA / 10) + wB * 10 ** (dbB / 10)) / (wA + wB) + 1e-12);
}

describe('RmsEnvelope windows', () => {
  it('weights a window by its overlap with each bucket (no snap to bucket starts)', () => {
    const env = envelope(4, [{ from: 0, to: 1, db: -20 }]);
    // [0.99, 1.01): half in the last loud bucket, half in the first quiet one.
    expect(env.rmsDb(0.99, 0.02)).toBeCloseTo(mix(-20, 1, FLOOR, 1), 6);
    // [0.97, 1.02): 30 ms loud, 20 ms quiet.
    expect(env.rmsDb(0.97, 0.05)).toBeCloseTo(mix(-20, 3, FLOOR, 2), 6);
  });

  it('noise floor = 10th percentile of 50 ms windows (cutlib floor_db)', () => {
    const env = envelope(10, [{ from: 0, to: 8, db: -20 }]);
    expect(env.floorDb()).toBeCloseTo(FLOOR, 6);
  });

  it('zcr is the overlap-weighted crossing rate; 0 without ZCR data', () => {
    const env = envelope(2, [{ from: 1, to: 2, db: -30, zcr: 6000 }]);
    expect(env.hasZcr()).toBe(true);
    expect(env.zcr(0.5)).toBeCloseTo(1200, 6);
    expect(env.zcr(1.2)).toBeCloseTo(6000, 6);
    // [0.99, 1.02): 10 ms room tone + 20 ms fricative.
    expect(env.zcr(0.99)).toBeCloseTo((1200 + 2 * 6000) / 3, 6);
    expect(env.zcr(5)).toBe(0);
    const old = envelope(2, [{ from: 1, to: 2, db: -30, zcr: 6000 }], false);
    expect(old.hasZcr()).toBe(false);
    expect(old.zcr(1.2)).toBe(0);
  });
});

describe('snapTail — the fricative rule ("path" played as "pa-")', () => {
  // "path" ends at 1.00 by its token; the vowel's release is gone by then, but
  // a weak "th" hisses at floor + 8 dB until 1.20 — below floor + 12 (video-14's
  // tight margin), above floor + 5 (fric_margin).
  const th = (zcr: number) =>
    envelope(3, [
      { from: 0.5, to: 1.0, db: -25 },
      { from: 1.0, to: 1.2, db: FLOOR + 8, zcr },
    ]);

  it('without fric_zcr the tail stops at min_tail, mid-"th"', () => {
    expect(th(6000).snapTail(1.0, 0.08, 0.7, 12)).toBe(0.08);
  });

  it('with fric_zcr 3500 it walks through the fricative to the floor', () => {
    const tail = th(6000).snapTail(1.0, 0.08, 0.7, 12, 3500, 5);
    // First 50 ms window at or under floor + 5 dB: [1.18, 1.23) reads
    // mix(+8 dB × 20 ms, floor × 30 ms) = floor + 4.95 dB.
    expect(mix(FLOOR + 8, 2, FLOOR, 3) - FLOOR).toBeLessThan(5);
    expect(tail).toBe(0.18);
  });

  it('room tone never qualifies: the same level at ZCR 1500 stops at min_tail', () => {
    expect(th(1500).snapTail(1.0, 0.08, 0.7, 12, 3500, 5)).toBe(0.08);
  });

  it('a hiss at or under floor + fric_margin does not count', () => {
    const faint = envelope(3, [
      { from: 0.5, to: 1.0, db: -25 },
      { from: 1.0, to: 1.2, db: FLOOR + 4, zcr: 8000 },
    ]);
    expect(faint.snapTail(1.0, 0.08, 0.7, 12, 3500, 5)).toBe(0.08);
  });

  it('a v2 cache (no zcr) behaves exactly like the old snapper', () => {
    const old = envelope(
      3,
      [
        { from: 0.5, to: 1.0, db: -25 },
        { from: 1.0, to: 1.2, db: FLOOR + 8, zcr: 6000 },
      ],
      false,
    );
    expect(old.snapTail(1.0, 0.08, 0.7, 12, 3500, 5)).toBe(0.08);
  });

  it('returns max_tail when the sound never decays', () => {
    const loud = envelope(3, [{ from: 0.5, to: 3, db: -20 }]);
    expect(loud.snapTail(1.0, 0.08, 0.7, 12, 3500, 5)).toBe(0.7);
  });
});

describe('snapHead — lead-in to the real onset ("Every" began 0.16 s early)', () => {
  it('walks back to the audio onset, plus 30 ms', () => {
    // Token "Every" at 2.00; its audio starts at 1.84.
    const env = envelope(4, [{ from: 1.84, to: 2.4, db: -22 }]);
    // Walks while the 20 ms window before t is loud: last loud window is
    // [1.84, 1.86) at t = 1.86; [1.83, 1.85) is half loud (> floor + 12)
    // so t = 1.85 also walks; [1.82, 1.84) is floor → stop at t = 1.84.
    expect(env.snapHead(2.0, 0.15, 0.3, 12)).toBe(0.19);
  });

  it('never less than head: a clean onset at the token keeps head', () => {
    const env = envelope(4, [{ from: 2.0, to: 2.4, db: -22 }]);
    expect(env.snapHead(2.0, 0.15, 0.3, 12)).toBe(0.15);
  });

  it('capped at max_head when sound runs on before the word', () => {
    const env = envelope(4, [{ from: 1.0, to: 2.4, db: -22 }]);
    expect(env.snapHead(2.0, 0.15, 0.3, 12)).toBe(0.3);
  });

  it('reaches back through a fricative onset only with fric_zcr', () => {
    // "So": a weak "s" at floor + 8 dB from 1.80, the vowel at 1.95.
    const env = envelope(4, [
      { from: 1.8, to: 1.95, db: FLOOR + 8, zcr: 7000 },
      { from: 1.95, to: 2.4, db: -22 },
    ]);
    expect(env.snapHead(2.0, 0.15, 0.3, 12)).toBe(0.15); // stops at 1.95 → 0.08 → head
    // [1.79, 1.81) is half hiss: floor + 5.6 dB at ZCR 4100 → still walks;
    // [1.78, 1.80) is room tone → stop at 1.80 → 0.20 + 30 ms.
    expect(env.snapHead(2.0, 0.15, 0.3, 12, 3500, 5)).toBe(0.23);
  });
});
