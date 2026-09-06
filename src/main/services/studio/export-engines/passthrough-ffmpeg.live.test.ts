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
import { audioPassArgs, blackSpanArgs, concatListText, copySpanArgs, joinArgs } from './passthrough-ffmpeg';

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

  it('renders the one-pass audio as 48 kHz stereo PCM of the exact length', async () => {
    const { ffmpeg, ffprobe } = bins();
    await fs.mkdir(OUT, { recursive: true });
    const wav = path.join(OUT, 'audio.wav');
    await run(ffmpeg, audioPassArgs({
      duration: 11,
      segments: [
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 0, duration: 5 },
        { kind: 'silence', duration: 1 },
        { kind: 'source', assetId: 'a', assetPath: SOURCE, sourceIn: 15, duration: 5 },
      ],
    }, wav));
    const s = JSON.parse(await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', wav])) as { streams: Array<Record<string, string>>; format: { duration: string } };
    expect(s.streams[0].codec_name).toBe('pcm_s16le');
    expect(s.streams[0].sample_rate).toBe('48000');
    expect(s.streams[0].channels).toBe(2);
    expect(Math.abs(Number(s.format.duration) - 11)).toBeLessThan(0.001);
  }, 120_000);
});
