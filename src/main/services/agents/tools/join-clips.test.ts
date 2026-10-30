// `join_clips` through a fake render seam: the clips probed in edge order, the
// plan handed to the entry, the render asked for the self-registering
// composition at the plan's size, rate and length, the MP4 filed and returned
// as a `video` artifact, and the entry cleaned up whatever happens.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';
import type { JoinPlan } from '../../../../shared/media/join-plan';
import type { MediaProbe } from '../../media/ffmpeg-run';
import type { RenderTsxOptions } from '../../media/remotion-render';
import { makeToolContext } from './test-context';

let root = '';
const upserts: Array<{ relPath: string; description?: string }> = [];

vi.mock('../../../utils/paths', () => ({ getRemotionBinariesDir: () => null, getAssetsDir: () => root, getAppRoot: () => root }));
vi.mock('../../media/join-entry', () => ({
  JOIN_COMPOSITION_ID: 'join-clips',
  createJoinEntry: async () => { throw new Error('not in tests'); },
}));
vi.mock('../../remotion-bundler', () => ({ ensureAssetServerUrl: async () => 'http://127.0.0.1:3100' }));
vi.mock('../../media/remotion-render', () => ({ renderTsxToMp4: async () => { throw new Error('not in tests'); } }));
vi.mock('../../media/ffmpeg-run', () => ({ probeMedia: async () => { throw new Error('not in tests'); } }));
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => root,
  getLibraryRoot: () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../library/library-store', () => ({
  upsertEntry: async (_r: string, relPath: string, meta: { description?: string }) => {
    upserts.push({ relPath, description: meta.description });
    return { relPath };
  },
}));
vi.mock('../../library/brand-store', () => ({ readBrand: async () => null }));

const { joinClipsTool, setJoinClipsDepsForTests } = await import('./join-clips');

const clip = (id: string, file: string, title: string): AgentArtifact => ({
  id,
  kind: 'video',
  title,
  createdAt: '2026-10-30T00:00:00.000Z',
  producer: { tool: 'generate_video', callId: 'c0' },
  payload: { relPath: `flows/x/${file}`, durationSeconds: 10, width: 1080, height: 1920 },
});
const STAGING = clip('video-1', 'staging.mp4', 'Staging');
const GLIDE = clip('video-2', 'glide.mp4', 'Glide');

/** ffprobe of the lab clips: Kling 3 Pro, 1080x1920 at 24 fps, no audio. */
const PROBES: Record<string, MediaProbe> = {
  'staging.mp4': { duration: 241 / 24, width: 1080, height: 1920, fps: 24, hasVideo: true, hasAudio: false },
  'glide.mp4': { duration: 145 / 24, width: 1080, height: 1920, fps: 24, hasVideo: true, hasAudio: false },
  'reel.mp4': { duration: 386 / 24, width: 1080, height: 1920, fps: 24, hasVideo: true, hasAudio: false },
};

interface Seen {
  entries: Array<{ plan: JoinPlan; paths: readonly string[]; port: number }>;
  renders: RenderTsxOptions[];
  cleaned: number;
}

function fakeDeps(overrides: { probe?: (p: string) => Promise<MediaProbe>; render?: (o: RenderTsxOptions) => Promise<void> } = {}): Seen {
  const seen: Seen = { entries: [], renders: [], cleaned: 0 };
  setJoinClipsDepsForTests({
    probe: overrides.probe ?? (async (p) => PROBES[path.basename(p)]),
    assetServerUrl: async () => 'http://127.0.0.1:4123',
    createEntry: async (plan, paths, port) => {
      seen.entries.push({ plan, paths, port });
      return { entryPath: path.join(root, 'entry.tsx'), cleanup: async () => { seen.cleaned += 1; } };
    },
    render: async (o) => {
      seen.renders.push(o);
      if (overrides.render) await overrides.render(o);
      o.onProgress?.('bundling', 100);
      o.onProgress?.('rendering', 50);
      await fs.writeFile(o.outputPath, 'mp4');
      return { outputPath: o.outputPath, fileSize: 3, width: o.width ?? 0, height: o.height ?? 0, fps: o.fps ?? 0, durationInFrames: o.durationInFrames ?? 0 };
    },
  });
  return seen;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-join-'));
  upserts.length = 0;
  await fs.mkdir(path.join(root, 'flows', 'x'), { recursive: true });
  await fs.writeFile(path.join(root, 'flows', 'x', 'staging.mp4'), 'a');
  await fs.writeFile(path.join(root, 'flows', 'x', 'glide.mp4'), 'b');
});

afterEach(async () => {
  setJoinClipsDepsForTests(null);
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const ctx = (extra: Parameters<typeof makeToolContext>[0] = {}) =>
  makeToolContext({ artifacts: [STAGING, GLIDE], libraryFolder: 'flows/x', featureSource: 'flows', ...extra });

describe('join_clips', () => {
  it('joins the lab clips with a dip at 1080x1920, 24 fps: 386 frames, filed in the library', async () => {
    const seen = fakeDeps();
    const progress: string[] = [];
    const res = await joinClipsTool.handler(
      { videos: ['video-1', 'video-2'], transition: 'dip-to-black', fadeOutSeconds: 0.25, fadeInSeconds: 0.3, width: 1080, height: 1920, fps: 24, name: 'reel' },
      ctx({ emitProgress: (line) => progress.push(line) }),
    );
    expect(res.isError, res.content[0].text).toBeUndefined();

    const [entry] = seen.entries;
    expect(entry.paths).toEqual([path.join(root, 'flows', 'x', 'staging.mp4'), path.join(root, 'flows', 'x', 'glide.mp4')]);
    expect(entry.port).toBe(4123);
    expect(entry.plan).toMatchObject({ width: 1080, height: 1920, fps: 24, durationInFrames: 386 });
    expect(entry.plan.clips.map((c) => [c.from, c.durationInFrames, c.fadeOutFrames])).toEqual([[0, 241, 6], [241, 145, 0]]);

    const [render] = seen.renders;
    expect(render).toMatchObject({
      entryPath: path.join(root, 'entry.tsx'),
      skipWrapper: true,
      compositionId: 'join-clips',
      outputPath: path.join(root, 'flows', 'x', 'reel.mp4'),
      width: 1080,
      height: 1920,
      fps: 24,
      durationInFrames: 386,
    });
    expect(seen.cleaned).toBe(1);
    expect(progress).toContain('2 clips, 16.1 s, 1080x1920 at 24 fps');
    expect(progress).toContain('Rendering… 50%');

    expect(res.artifact).toEqual({
      kind: 'video',
      title: 'Joined (2 clips)',
      payload: { relPath: 'flows/x/reel.mp4', durationSeconds: 386 / 24, width: 1080, height: 1920, hasAudio: false },
    });
    expect(upserts[0]).toEqual({ relPath: 'flows/x/reel.mp4', description: 'Joined: Staging + Glide' });
  });

  it('keeps edge order, takes the first clip\'s size and rate by default, and a cut has no ramps', async () => {
    const seen = fakeDeps();
    const res = await joinClipsTool.handler({ videos: ['video-2', 'video-1'], transition: 'cut' }, ctx());
    expect(res.isError).toBeUndefined();
    expect(seen.entries[0].paths.map((p) => path.basename(p))).toEqual(['glide.mp4', 'staging.mp4']);
    expect(seen.entries[0].plan.clips.every((c) => c.fadeInFrames === 0 && c.fadeOutFrames === 0)).toBe(true);
    expect(seen.renders[0]).toMatchObject({ width: 1080, height: 1920, fps: 24, durationInFrames: 386 });
    expect(seen.renders[0].outputPath).toBe(path.join(root, 'flows', 'x', 'joined.mp4'));
  });

  it('defaults to a 0.25 s / 0.3 s dip when the node leaves the transition unset', async () => {
    const seen = fakeDeps();
    await joinClipsTool.handler({ videos: ['video-1', 'video-2'] }, ctx());
    expect(seen.entries[0].plan.clips[0].fadeOutFrames).toBe(6);
    expect(seen.entries[0].plan.clips[1].fadeInFrames).toBeCloseTo(7.2, 10);
  });

  it('passes the run\'s signal to the render, so a cancelled run stops rendering', async () => {
    const seen = fakeDeps();
    const controller = new AbortController();
    await joinClipsTool.handler({ videos: ['video-1', 'video-2'] }, ctx({ signal: controller.signal }));
    expect(seen.renders[0].signal).toBe(controller.signal);
  });

  it('refuses a clip with no video stream before writing an entry', async () => {
    const seen = fakeDeps({ probe: async (p) => ({ ...PROBES[path.basename(p)], hasVideo: !p.endsWith('glide.mp4') }) });
    const res = await joinClipsTool.handler({ videos: ['video-1', 'video-2'] }, ctx());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Video 2 ("Glide") has no video stream');
    expect(seen.entries).toHaveLength(0);
    expect(seen.renders).toHaveLength(0);
  });

  it('reports a failed render and still removes the entry', async () => {
    const seen = fakeDeps({ render: async () => { throw new Error('Chromium crashed'); } });
    const res = await joinClipsTool.handler({ videos: ['video-1', 'video-2'] }, ctx());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Join failed: Chromium crashed');
    expect(seen.cleaned).toBe(1);
    expect(upserts).toHaveLength(0);
  });

  it('refuses an id that is not a video artifact', async () => {
    fakeDeps();
    const res = await joinClipsTool.handler({ videos: ['video-1', 'nope'] }, ctx());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Join failed');
  });

  it('is a free video node that collects many videos on one port', () => {
    expect(joinClipsTool.needs).toBeUndefined();
    expect(joinClipsTool.ports?.priced).toBeUndefined();
    expect(joinClipsTool.ports?.inputs).toEqual([{ id: 'videos', label: 'Videos', dataType: 'videos', required: true, argKey: 'videos' }]);
    expect(joinClipsTool.ports?.label).not.toBe('Join Videos'); // concat_videos' label
  });
});
