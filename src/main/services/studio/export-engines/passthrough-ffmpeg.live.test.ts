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
import { finishMuxArgs } from './finishing';
import { audioPassArgs, blackSpanArgs, concatListText, copySpanArgs, holdLastFrameArgs, remotionTrimMicros, remotionVolumeExpression } from './passthrough-ffmpeg';

/** The join as the finishing mux does it: the concat list read as the video input, no audio (Stage 4). */
const joinArgs = (listPath: string, outputPath: string, color: typeof EXPORT_COLOR) =>
  finishMuxArgs({ videoPath: listPath, videoDemuxer: 'concat', audioPath: listPath, audio: 'none', outputPath, color, moovBytes: 4 << 20 });

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

  it('a faded segment is Remotion\'s own chain sample for sample: the staircase on the decoder\'s buffers, lag 0 (Stage 3 slice 3)', async () => {
    const { ffmpeg } = bins();
    await fs.mkdir(OUT, { recursive: true });
    // A 1 s fade-in whose first frame Remotion drops (the asset starts at frame 1 of the fade), then 1 s flat, at gain 0.5.
    const volumes: number[] = [];
    for (let f = 0; f < 59; f++) volumes.push(0.5 * Math.min(1, (f + 1) / 30));
    const sourceIn = 15 + 1 / 30;
    const wav = path.join(OUT, 'fade-audio.wav');
    const graphPath = path.join(OUT, 'fade-audio-graph.txt');
    const pass = audioPassArgs({
      duration: 3,
      fps: 30,
      segments: [
        { kind: 'silence', duration: 1 + 1 / 30 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn, duration: 59 / 30 },
      ].map((seg) => (seg.kind === 'source' ? { ...seg, volumes } : seg)) as Parameters<typeof audioPassArgs>[0]['segments'],
    }, wav, graphPath);
    await fs.writeFile(graphPath, pass.graph);
    await run(ffmpeg, pass.args);
    // Remotion's preprocess chain for the same asset (preprocess-audio-track.js + stringify-ffmpeg-filter.js), verbatim.
    const ref = path.join(OUT, 'fade-remotion.wav');
    const expr = remotionVolumeExpression(volumes, sourceIn, 30);
    await run(ffmpeg, ['-y', '-v', 'error', '-nostdin', '-vn', '-i', SOURCE, '-ac', '2',
      '-af', `aformat=sample_fmts=s16:sample_rates=48000,atrim=start=15.0333333333:end=17,volume='${expr}':eval=frame`,
      '-c:a', 'pcm_s16le', '-ar', '48000', ref]);
    const decode = (file: string, extra: string[] = []) => new Promise<Float32Array>((resolve, reject) => {
      const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', ...extra, '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
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
    // Whole files, indexed by sample: ours starts the segment after 1 + 1/30 s = 49,600 samples of silence.
    const ours = await decode(wav);
    const theirs = await decode(ref);
    const lead = 49_600;
    const win = 4_800;
    // 100 ms windows inside the ramp and on the flat part: the same samples (s16 rounding apart), the same
    // level, and the best lag over ±2 samples is 0 — the silence and the trim place the segment exactly.
    for (const off of [0, 12_000, 26_400, 70_400]) {
      const b = theirs.subarray(off, off + win);
      let best = { lag: 99, c: -2 };
      for (let lag = -2; lag <= 2; lag++) {
        const c = corr(ours.subarray(lead + off + lag, lead + off + lag + win), b);
        if (c > best.c) best = { lag, c };
      }
      expect(best.lag).toBe(0);
      expect(best.c).toBeGreaterThan(0.9999);
      const a = ours.subarray(lead + off, lead + off + win);
      expect(rms(a) / rms(b)).toBeGreaterThan(0.998);
      expect(rms(a) / rms(b)).toBeLessThan(1.002);
    }
    // And the ramp really ramps: the flat part at 0.5 of the camera file (0.505 after Remotion's 1/97 rounding), the first 100 ms at a fraction of it.
    const flat = ours.subarray(lead + 70_400, lead + 70_400 + 24_000);
    const cam = await decode(SOURCE, ['-ss', String(sourceIn + 70_400 / 48_000), '-t', '0.5']);
    expect(rms(flat) / rms(cam)).toBeGreaterThan(0.5);
    expect(rms(flat) / rms(cam)).toBeLessThan(0.515);
    const early = ours.subarray(lead, lead + win);
    const camEarly = await decode(SOURCE, ['-ss', String(sourceIn), '-t', '0.1']);
    expect(rms(early) / rms(camEarly)).toBeLessThan(0.06);
  }, 120_000);

  it('a sped segment is Remotion\'s atempo chain bit for bit, and a curve on it sits on the post-tempo time line (Stage 3 slice 4)', async () => {
    const { ffmpeg } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const pcm = (file: string, extra: string[] = []) => new Promise<Buffer>((resolve, reject) => {
      const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', ...extra, '-i', file, '-vn', '-f', 's16le', '-']);
      const chunks: Buffer[] = [];
      p.stdout.on('data', (c: Buffer) => chunks.push(c));
      p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('decode failed'))));
    });
    // 1. The speed seed's clip B: 15 s of the camera file from 15 s at 1.5×, after 1 s of silence. Remotion's chain run
    //    directly (`aformat s16 48k, atempo=1.50000, atrim` at post-tempo times — slice 3 measured it bit-identical to
    //    Remotion's bundled ffmpeg 7.1 and lag 0 / level 1.000 against the real export) must be the pass's samples exactly.
    const wav = path.join(OUT, 'speed-audio.wav');
    const graphPath = path.join(OUT, 'speed-audio-graph.txt');
    const pass = audioPassArgs({
      duration: 4,
      segments: [
        { kind: 'silence', duration: 1 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 15, duration: 3, rate: 1.5 },
      ],
    }, wav, graphPath);
    await fs.writeFile(graphPath, pass.graph);
    await run(ffmpeg, pass.args);
    const ref = path.join(OUT, 'speed-remotion.wav');
    await run(ffmpeg, ['-y', '-v', 'error', '-nostdin', '-vn', '-i', SOURCE,
      '-af', 'aformat=sample_fmts=s16:sample_rates=48000,atempo=1.50000,atrim=10000000us:13000000us',
      '-c:a', 'pcm_s16le', ref]);
    const ours = await pcm(wav);
    const theirs = await pcm(ref);
    const lead = 48_000 * 4; // 1 s of stereo s16
    expect(ours.length).toBe(48_000 * 4 * 4);
    expect(theirs.length).toBe(48_000 * 4 * 3);
    expect(Buffer.compare(ours.subarray(lead, lead + theirs.length), theirs)).toBe(0);
    expect(ours.subarray(0, lead).every((b) => b === 0)).toBe(true);

    // 2. The same segment with a 1 s fade-in at gain 0.5 whose first frame Remotion drops: the asset starts at the source
    //    instant of frame 1 (450 + 1.5 frames), its trim point (450/30)/1.5 + 1/30 on the stretched stream, and its
    //    windows are 1/30 of POST-tempo audio each — Remotion's stringify-ffmpeg-filter.js chain for a sped asset with a
    //    volume array (getActualTrimLeft seamless: audioStartFrame/fps/rate + sinceStart/fps; ffmpegVolumeExpression with
    //    trimLeft = that). Run verbatim, it must again be the pass's samples exactly.
    const volumes: number[] = [];
    for (let f = 0; f < 89; f++) volumes.push(0.5 * Math.min(1, (f + 1) / 30));
    const sourceIn = (450 + 1.5) / 30;
    const trimLeft = 450 / 30 / 1.5 + 1 / 30;
    const wav2 = path.join(OUT, 'speed-fade-audio.wav');
    const graphPath2 = path.join(OUT, 'speed-fade-audio-graph.txt');
    const pass2 = audioPassArgs({
      duration: 4,
      fps: 30,
      segments: [
        { kind: 'silence', duration: 1 + 1 / 30 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn, duration: 89 / 30, rate: 1.5, volumes },
      ],
    }, wav2, graphPath2);
    await fs.writeFile(graphPath2, pass2.graph);
    await run(ffmpeg, pass2.args);
    const ref2 = path.join(OUT, 'speed-fade-remotion.wav');
    const expr = remotionVolumeExpression(volumes, trimLeft, 30);
    await run(ffmpeg, ['-y', '-v', 'error', '-nostdin', '-vn', '-i', SOURCE,
      '-af', `aformat=sample_fmts=s16:sample_rates=48000,atempo=1.50000,atrim=${remotionTrimMicros(trimLeft)}:${remotionTrimMicros(trimLeft + 89 / 30)},volume='${expr}':eval=frame`,
      '-c:a', 'pcm_s16le', ref2]);
    const ours2 = await pcm(wav2);
    const theirs2 = await pcm(ref2);
    const lead2 = Math.round((1 + 1 / 30) * 48_000) * 4;
    expect(Buffer.compare(ours2.subarray(lead2, lead2 + theirs2.length), theirs2)).toBe(0);
    // And the curve really is a fade on the stretched audio: the flat part at 0.505 of the plain sped segment, the first 100 ms far below it.
    const rms = (b: Buffer, from: number, len: number) => {
      let acc = 0;
      for (let i = from; i < from + len; i += 2) { const v = b.readInt16LE(i); acc += v * v; }
      return Math.sqrt(acc / (len / 2));
    };
    const flat2 = rms(ours2, lead2 + 48_000 * 4 * 2, 43_200 * 4);            // 2–2.9 s into the faded segment (frames 60–89: flat)
    const flat1 = rms(ours, lead + 48_000 * 4 * 2 + 1_600 * 4, 43_200 * 4);  // the same stretched audio in the plain run (its segment starts 1 frame earlier)
    expect(flat2 / flat1).toBeGreaterThan(0.495);
    expect(flat2 / flat1).toBeLessThan(0.515);
    expect(rms(ours2, lead2, 4_800 * 4) / rms(ours, lead + 1_600 * 4, 4_800 * 4)).toBeLessThan(0.06);
  }, 180_000);

  it('a slow span (rate < 1, 2026-09-11) fills every slot: exact counts at 0.25x and 0.5x, from a clip offset, pts on the grid, two runs byte-identical', async () => {
    const { ffmpeg, ffprobe } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const tb = { num: 1, den: 60000 };
    // The slow4 seed's clip B, its first 60 slots: K 899, 900, 900, 901, 901 ... (30 distinct frames, each on two slots).
    const q = path.join(OUT, 'slow-quarter.ts');
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 450, frames: 60, firstFrameCeil: false, rate: 0.25, trimBefore: 450, clipOffset: 0, timeBase: tb, outputPath: q }));
    const pq = await probeFrames(ffprobe, q);
    expect(pq.count).toBe(60);
    expect(pq.pts.map((t, i) => Math.abs(t - pq.pts[0] - i / 30)).filter((d) => d > 1e-4)).toEqual([]);
    // The slow seed's clip B at 0.5x: one source frame per slot here (the first repeat is at slot 602).
    const h = path.join(OUT, 'slow-half.ts');
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 450, frames: 60, firstFrameCeil: false, rate: 0.5, trimBefore: 450, clipOffset: 0, timeBase: tb, outputPath: h }));
    expect((await probeFrames(ffprobe, h)).count).toBe(60);
    // A span that starts 180 slots into the clip (after an overlay): its slots count from the clip start.
    const o = path.join(OUT, 'slow-offset.ts');
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 450 + 180 * 0.25, frames: 30, firstFrameCeil: false, rate: 0.25, trimBefore: 450, clipOffset: 180, timeBase: tb, outputPath: o }));
    expect((await probeFrames(ffprobe, o)).count).toBe(30);
    // Determinism, as for every copied span.
    const q2 = path.join(OUT, 'slow-quarter-2.ts');
    await run(ffmpeg, copySpanArgs({ ...base, sourceFrame: 450, frames: 60, firstFrameCeil: false, rate: 0.25, trimBefore: 450, clipOffset: 0, timeBase: tb, outputPath: q2 }));
    expect(Buffer.compare(await fs.readFile(q), await fs.readFile(q2))).toBe(0);
  }, 180_000);

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
