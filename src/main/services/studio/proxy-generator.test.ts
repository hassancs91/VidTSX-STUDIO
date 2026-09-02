import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ffmpeg is mocked at the runFfmpeg seam: each "transcode" just writes its
 * output file (the last arg) so the rename/skip/resume logic runs against a
 * real temp folder. Which commands ran, in what order, is what is asserted.
 */
const calls: string[][] = [];
const priorities: (string | undefined)[] = [];
let failOn: ((args: string[]) => boolean) | null = null;
let hangOn: ((args: string[]) => boolean) | null = null;

vi.mock('./ffmpeg-bin', () => ({
  getFfmpegBinary: async () => 'ffmpeg',
  runFfmpeg: async (
    _bin: string,
    args: string[],
    opts: { signal?: AbortSignal; onStdout?: (b: Buffer) => void; priority?: string },
  ) => {
    calls.push(args);
    priorities.push(opts.priority);
    if (hangOn?.(args)) {
      await new Promise<void>((_, reject) => opts.signal?.addEventListener('abort', () => reject(new Error('Cancelled'))));
    }
    if (failOn?.(args)) throw new Error('ffmpeg exited with code 1: boom');
    opts.onStdout?.(Buffer.from('out_time_us=5000000\n'));
    await fs.writeFile(args[args.length - 1], 'x');
  },
}));

let probeDuration = 200;
let probeHasAudio = true;
vi.mock('./media-import', () => ({
  probeMedia: async () => ({ duration: probeDuration, hasAudio: probeHasAudio }),
}));

let cacheDir = '';
vi.mock('./studio-paths', () => ({ getProjectCacheDir: async () => cacheDir }));

// ffprobe timing: segments report the source time they were cut at (they are
// encoded with -copyts); the source reports both streams starting together.
vi.mock('./proxy-concat', async () => {
  const actual = await vi.importActual<typeof import('./proxy-concat')>('./proxy-concat');
  return {
    ...actual,
    readTiming: async (_ffprobe: string, file: string) => {
      const m = /seg-(\d{4})\.mp4$/.exec(file);
      if (!m) return { startSec: 0, durationSec: probeDuration, videoStartSec: 0, audioStartSec: 0 };
      const start = Number(m[1]) * 60;
      return { startSec: start, durationSec: Math.min(60, probeDuration - start), videoStartSec: null, audioStartSec: null };
    },
  };
});

// The adapter probe is a real ffmpeg spawn; here every machine has one.
vi.mock('./proxy-hwaccel', () => ({
  detectDecodeArgs: async () => ['-hwaccel', 'd3d11va', '-hwaccel_device', '1'],
}));

vi.mock('../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }) },
}));

import { generateProxy, proxyRelPath } from './proxy-generator';

const outputArg = (args: string[]) => args[args.length - 1];
/** "seg-0002.mp4.<pid>.part.mp4" → "seg-0002.mp4" */
const targetName = (args: string[]) => path.basename(outputArg(args)).replace(/\.\d+\.part\.mp4$/, '');
const isSegment = (args: string[]) => args.includes('-an');
const isAudio = (args: string[]) => args.includes('-vn');
const isConcat = (args: string[]) => args.includes('concat');

describe('generateProxy (segmented, resumable)', () => {
  let root = '';
  let source = '';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-proxy-'));
    cacheDir = path.join(root, 'cache');
    source = path.join(root, 'source.mp4');
    await fs.writeFile(source, 'video');
    calls.length = 0;
    priorities.length = 0;
    failOn = null;
    hangOn = null;
    probeDuration = 200;
    probeHasAudio = true;
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  // First on purpose: "hwaccel unavailable" is a sticky module-level latch, so
  // this must observe the first hardware attempt before any other test trips it.
  it('tries hardware decode first, then latches to software after one failure', async () => {
      const hasHw = (args: string[]) => args.includes('-hwaccel');
      failOn = (args) => isSegment(args) && hasHw(args);
      await generateProxy('proj', 'asset-1', source);
      const segments = calls.filter(isSegment);
      // Window 0: hw attempt failed, redone in software; windows 1–3 never try hw again.
      expect(segments.map(hasHw)).toEqual([true, false, false, false, false]);
      expect(calls.filter(isConcat)).toHaveLength(1);
      expect(await fs.readdir(path.join(cacheDir, 'proxies'))).toEqual(['asset-1.mp4']);
  });

  it('cuts the source into windows, encodes audio once, joins, and leaves only the final .mp4', async () => {
    const percents: number[] = [];
    const rel = await generateProxy('proj', 'asset-1', source, undefined, (p) => percents.push(p));

    expect(rel).toBe(proxyRelPath('asset-1'));
    expect(rel).toBe('proxies/asset-1.mp4');
    // 200 s → 4 windows of 60 (the last open-ended), then audio, then concat.
    const segments = calls.filter(isSegment);
    expect(segments).toHaveLength(4);
    expect(segments[0]).not.toContain('-ss'); // first window starts at 0
    expect(segments[1].slice(segments[1].indexOf('-ss'), segments[1].indexOf('-ss') + 2)).toEqual(['-ss', '60']);
    expect(segments[3]).not.toContain('-to'); // final window runs to the end
    // The end edge is an absolute output-side -to (source pts kept by -copyts),
    // so both edges are judged on decoded frames: window 1 is [60, 120).
    expect(segments[1].slice(segments[1].indexOf('-to'), segments[1].indexOf('-to') + 2)).toEqual(['-to', '120']);
    for (const seg of segments.slice(0, 3)) {
      expect(seg.indexOf('-to')).toBeGreaterThan(seg.indexOf('-i'));
      expect(seg).toContain('-copyts');
    }
    expect(calls.filter(isAudio)).toHaveLength(1);
    expect(calls.filter(isConcat)).toHaveLength(1);
    expect(calls.map((c) => (isSegment(c) ? 'seg' : isAudio(c) ? 'audio' : 'concat'))).toEqual([
      'seg', 'seg', 'seg', 'seg', 'audio', 'concat',
    ]);

    // Final artefact in place, segment folder gone, no .part left anywhere.
    const proxiesDir = path.join(cacheDir, 'proxies');
    expect(await fs.readdir(proxiesDir)).toEqual(['asset-1.mp4']);
    // Progress reached exactly 100 and never went backwards.
    expect(percents.at(-1)).toBe(100);
    expect(percents.every((v, i) => i === 0 || v >= percents[i - 1])).toBe(true);
  });

  it('the concat list names segments relative to its own folder', async () => {
    // Capture the list before the folder is cleaned up.
    let listText = '';
    const origWrite = fs.writeFile;
    const spy = vi.spyOn(fs, 'writeFile').mockImplementation(async (p, data, o) => {
      if (String(p).endsWith('concat.txt')) listText = String(data);
      return origWrite(p, data, o as never);
    });
    await generateProxy('proj', 'asset-1', source);
    spy.mockRestore();
    expect(listText).toBe(
      "file 'seg-0000.mp4'\nduration 60.000000\nfile 'seg-0001.mp4'\nduration 60.000000\n" +
        "file 'seg-0002.mp4'\nduration 60.000000\nfile 'seg-0003.mp4'\nduration 20.000000\n",
    );
  });

  it('resumes: finished segments are skipped, the killed one is redone', async () => {
    // First run dies on the third window (as if the app was killed).
    failOn = (args) => isSegment(args) && outputArg(args).includes('seg-0002');
    await expect(generateProxy('proj', 'asset-1', source)).rejects.toThrow(/boom/);
    const segDir = path.join(cacheDir, 'proxies', 'asset-1');
    expect((await fs.readdir(segDir)).sort()).toEqual(['plan.json', 'seg-0000.mp4', 'seg-0001.mp4']);
    // The failed window left no .part behind.

    // Second run: only windows 2 and 3 encode, plus audio and concat.
    calls.length = 0;
    failOn = null;
    const percents: number[] = [];
    await generateProxy('proj', 'asset-1', source, undefined, (p) => percents.push(p));
    const segments = calls.filter(isSegment).map(targetName);
    expect(segments).toEqual(['seg-0002.mp4', 'seg-0003.mp4']);
    // Resumed progress starts from the two finished windows, not from 0:
    // one emission per skipped window, before any ffmpeg has run.
    expect(percents[0]).toBeGreaterThan(25);
    expect(percents[1]).toBeGreaterThan(50);
    expect(percents.at(-1)).toBe(100);
    expect(await fs.readdir(path.join(cacheDir, 'proxies'))).toEqual(['asset-1.mp4']);
  });

  it('cancel mid-window keeps the finished windows and drops the in-flight .part', async () => {
    const ac = new AbortController();
    hangOn = (args) => isSegment(args) && outputArg(args).includes('seg-0001');
    const run = generateProxy('proj', 'asset-1', source, ac.signal);
    // Let window 0 finish and window 1 start hanging, then cancel.
    await vi.waitFor(() => expect(calls.filter(isSegment)).toHaveLength(2));
    ac.abort();
    await expect(run).rejects.toThrow(/Cancelled/);
    const segDir = path.join(cacheDir, 'proxies', 'asset-1');
    expect((await fs.readdir(segDir)).sort()).toEqual(['plan.json', 'seg-0000.mp4']);
  });

  it('throws away segments built for a different source or profile', async () => {
    const segDir = path.join(cacheDir, 'proxies', 'asset-1');
    await fs.mkdir(segDir, { recursive: true });
    await fs.writeFile(path.join(segDir, 'seg-0000.mp4'), 'stale');
    await fs.writeFile(path.join(segDir, 'plan.json'), JSON.stringify({ version: 1, profile: 'something-else' }));
    await generateProxy('proj', 'asset-1', source);
    // All four windows were re-encoded — the stale one was not trusted.
    expect(calls.filter(isSegment)).toHaveLength(4);
  });

  it('a leftover .part from a killed ffmpeg is deleted, never counted as done', async () => {
    const segDir = path.join(cacheDir, 'proxies', 'asset-1');
    // Do a real first run to get a valid manifest, then simulate a kill.
    failOn = (args) => isSegment(args) && outputArg(args).includes('seg-0001');
    await expect(generateProxy('proj', 'asset-1', source)).rejects.toThrow();
    await fs.writeFile(path.join(segDir, 'seg-0001.mp4.99999.part.mp4'), 'no moov atom here');
    calls.length = 0;
    failOn = null;
    await generateProxy('proj', 'asset-1', source);
    const segments = calls.filter(isSegment).map(targetName);
    expect(segments).toEqual(['seg-0001.mp4', 'seg-0002.mp4', 'seg-0003.mp4']);
  });

  it('a silent source gets no audio pass and a video-only join', async () => {
    probeHasAudio = false;
    await generateProxy('proj', 'asset-1', source);
    expect(calls.filter(isAudio)).toHaveLength(0);
    const concat = calls.find(isConcat)!;
    expect(concat).not.toContain('1:a:0');
  });

  it('a short source is one open-ended window, same as the old single pass', async () => {
    probeDuration = 42;
    await generateProxy('proj', 'asset-1', source);
    const segments = calls.filter(isSegment);
    expect(segments).toHaveLength(1);
    expect(segments[0]).not.toContain('-ss');
    expect(segments[0]).not.toContain('-t');
  });

  it('every ffmpeg child — windows, audio, concat — runs at below-normal priority', async () => {
    await generateProxy('proj', 'asset-1', source);
    expect(priorities).toHaveLength(6);
    expect(priorities.every((p) => p === 'below-normal')).toBe(true);
  });
});
