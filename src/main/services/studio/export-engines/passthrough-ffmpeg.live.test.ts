// Live check of the passthrough recipes against the real full ffmpeg and the
// T1 camera file — skipped unless VIDTSX_LIVE_FFMPEG=1 (needs the GPU encoder
// download and raw/DJI_20260813142309_0270_D.MP4). What it pins: piece frame
// counts, the TS → mp4 join (frame count, pts on the exact 1/30 grid from 0,
// all five colour tags), NVENC determinism (byte-identical re-encode), a black
// piece that is black, and the one-pass audio's shape.
import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { EXPORT_COLOR } from './types';
import { audioPassArgs, blackSpanArgs, concatListText, copySpanArgs, holdLastFrameArgs, joinArgs } from './passthrough-ffmpeg';

const LIVE = process.env.VIDTSX_LIVE_FFMPEG === '1';
const REPO = path.resolve(__dirname, '../../../../..');
const SOURCE = path.join(REPO, 'raw', 'DJI_20260813142309_0270_D.MP4');
const OUT = path.join(REPO, '.vidtsx-temp', 'passthrough-live');

function bins() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  if (!dir) throw new Error('no ffmpeg-full');
  return { ffmpeg: path.join(root, dir, 'bin', 'ffmpeg.exe'), ffprobe: path.join(root, dir, 'bin', 'ffprobe.exe') };
}

function run(exe: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d: Buffer) => { out += d; });
    p.stderr.on('data', (d: Buffer) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(exe)} exit ${code}: ${err.slice(-1500)}`))));
  });
}

async function probeFrames(ffprobe: string, file: string): Promise<{ count: number; pts: number[]; tags: Record<string, string | undefined>; startTime: number }> {
  const frames = JSON.parse(await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=pts_time', '-of', 'json', file])) as { frames: Array<{ pts_time: string }> };
  const streams = JSON.parse(await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_streams', '-of', 'json', file])) as { streams: Array<Record<string, string>> };
  const s = streams.streams[0];
  return {
    count: frames.frames.length,
    pts: frames.frames.map((f) => Number(f.pts_time)),
    tags: { pix_fmt: s.pix_fmt, color_range: s.color_range, color_space: s.color_space, color_primaries: s.color_primaries, color_transfer: s.color_transfer },
    startTime: Number(s.start_time),
  };
}

const base = { encoder: 'nvenc' as const, fps: 30, width: 1920, height: 1080, color: EXPORT_COLOR, sourceFrameRate: { num: 60000, den: 1001 }, sourcePath: SOURCE };

describe.skipIf(!LIVE)('passthrough recipes on the real full ffmpeg', () => {
  it('copies, blacks, joins and stays byte-identical', async () => {
    const { ffmpeg, ffprobe } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const p0 = path.join(OUT, 'p0.ts');
    const p1 = path.join(OUT, 'p1.ts');
    const p2 = path.join(OUT, 'p2.ts');
    const p0b = path.join(OUT, 'p0b.ts');
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 0, frames: 150, firstFrameCeil: false, outputPath: p0 }));
    await run(ffmpeg, blackSpanArgs({ ...base, frames: 30, outputPath: p1 }));
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 450, frames: 150, firstFrameCeil: false, outputPath: p2 }));
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 0, frames: 150, firstFrameCeil: false, outputPath: p0b }));

    expect((await probeFrames(ffprobe, p0)).count).toBe(150);
    expect((await probeFrames(ffprobe, p1)).count).toBe(30);
    expect((await probeFrames(ffprobe, p2)).count).toBe(150);
    // NVENC is deterministic (T1: encode A vs B byte-identical).
    expect(Buffer.compare(await fs.readFile(p0), await fs.readFile(p0b))).toBe(0);

    const list = path.join(OUT, 'list.txt');
    await fs.writeFile(list, concatListText([{ path: p0, frames: 150 }, { path: p1, frames: 30 }, { path: p2, frames: 150 }], 30));
    const joined = path.join(OUT, 'joined.mp4');
    await run(ffmpeg, joinArgs(list, joined, EXPORT_COLOR));
    const j = await probeFrames(ffprobe, joined);
    expect(j.count).toBe(330);
    expect(j.startTime).toBe(0);
    const offGrid = j.pts.map((t, i) => Math.abs(t - i / 30)).filter((d) => d > 1e-4);
    expect(offGrid).toEqual([]);
    expect(j.tags).toEqual({ pix_fmt: 'yuv420p', color_range: 'tv', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709' });

    // The black piece decodes to black (limited-range Y=16 → rgb 0).
    const rgb = await new Promise<Buffer>((resolve, reject) => {
      const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(160.5 / 30), '-i', joined, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
      const chunks: Buffer[] = [];
      p.stdout.on('data', (c: Buffer) => chunks.push(c));
      p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('extract failed'))));
    });
    let max = 0;
    for (const b of rgb) if (b > max) max = b;
    expect(rgb.length).toBe(1920 * 1080 * 3);
    expect(max).toBeLessThanOrEqual(2);
  }, 300_000);

  it('a clip running to the container end comes up short and the held tail completes it', async () => {
    const { ffmpeg, ffprobe } = bins();
    await fs.mkdir(OUT, { recursive: true });
    // 0270: stream 8333 frames (last pts 139.0056), container 139.022233. A
    // clip from 138.0 s to the container end = 31 slots; slot 30 at 139.0 s
    // has a frame (K 8332), slot 31 would not — ask for 32 to force the miss.
    const short = path.join(OUT, 'short.ts');
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 4140, frames: 32, firstFrameCeil: false, outputPath: short }));
    const got = (await probeFrames(ffprobe, short)).count;
    expect(got).toBeLessThan(32);
    expect(got).toBeGreaterThanOrEqual(30);
    const tail = path.join(OUT, 'short-tail.ts');
    await run(ffmpeg, holdLastFrameArgs({ ...base, inputPath: short, lastFrame: got - 1, frames: 32 - got, outputPath: tail }));
    expect((await probeFrames(ffprobe, tail)).count).toBe(32 - got);
    const list = path.join(OUT, 'short-list.txt');
    await fs.writeFile(list, concatListText([{ path: short, frames: got }, { path: tail, frames: 32 - got }], 30));
    const joined = path.join(OUT, 'short-joined.mp4');
    await run(ffmpeg, joinArgs(list, joined, EXPORT_COLOR));
    const j = await probeFrames(ffprobe, joined);
    expect(j.count).toBe(32);
    expect(j.pts.map((t, i) => Math.abs(t - i / 30)).filter((d) => d > 1e-4)).toEqual([]);
  }, 120_000);

  it('a clip tail whose audio ends before the container still contributes its full length', async () => {
    // DJI 0271: container 73.0897 s, audio ends ~44.7 ms earlier. The seeded 3 h
    // project's tail clip 45 → 73.09 s came up short and shifted everything after it.
    const src = path.join(REPO, 'raw', 'DJI_20260813142610_0271_D.MP4');
    const { ffmpeg, ffprobe } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const wav = path.join(OUT, 'tail-audio.wav');
    const graphPath = path.join(OUT, 'tail-audio-graph.txt');
    const pass = audioPassArgs({
      duration: 33.09,
      segments: [
        { kind: 'source', assetId: 'b', assetPath: src, sourceIn: 45, duration: 28.09 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 0, duration: 5 },
      ],
    }, wav, graphPath);
    await fs.writeFile(graphPath, pass.graph);
    await run(ffmpeg, pass.args);
    const s = JSON.parse(await run(ffprobe, ['-v', 'error', '-show_format', '-of', 'json', wav])) as { format: { duration: string } };
    expect(Math.abs(Number(s.format.duration) - 33.09)).toBeLessThan(0.001);
    // The second segment must start at exactly 28.09 s: its first second matches the 0270 file's first second at lag 0.
    const decode = (file: string, ss: number, t: number) => new Promise<Float32Array>((resolve, reject) => {
      const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(ss), '-t', String(t), '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
      const chunks: Buffer[] = [];
      p.stdout.on('data', (c: Buffer) => chunks.push(c));
      p.on('close', (code) => { if (code !== 0) reject(new Error('decode failed')); const b = Buffer.concat(chunks); resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))); });
    });
    const ref = await decode(SOURCE, 1, 1);
    const cand = await decode(wav, 28.09 + 1 - 0.2, 1.4);
    let best = { lag: 0, corr: -2 };
    let rr = 0;
    for (let i = 0; i < ref.length; i++) rr += ref[i] * ref[i];
    for (let lag = 0; lag + ref.length <= cand.length; lag++) {
      let rc = 0;
      let cc = 0;
      for (let i = 0; i < ref.length; i++) { const c = cand[lag + i]; rc += ref[i] * c; cc += c * c; }
      const corr = rc / Math.sqrt(rr * cc + 1e-12);
      if (corr > best.corr) best = { lag, corr };
    }
    const lagMs = (best.lag / 48000 - 0.2) * 1000;
    expect(best.corr).toBeGreaterThan(0.99);
    expect(Math.abs(lagMs)).toBeLessThan(1);
  }, 120_000);

  it('a gain-only segment is the source at that level, still at lag 0 (Stage 3)', async () => {
    const { ffmpeg } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const wav = path.join(OUT, 'gain-audio.wav');
    const graphPath = path.join(OUT, 'gain-audio-graph.txt');
    const pass = audioPassArgs({
      duration: 4,
      segments: [
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 0, duration: 2 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 15, duration: 2, gain: 0.5 },
      ],
    }, wav, graphPath);
    await fs.writeFile(graphPath, pass.graph);
    await run(ffmpeg, pass.args);
    const decode = (file: string, ss: number, t: number) => new Promise<Float32Array>((resolve, reject) => {
      const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(ss), '-t', String(t), '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
      const chunks: Buffer[] = [];
      p.stdout.on('data', (c: Buffer) => chunks.push(c));
      p.on('close', (code) => { if (code !== 0) reject(new Error('decode failed')); const b = Buffer.concat(chunks); resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))); });
    });
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
    const ref = await decode(SOURCE, 15.5, 1);
    const cand = await decode(wav, 2.5, 1);
    // Half the level (−6.02 dB) within 1 %, and the same samples: correlation ~1 at lag 0.
    expect(rms(cand) / rms(ref)).toBeGreaterThan(0.495);
    expect(rms(cand) / rms(ref)).toBeLessThan(0.505);
    let rc = 0;
    let rr = 0;
    let cc = 0;
    for (let i = 0; i < ref.length; i++) { rc += ref[i] * cand[i]; rr += ref[i] * ref[i]; cc += cand[i] * cand[i]; }
    expect(rc / Math.sqrt(rr * cc)).toBeGreaterThan(0.999);
    const plain = await decode(wav, 0.5, 1);
    expect(rms(plain) / rms(await decode(SOURCE, 0.5, 1))).toBeGreaterThan(0.99);
  }, 120_000);

  it('two chains sum sample for sample: the base plus the second at gain 0.5, lag 0 (Stage 3 slice 2)', async () => {
    const { ffmpeg } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const wav = path.join(OUT, 'mix-audio.wav');
    const graphPath = path.join(OUT, 'mix-audio-graph.txt');
    const pass = audioPassArgs({
      duration: 4,
      segments: [{ kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 0, duration: 4 }],
      chains: [[
        { kind: 'silence', duration: 1 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 15, duration: 2, gain: 0.5 },
        { kind: 'silence', duration: 1 },
      ]],
    }, wav, graphPath);
    await fs.writeFile(graphPath, pass.graph);
    await run(ffmpeg, pass.args);
    const decode = (file: string, ss: number, t: number) => new Promise<Float32Array>((resolve, reject) => {
      const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(ss), '-t', String(t), '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
      const chunks: Buffer[] = [];
      p.stdout.on('data', (c: Buffer) => chunks.push(c));
      p.on('close', (code) => { if (code !== 0) reject(new Error('decode failed')); const b = Buffer.concat(chunks); resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))); });
    });
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
    const corr = (x: Float32Array, y: Float32Array) => {
      let xy = 0; let xx = 0; let yy = 0;
      for (let i = 0; i < x.length; i++) { xy += x[i] * y[i]; xx += x[i] * x[i]; yy += y[i] * y[i]; }
      return xy / Math.sqrt(xx * yy);
    };
    // Inside the second chain's segment (2.0–3.0 s): the sum of the source at 2 s and half the source at 16 s.
    const a = await decode(SOURCE, 2, 1);
    const b = await decode(SOURCE, 16, 1);
    const expected = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) expected[i] = a[i] + 0.5 * b[i];
    const got = await decode(wav, 2, 1);
    expect(got.length).toBe(expected.length);
    expect(corr(got, expected)).toBeGreaterThan(0.999);
    expect(rms(got) / rms(expected)).toBeGreaterThan(0.99);
    expect(rms(got) / rms(expected)).toBeLessThan(1.01);
    // Outside it (0.0–1.0 s), the base chain alone.
    const plain = await decode(wav, 0, 1);
    const ref = await decode(SOURCE, 0, 1);
    expect(corr(plain, ref)).toBeGreaterThan(0.999);
    expect(rms(plain) / rms(ref)).toBeGreaterThan(0.99);
    expect(rms(plain) / rms(ref)).toBeLessThan(1.01);
  }, 120_000);

  it('renders the one-pass audio as 48 kHz stereo PCM of the exact length', async () => {
    const { ffmpeg, ffprobe } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const wav = path.join(OUT, 'audio.wav');
    const graphPath = path.join(OUT, 'audio-graph.txt');
    // 300 segments: the inline form of this overran the Windows command line.
    const segments: Parameters<typeof audioPassArgs>[0]['segments'] = [];
    for (let i = 0; i < 100; i++) {
      segments.push({ kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 0, duration: 0.05 });
      segments.push({ kind: 'silence', duration: 0.01 });
      segments.push({ kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 15, duration: 0.05 });
    }
    const pass = audioPassArgs({ duration: 11, segments }, wav, graphPath);
    await fs.writeFile(graphPath, pass.graph);
    await run(ffmpeg, pass.args);
    const s = JSON.parse(await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', wav])) as { streams: Array<Record<string, string>>; format: { duration: string } };
    expect(s.streams[0].codec_name).toBe('pcm_s16le');
    expect(s.streams[0].sample_rate).toBe('48000');
    expect(s.streams[0].channels).toBe(2);
    expect(Math.abs(Number(s.format.duration) - 11)).toBeLessThan(0.001);
  }, 120_000);
});
