import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, describe, it, expect } from 'vitest';
import { WaveformBucketizer } from './waveform-buckets';
import { RmsEnvelope } from '../../../shared/studio/rms-envelope';

const SR = 16000;
const PER_BUCKET = 320; // 50 buckets per second

function pcm(samples: number[]): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => buf.writeInt16LE(v, i * 2));
  return buf;
}

function sine(freq: number, seconds: number, amplitude = 8000): number[] {
  return Array.from({ length: Math.round(seconds * SR) }, (_, i) =>
    Math.round(amplitude * Math.sin(2 * Math.PI * freq * (i / SR) + 0.1)),
  );
}

/** cutlib's AudioProbe.zcr over the raw samples, verbatim. */
function cutlibZcr(data: number[], t: number, win = 0.03): number {
  const a = Math.max(0, Math.floor(t * SR));
  const b = Math.min(data.length, Math.floor((t + win) * SR));
  if (b - a < 2) return 0;
  let n = 0;
  for (let i = a + 1; i < b; i++) if (data[i] < 0 !== data[i - 1] < 0) n++;
  return (n * SR) / (b - a);
}

describe('WaveformBucketizer', () => {
  it('counts zero crossings per second per bucket (1 kHz → 2 k, 6 kHz → 12 k)', () => {
    const b = new WaveformBucketizer(SR, PER_BUCKET);
    b.push(pcm([...sine(1000, 0.2), ...sine(6000, 0.2)]));
    const { zcr } = b.finish();
    expect(zcr).toHaveLength(20);
    for (const z of zcr.slice(1, 9)) expect(z).toBeGreaterThan(1900), expect(z).toBeLessThan(2100);
    for (const z of zcr.slice(11)) expect(z).toBeGreaterThan(11800), expect(z).toBeLessThan(12200);
  });

  it('reads like cutlib on a stationary stretch (voiced vs fricative)', () => {
    const data = [...sine(180, 0.5, 9000), ...sine(5200, 0.5, 2000)];
    const b = new WaveformBucketizer(SR, PER_BUCKET);
    b.push(pcm(data));
    const out = b.finish();
    const env = new RmsEnvelope(out.rmsDb, 50, out.zcr);
    for (const t of [0.13, 0.31, 0.62, 0.87]) {
      expect(Math.abs(env.zcr(t) - cutlibZcr(data, t)) / cutlibZcr(data, t)).toBeLessThan(0.05);
    }
    expect(env.zcr(0.2)).toBeLessThan(1000); // voiced: far under fric_zcr 3500
    expect(env.zcr(0.7)).toBeGreaterThan(3500); // fricative band
  });

  it('RMS dB per bucket: a 0.1 full-scale square reads -20 dB; digital silence -120, ZCR 0', () => {
    const b = new WaveformBucketizer(SR, PER_BUCKET);
    b.push(pcm([...Array.from({ length: 640 }, (_, i) => (i % 2 ? 3277 : -3277)), ...new Array(640).fill(0)]));
    const { rmsDb, zcr, peaks } = b.finish();
    expect(rmsDb.slice(0, 2)).toEqual([-20, -20]);
    expect(rmsDb.slice(2)).toEqual([-120, -120]);
    expect(zcr[1]).toBe(16000);
    expect(zcr[0]).toBe(15950); // the very first sample has no predecessor
    expect(zcr.slice(2)).toEqual([0, 0]); // 0 counts as positive: no crossing from +3277 into silence
    expect(peaks[0]).toBeCloseTo(0.1, 3);
  });

  it('a sample split across chunks and a short last bucket give the same arrays', () => {
    const data = pcm(sine(440, 0.25));
    const whole = new WaveformBucketizer(SR, PER_BUCKET);
    whole.push(data);
    const split = new WaveformBucketizer(SR, PER_BUCKET);
    split.push(data.subarray(0, 1001));
    split.push(data.subarray(1001, 4000));
    split.push(data.subarray(4000));
    const a = whole.finish();
    expect(split.finish()).toEqual(a);
    expect(a.peaks).toHaveLength(13); // 12.5 buckets → the half bucket is kept
  });
});

describe('isWaveformStale', () => {
  const dir = path.join(os.tmpdir(), `vidtsx-wf-stale-${process.pid}`);
  afterAll(async () => fs.rm(dir, { recursive: true, force: true }));

  it('v1/v2 or unversioned files are stale, v3 is not, a missing file is', async () => {
    const { isWaveformStale } = await import('./waveform-generator');
    await fs.mkdir(dir, { recursive: true });
    const write = async (name: string, body: string) => {
      const p = path.join(dir, name);
      await fs.writeFile(p, body, 'utf-8');
      return p;
    };
    expect(await isWaveformStale(await write('v2.json', '{"version":2,"peaksPerSecond":50,"peaks":[0.1],"rmsDb":[-30]}'))).toBe(true);
    expect(await isWaveformStale(await write('v1.json', '{"peaks":[]}'))).toBe(true);
    expect(await isWaveformStale(await write('v3.json', '{"version":3,"peaksPerSecond":50,"peaks":[],"rmsDb":[],"zcr":[]}'))).toBe(false);
    expect(await isWaveformStale(path.join(dir, 'missing.json'))).toBe(true);
  });
});
