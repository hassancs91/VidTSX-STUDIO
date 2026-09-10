// The three ffmpeg-backed nodes (W8 Stage 3) against fake edits: what each
// asks the media helper for, what it files, and the artifact it returns. The
// library root is a temp folder; the index write is stubbed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';

let root = '';
const upserts: Array<{ relPath: string; description?: string; brandId?: string }> = [];

vi.mock('../../../utils/paths', () => ({ getRemotionBinariesDir: () => null, getAssetsDir: () => root }));
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => root,
  getLibraryRoot: () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../library/library-store', () => ({
  upsertEntry: async (_r: string, relPath: string, meta: { description?: string; brandId?: string }) => {
    upserts.push({ relPath, description: meta.description, brandId: meta.brandId });
    return { relPath };
  },
}));
vi.mock('../../library/brand-store', () => ({
  readBrand: async (_r: string, id: string) => (id === 'acme' ? { id: 'acme', name: 'Acme' } : null),
}));

const { extractFrameTool, setExtractFrameDepsForTests } = await import('./extract-frame');
const { trimVideoTool, setTrimVideoDepsForTests } = await import('./trim-video');
const { concatVideosTool, setConcatVideosDepsForTests } = await import('./concat-videos');
const { stripTimes, trimArgs, concatArgs, extractFrameArgs } = await import('../../media/video-edit');

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

const clip = (id: string, relPath: string, seconds = 10): AgentArtifact => ({
  id,
  kind: 'video',
  title: `Clip ${id}`,
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'input_video_file', callId: 'c0' },
  payload: { relPath, durationSeconds: seconds, width: 1920, height: 1080 },
});

const PROBE = { duration: 10, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: true };

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-media-'));
  upserts.length = 0;
  await fs.mkdir(path.join(root, 'flows', 'x', 'inputs'), { recursive: true });
  await fs.writeFile(path.join(root, 'flows', 'x', 'inputs', 'a.mp4'), 'a');
  await fs.writeFile(path.join(root, 'flows', 'x', 'inputs', 'b.mp4'), 'b');
});

afterEach(async () => {
  setExtractFrameDepsForTests(null);
  setTrimVideoDepsForTests(null);
  setConcatVideosDepsForTests(null);
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const ctx = (artifacts: AgentArtifact[]) =>
  makeToolContext({ artifacts, libraryFolder: 'flows/x', featureSource: 'flows', brandId: 'acme' });

describe('extract_frame', () => {
  it('a single frame at the time on the port, filed under frames/ with its dimensions and the brand', async () => {
    const calls: Array<{ atSeconds: number; output: string }> = [];
    setExtractFrameDepsForTests({
      probe: async () => PROBE,
      extract: async (o) => {
        calls.push({ atSeconds: o.atSeconds, output: o.output });
        await fs.writeFile(o.output, png(1280, 720));
      },
    });
    const res = await extractFrameTool.handler({ video: 'video-1', atSeconds: 2.5 }, ctx([clip('video-1', 'flows/x/inputs/a.mp4')]));
    expect(res.isError).toBeUndefined();
    expect(calls).toEqual([{ atSeconds: 2.5, output: path.join(root, 'flows', 'x', 'frames', 'f2-50s-a.png') }]);
    expect(res.artifact).toEqual({
      kind: 'image-set',
      title: 'Frame of Clip video-1',
      payload: { items: [{ relPath: 'flows/x/frames/f2-50s-a.png', width: 1280, height: 720 }] },
    });
    expect(upserts[0]).toMatchObject({ relPath: 'flows/x/frames/f2-50s-a.png', brandId: 'acme' });
  });

  it('a strip samples the centre of N slices, in order, into one image-set', async () => {
    const times: number[] = [];
    setExtractFrameDepsForTests({
      probe: async () => PROBE,
      extract: async (o) => {
        times.push(o.atSeconds);
        await fs.writeFile(o.output, png(8, 8));
      },
    });
    const res = await extractFrameTool.handler({ video: 'video-1', count: 4, format: 'jpg' }, ctx([clip('video-1', 'flows/x/inputs/a.mp4')]));
    expect(res.isError).toBeUndefined();
    expect(times).toEqual(stripTimes(10, 4, 0));
    expect(times.map((t) => Math.round(t * 100) / 100)).toEqual([1.24, 3.73, 6.22, 8.71]);
    expect(res.artifact?.kind).toBe('image-set');
    expect(res.artifact?.kind === 'image-set' ? res.artifact.payload.items.map((i) => path.extname(i.relPath)) : []).toEqual(['.jpg', '.jpg', '.jpg', '.jpg']);
  });

  it('refuses a missing artifact and an input without video', async () => {
    setExtractFrameDepsForTests({ probe: async () => ({ ...PROBE, hasVideo: false }), extract: async () => {} });
    expect((await extractFrameTool.handler({ video: 'video-9' }, ctx([]))).isError).toBe(true);
    const res = await extractFrameTool.handler({ video: 'video-1' }, ctx([clip('video-1', 'flows/x/inputs/a.mp4')]));
    expect(res.content[0].text).toContain('no video stream');
  });
});

describe('trim_video', () => {
  it('trims [start, end] into a new library file and returns a video artifact from the output probe', async () => {
    const seen: Array<Record<string, unknown>> = [];
    setTrimVideoDepsForTests({
      trim: async (o) => {
        seen.push({ input: o.input, output: o.output, startSeconds: o.startSeconds, endSeconds: o.endSeconds, mode: o.mode });
        await fs.writeFile(o.output, 't');
        return { ...PROBE, duration: 3, hasAudio: false };
      },
    });
    const res = await trimVideoTool.handler({ video: 'video-1', startSeconds: 2, endSeconds: 5, mode: 'fast' }, ctx([clip('video-1', 'flows/x/inputs/a.mp4')]));
    expect(res.isError).toBeUndefined();
    expect(seen[0]).toEqual({
      input: path.join(root, 'flows', 'x', 'inputs', 'a.mp4'),
      output: path.join(root, 'flows', 'x', 'a-trim.mp4'),
      startSeconds: 2,
      endSeconds: 5,
      mode: 'fast',
    });
    expect(res.artifact).toMatchObject({ kind: 'video', payload: { relPath: 'flows/x/a-trim.mp4', durationSeconds: 3, hasAudio: false } });
  });

  it('argument builders: precise re-encodes, fast copies, a frame grab seeks before the input', () => {
    expect(trimArgs({ input: 'C:\\v\\a.mp4', output: 'C:\\v\\o.mp4', startSeconds: 1, endSeconds: 4, mode: 'fast' })).toEqual([
      '-ss', '1.000', '-i', 'C:/v/a.mp4', '-t', '3.000', '-c', 'copy', '-movflags', '+faststart', 'C:/v/o.mp4',
    ]);
    expect(trimArgs({ input: 'a.mp4', output: 'o.mp4', startSeconds: 0, endSeconds: 2, mode: 'precise' })).toContain('libx264');
    expect(extractFrameArgs({ input: 'a.mp4', output: 'f.jpg', atSeconds: 1.5 })).toEqual(['-ss', '1.500', '-i', 'a.mp4', '-frames:v', '1', '-q:v', '2', 'f.jpg']);
  });
});

describe('concat_videos', () => {
  it('joins every clip on the port in order and returns one video', async () => {
    let inputs: string[] = [];
    setConcatVideosDepsForTests({
      concat: async (o) => {
        inputs = o.inputs;
        await fs.writeFile(o.output, 'j');
        return { ...PROBE, duration: 20 };
      },
    });
    const res = await concatVideosTool.handler(
      { videos: ['video-1', 'video-2'], name: 'both' },
      ctx([clip('video-1', 'flows/x/inputs/a.mp4'), clip('video-2', 'flows/x/inputs/b.mp4')]),
    );
    expect(res.isError).toBeUndefined();
    expect(inputs.map((p) => path.basename(p))).toEqual(['a.mp4', 'b.mp4']);
    expect(res.artifact).toMatchObject({ kind: 'video', title: 'Joined (2 clips)', payload: { relPath: 'flows/x/both.mp4', durationSeconds: 20 } });
    expect(upserts[0]).toMatchObject({ relPath: 'flows/x/both.mp4', description: 'Joined: Clip video-1 + Clip video-2' });
  });

  it('the concat filter scales-and-crops to the first clip (no pad/fps/setsar in this ffmpeg) and gives a silent clip a silent track', () => {
    const args = concatArgs(
      [
        { path: 'a.mp4', probe: { ...PROBE, width: 1280, height: 720, fps: 25 } },
        { path: 'b.mp4', probe: { ...PROBE, hasAudio: false, duration: 4 } },
      ],
      'out.mp4',
    );
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuv420p[v0]');
    expect(args.slice(args.indexOf('-r'), args.indexOf('-r') + 2)).toEqual(['-r', '25']);
    expect(filter).toContain('[2:a]anull[a1]');
    expect(filter).toContain('concat=n=2:v=1:a=1[v][a]');
    expect(args).toContain('anullsrc=r=48000:cl=stereo');
    expect(args.slice(args.indexOf('-t') + 1)[0]).toBe('4.000');
  });
});
