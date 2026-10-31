import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));

const jobs = new Map<string, 'running' | 'queued' | 'none'>();
const restart = vi.fn(async () => {});
vi.mock('./media-jobs', () => ({
  studioMediaJobs: {
    jobState: (projectId: string, assetId: string) => jobs.get(`${projectId}:${assetId}`) ?? 'none',
    restart: (...args: unknown[]) => restart(...(args as [])),
  },
}));

let gpu: { ffmpeg: string; encoder: 'nvenc' } | null = null;
vi.mock('./ffmpeg-full', () => ({ resolveProxyGpuEncoder: async () => gpu }));

const { getProxyBuildEncoder, recordProxyBuildEncoder } = await import('./proxy-build-encoders');
const { planProxyGpuRebuild, rebuildProxiesOnGpu } = await import('./proxy-gpu-rebuild');

describe('planProxyGpuRebuild', () => {
  it('restarts a running x264 build and rebuilds a finished one', () => {
    expect(planProxyGpuRebuild('running', 'x264')).toBe('restart');
    expect(planProxyGpuRebuild('none', 'x264')).toBe('rebuild');
  });

  it('leaves GPU builds, queued jobs and proxies from earlier sessions alone', () => {
    expect(planProxyGpuRebuild('running', 'nvenc')).toBe('skip');
    expect(planProxyGpuRebuild('none', 'nvenc')).toBe('skip');
    // A queued job resolves its encoder when it starts: it picks the GPU itself.
    expect(planProxyGpuRebuild('queued', 'x264')).toBe('skip');
    // Running but not yet resolved, or never built this session.
    expect(planProxyGpuRebuild('running', undefined)).toBe('skip');
    expect(planProxyGpuRebuild('none', undefined)).toBe('skip');
  });
});

describe('proxy build encoders (session record)', () => {
  it('keeps the latest encoder per project + asset', () => {
    expect(getProxyBuildEncoder('p', 'a')).toBeUndefined();
    recordProxyBuildEncoder('p', 'a', 'x264');
    recordProxyBuildEncoder('p', 'a', 'nvenc');
    recordProxyBuildEncoder('q', 'a', 'x264');
    expect(getProxyBuildEncoder('p', 'a')).toBe('nvenc');
    expect(getProxyBuildEncoder('q', 'a')).toBe('x264');
  });
});

describe('rebuildProxiesOnGpu', () => {
  beforeEach(() => {
    jobs.clear();
    restart.mockClear();
  });

  it('does nothing while the GPU encoder does not resolve', async () => {
    gpu = null;
    recordProxyBuildEncoder('p1', 'running', 'x264');
    jobs.set('p1:running', 'running');
    expect(await rebuildProxiesOnGpu('p1', [{ assetId: 'running', path: 'D:/raw/r.mp4' }])).toEqual({
      restarted: [],
      rebuilt: [],
    });
    expect(restart).not.toHaveBeenCalled();
  });

  it('restarts the in-flight x264 proxy and rebuilds the finished one, nothing else', async () => {
    gpu = { ffmpeg: 'C:/ffmpeg-full/bin/ffmpeg.exe', encoder: 'nvenc' };
    recordProxyBuildEncoder('p2', 'inflight', 'x264');
    jobs.set('p2:inflight', 'running');
    recordProxyBuildEncoder('p2', 'finished', 'x264');
    recordProxyBuildEncoder('p2', 'gpu', 'nvenc');
    recordProxyBuildEncoder('p2', 'waiting', 'x264');
    jobs.set('p2:waiting', 'queued');

    const result = await rebuildProxiesOnGpu('p2', [
      { assetId: 'inflight', path: 'D:/raw/in.mp4' },
      { assetId: 'finished', path: 'D:/raw/fin.mp4' },
      { assetId: 'gpu', path: 'D:/raw/gpu.mp4' },
      { assetId: 'waiting', path: 'D:/raw/wait.mp4' },
      { assetId: 'older', path: 'D:/raw/older.mp4' },
    ]);
    expect(result).toEqual({ restarted: ['inflight'], rebuilt: ['finished'] });
    expect(restart.mock.calls).toEqual([
      ['p2', 'inflight', 'proxy', 'D:/raw/in.mp4'],
      ['p2', 'finished', 'proxy', 'D:/raw/fin.mp4'],
    ]);
  });
});
