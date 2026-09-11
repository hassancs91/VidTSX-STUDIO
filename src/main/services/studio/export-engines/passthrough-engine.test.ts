// The passthrough engine on machines this one is not (Item 3, 2026-09-11):
// the encoder probe is mocked so the ONLY working encoder can be Intel Quick
// Sync or AMD AMF — `availability()` accepts it, `produce()` names it to the
// queue (`onEncoderResolved`) and hands every ffmpeg run that vendor's line;
// and the development override picks a probed-working encoder only. Nothing
// spawns: ffmpeg, ffprobe, the audio pass and the browser are faked at their
// module seams; the span planner and the argument builders are the real ones.
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioClip, StudioProject } from '../../../../shared/types/studio';
import type { StudioExportEntry } from '../export-entry';
import type { ProxyGpuEncoder } from '../proxy-encoders';

const state = { binary: null as string | null, working: [] as ProxyGpuEncoder[], runs: [] as string[][] };

vi.mock('../../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));
vi.mock('../ffmpeg-full', () => ({
  getFfmpegFullBinary: async () => state.binary,
  probeProxyEncoders: async () => ({ listed: ['nvenc', 'qsv', 'amf'], working: state.working, probedAt: 'now' }),
}));
vi.mock('../ffmpeg-bin', () => ({
  runFfmpeg: async (_binary: string, args: string[]) => {
    state.runs.push(args);
    await fs.writeFile(args[args.length - 1], '');
  },
}));
vi.mock('./passthrough-probe', () => ({
  ffprobeBeside: (ffmpeg: string) => ffmpeg.replace('ffmpeg', 'ffprobe'),
  probeSource: async () => ({
    frameRate: { num: 60000, den: 1001 },
    averageFrameRate: { num: 60000, den: 1001 },
    startTime: 0,
    timeBase: { num: 1, den: 60000 },
    hasAudio: true,
  }),
}));
vi.mock('./passthrough-audio', () => ({
  producePassthroughAudio: async () => ({ audioPath: 'audio.m4a', notes: ['audio note'] }),
}));
vi.mock('./passthrough-browser', () => ({ renderBrowserSpan: async () => undefined }));
vi.mock('child_process', () => ({
  // `countPackets`: every piece holds exactly its span's 450 frames.
  spawn: () => {
    const proc = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} });
    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('450\n'));
      proc.emit('close', 0);
    });
    return proc;
  },
}));

import { EXPORT_GPU_ENCODER_ENV, NEEDS_DOWNLOAD, NO_WORKING_ENCODER, passthroughExportEngine, pickExportEncoder } from './passthrough-engine';
import { EXPORT_COLOR } from './types';

const DJI = 'C:\\raw\\DJI_20260813142309_0270_D.MP4';
const ASSET = 'asset-0270';
const clip = (id: string, timelineStart: number, duration: number, sourceIn: number): StudioClip => ({
  id, kind: 'video', assetId: ASSET, timelineStart, duration, sourceIn, origin: { by: 'user' },
});
/** `t5-1080p-cut`: two plain cuts of one file — two copy spans of 450 frames. */
const project: StudioProject = {
  schemaVersion: 1,
  id: 't',
  name: 't',
  createdAt: '',
  updatedAt: '',
  settings: { width: 1920, height: 1080, fps: 30, agent: {} },
  assets: [{ id: ASSET, kind: 'video', path: DJI, probe: { duration: 139.022233, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } }],
  timeline: {
    tracks: [
      { id: 'v1', kind: 'video', name: 'V1', clips: [clip('a', 0, 15, 0), clip('b', 15, 15, 15)] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ],
  },
  proposals: [],
  shots: [],
};
const entry: StudioExportEntry = { entryPath: 'entry.tsx', compositionId: 'c', width: 1920, height: 1080, fps: 30, durationInFrames: 900 };

let workDir = '';

async function produce() {
  const resolved: Array<{ encoderName: string; hardwareAccelerated: boolean }> = [];
  const product = await passthroughExportEngine.produce({
    jobId: 'job',
    project,
    entry,
    bundleUrl: 'http://127.0.0.1/bundle',
    workDir,
    render: { timeoutInMilliseconds: 1000 },
    color: EXPORT_COLOR,
    signal: new AbortController().signal,
    onProgress: () => {},
    onEncoderResolved: (info) => resolved.push(info),
  });
  return { product, resolved };
}

const encoderOf = (args: string[]) => args[args.indexOf('-c:v') + 1];

describe('passthrough engine: the encoder this machine has', () => {
  beforeEach(async () => {
    state.binary = 'C:/userData/ffmpeg-full/bin/ffmpeg.exe';
    state.working = [];
    state.runs = [];
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-pt-engine-'));
  });
  afterEach(async () => {
    delete process.env[EXPORT_GPU_ENCODER_ENV];
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  it('availability: the download first, then a working encoder — any of the three', async () => {
    state.binary = null;
    expect(await passthroughExportEngine.availability()).toEqual({ available: false, reason: NEEDS_DOWNLOAD });
    state.binary = 'C:/x/ffmpeg.exe';
    expect(await passthroughExportEngine.availability()).toEqual({ available: false, reason: NO_WORKING_ENCODER });
    for (const only of ['nvenc', 'qsv', 'amf'] as const) {
      state.working = [only];
      expect(await passthroughExportEngine.availability(), only).toEqual({ available: true });
    }
  });

  it('Intel Quick Sync as the only working encoder: named h264_qsv, every run on h264_qsv into nv12, no CUDA anywhere', async () => {
    state.working = ['qsv'];
    const { product, resolved } = await produce();
    expect(resolved).toEqual([{ encoderName: 'h264_qsv', hardwareAccelerated: true }]);
    expect(state.runs).toHaveLength(2);
    for (const args of state.runs) {
      expect(encoderOf(args)).toBe('h264_qsv');
      expect(args.join(' ')).not.toContain('cuda');
      expect(args.join(' ')).toContain(',scale=w=1920:h=1080,format=nv12,setpts=N/(30*TB),setparams=');
      expect(args.join(' ')).toContain('-preset medium -global_quality 23 -bf 2 -g 60');
    }
    expect(product.notes?.[0]).toBe('Copied 100 % of this timeline (2 of 2 spans).');
    expect(product.notes).toContain('audio note');
    expect(product).toMatchObject({ videoDemuxer: 'concat', frames: 900, audioPath: 'audio.m4a' });
    const list = await fs.readFile(product.videoPath, 'utf-8');
    expect(list.match(/^file /gm)).toHaveLength(2);
  });

  it('AMD AMF as the only working encoder: named h264_amf, CQP 23 on I/P/B, yuv420p in, no CUDA', async () => {
    state.working = ['amf'];
    const { resolved } = await produce();
    expect(resolved).toEqual([{ encoderName: 'h264_amf', hardwareAccelerated: true }]);
    expect(state.runs).toHaveLength(2);
    for (const args of state.runs) {
      expect(encoderOf(args)).toBe('h264_amf');
      expect(args.join(' ')).not.toContain('cuda');
      expect(args.join(' ')).toContain(',scale=w=1920:h=1080,format=yuv420p,setpts=N/(30*TB),setparams=');
      expect(args.join(' ')).toContain('-quality balanced -rc cqp -qp_i 23 -qp_p 23 -qp_b 23 -bf 2 -g 60');
    }
  });

  it('with all three working, NVENC is preferred and the whole pipeline stays on the card', async () => {
    state.working = ['amf', 'qsv', 'nvenc'];
    const { resolved } = await produce();
    expect(resolved).toEqual([{ encoderName: 'h264_nvenc', hardwareAccelerated: true }]);
    for (const args of state.runs) {
      expect(encoderOf(args)).toBe('h264_nvenc');
      expect(args.join(' ')).toContain('-hwaccel cuda -hwaccel_output_format cuda');
    }
  });

  it(`${EXPORT_GPU_ENCODER_ENV} forces a PROBED-WORKING encoder only (the runbook's way to exercise QSV/AMF beside NVENC)`, async () => {
    state.working = ['nvenc', 'qsv'];
    process.env[EXPORT_GPU_ENCODER_ENV] = 'qsv';
    expect((await produce()).resolved).toEqual([{ encoderName: 'h264_qsv', hardwareAccelerated: true }]);
    expect(state.runs.every((a) => encoderOf(a) === 'h264_qsv' && !a.join(' ').includes('cuda'))).toBe(true);
    // A vendor the probe did not open here is never forced; nonsense is ignored.
    state.runs = [];
    process.env[EXPORT_GPU_ENCODER_ENV] = 'amf';
    expect((await produce()).resolved).toEqual([{ encoderName: 'h264_nvenc', hardwareAccelerated: true }]);
    process.env[EXPORT_GPU_ENCODER_ENV] = 'x264';
    expect((await produce()).resolved).toEqual([{ encoderName: 'h264_nvenc', hardwareAccelerated: true }]);
  });

  it('pickExportEncoder: preference order, or the forced working one', () => {
    expect(pickExportEncoder(['amf', 'qsv', 'nvenc'], undefined)).toBe('nvenc');
    expect(pickExportEncoder(['amf', 'qsv'], undefined)).toBe('qsv');
    expect(pickExportEncoder(['amf'], undefined)).toBe('amf');
    expect(pickExportEncoder([], undefined)).toBeNull();
    expect(pickExportEncoder(['nvenc', 'qsv', 'amf'], 'amf')).toBe('amf');
    expect(pickExportEncoder(['nvenc', 'qsv'], 'amf')).toBe('nvenc');
    expect(pickExportEncoder([], 'qsv')).toBeNull();
    expect(pickExportEncoder(['nvenc'], '')).toBe('nvenc');
  });
});
