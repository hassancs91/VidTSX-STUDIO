import { describe, expect, it, vi } from 'vitest';

vi.mock('../ffmpeg-bin', () => ({ runFfmpeg: async () => undefined }));

import { AUDIO_RATE, audioOffsetRows, bestLag, parseWavPcm16 } from './audio-offset';

/** Deterministic noise so the cross-correlation has a sharp peak. */
function noise(samples: number, seed = 1): Float32Array {
  const out = new Float32Array(samples);
  let x = seed;
  for (let i = 0; i < samples; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (x / 0x7fffffff) * 2 - 1;
  }
  return out;
}

function delayed(src: Float32Array, bySamples: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const j = i - bySamples;
    out[i] = j >= 0 && j < src.length ? src[j] : 0;
  }
  return out;
}

// The real instrument runs at 48 kHz (±120 ms = ±5,760 lags over 48,000
// samples per window — seconds of arithmetic); the maths is rate-agnostic,
// so the tests run it at 4.8 kHz with the same millisecond expectations.
const RATE = 4800;

describe('audio offset (the T1 instrument)', () => {
  const ref = noise(RATE * 4);

  it('finds the +42.7 ms every Remotion export carried (2048 samples at 48 kHz = 205 at 4.8 kHz)', () => {
    const cand = delayed(ref, 205);
    const rows = audioOffsetRows(ref, cand, [0.5, 2], 0, RATE);
    expect(rows.map((r) => r.lagSamples)).toEqual([205, 205]);
    expect(rows[0].lagMs).toBe(42.7);
    expect(rows[0].corr).toBeGreaterThan(0.99);
  });

  it('reports 0 for an aligned candidate and a negative lag for an early one', () => {
    expect(audioOffsetRows(ref, ref, [1], 0, RATE)[0].lagMs).toBe(0);
    expect(audioOffsetRows(ref, delayed(ref, -48), [1], 0, RATE)[0].lagMs).toBe(-10);
  });

  it('applies bOffset when the candidate starts at another reference time', () => {
    // Candidate = reference from 1 s onward (a clip cut from source time 1 placed at 0).
    const cand = ref.subarray(RATE);
    const rows = audioOffsetRows(ref, cand, [1.5, 2.5], 1, RATE);
    expect(rows.map((r) => r.lagSamples)).toEqual([0, 0]);
  });

  it('skips windows that fall outside either file', () => {
    const rows = audioOffsetRows(ref, ref.subarray(0, RATE), [0, 3.5], 0, RATE);
    expect(rows[0].lagSamples).toBe(0);
    expect(rows[1].skipped).toBe(true);
  });

  it('bestLag stays inside ±maxLag', () => {
    const cand = delayed(ref, 1000);
    const r = bestLag(ref, cand, RATE, RATE, RATE, 100);
    expect(Math.abs(r.lag)).toBeLessThanOrEqual(100);
  });

  it('exports the real rate the product uses', () => {
    expect(AUDIO_RATE).toBe(48_000);
  });
});

describe('parseWavPcm16', () => {
  it('reads int16 samples after the data chunk of a piped WAV (placeholder sizes)', () => {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(0xffffffff, 4);
    header.write('WAVEfmt ', 8, 'ascii');
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(0xffffffff, 40);
    const pcm = Buffer.alloc(6);
    pcm.writeInt16LE(0, 0);
    pcm.writeInt16LE(16384, 2);
    pcm.writeInt16LE(-32768, 4);
    expect([...parseWavPcm16(Buffer.concat([header, pcm]))]).toEqual([0, 0.5, -1]);
    expect(() => parseWavPcm16(Buffer.alloc(20))).toThrow(/no data chunk/);
  });
});
