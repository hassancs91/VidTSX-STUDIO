import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StudioMediaJobEvent } from '../../../shared/ipc/types/studio';

let cacheDir = '';

vi.mock('../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));
vi.mock('./studio-paths', () => ({ getProjectCacheDir: async () => cacheDir }));

interface FakeBuild {
  projectId: string;
  assetId: string;
  signal?: AbortSignal;
  finish: () => void;
}
const builds: FakeBuild[] = [];

vi.mock('./proxy-generator', () => ({
  proxyRelPath: (assetId: string) => `proxies/${assetId}.mp4`,
  generateProxy: (projectId: string, assetId: string, _src: string, signal?: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      builds.push({ projectId, assetId, signal, finish: () => resolve(`proxies/${assetId}.mp4`) });
      // Like ffmpeg-bin's runFfmpeg: the rejection comes when the killed process has exited.
      signal?.addEventListener('abort', () => setTimeout(() => reject(new Error('Cancelled')), 5), { once: true });
    }),
}));
vi.mock('./waveform-generator', () => ({
  waveformRelPath: (assetId: string) => `waveforms/${assetId}.json`,
  generateWaveform: async () => 'waveforms/x.json',
  isWaveformStale: async () => false,
}));
vi.mock('./asset-transcriber', () => ({
  readTranscriptMeta: async () => null,
  transcribeAsset: async () => ({ relPath: 't.json', meta: null }),
  transcriptRelPath: (assetId: string) => `transcripts/${assetId}.json`,
}));
vi.mock('./analysis-jobs', () => ({
  analysisRelPath: (kind: string, assetId: string) => `analysis/${kind}-${assetId}.json`,
  analysisSatisfying: async () => null,
  isAnalysisKind: (kind: string) => kind === 'faceTrack' || kind === 'subjectMask',
  runAnalysisJob: async () => ({ relPath: 'a.json', analysis: undefined }),
}));
vi.mock('../../../analysis-engine/analysis-engine', () => ({ analysisEngine: { scheduleRelease: vi.fn() } }));

const { studioMediaJobs } = await import('./media-jobs');

function record(projectId: string): StudioMediaJobEvent[] {
  const events: StudioMediaJobEvent[] = [];
  studioMediaJobs.onEvent((event) => {
    if (event.projectId === projectId) events.push(event);
  });
  return events;
}

const buildsOf = (projectId: string) => builds.filter((b) => b.projectId === projectId);

beforeAll(async () => {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-media-jobs-'));
  await fs.mkdir(path.join(cacheDir, 'proxies'), { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'proxies', 'done.mp4'), 'x264 proxy');
});

afterAll(async () => {
  await fs.rm(cacheDir, { recursive: true, force: true });
});

describe('studioMediaJobs.restart (A4: re-queue a proxy on the GPU encoder)', () => {
  it('aborts a running proxy and queues a fresh build once the old process has exited, with no "canceled" event', async () => {
    const events = record('p-run');
    await studioMediaJobs.request('p-run', 'a1', 'proxy', 'D:/raw/a1.mp4');
    await vi.waitFor(() => expect(buildsOf('p-run')).toHaveLength(1));
    expect(studioMediaJobs.jobState('p-run', 'a1', 'proxy')).toBe('running');

    await studioMediaJobs.restart('p-run', 'a1', 'proxy', 'D:/raw/a1.mp4');
    expect(buildsOf('p-run')[0].signal?.aborted).toBe(true);

    await vi.waitFor(() => expect(buildsOf('p-run')).toHaveLength(2));
    expect(buildsOf('p-run')[1].signal?.aborted).toBe(false);
    expect(events.some((e) => e.status === 'canceled')).toBe(false);
    expect(events.filter((e) => e.status === 'generating')).toHaveLength(2);

    buildsOf('p-run')[1].finish();
    await vi.waitFor(() => expect(events.at(-1)?.status).toBe('ready'));
    expect(events.filter((e) => e.status === 'ready')).toHaveLength(1);
    expect(studioMediaJobs.jobState('p-run', 'a1', 'proxy')).toBe('none');
  });

  it('rebuilds a finished proxy even though its file is on disk (force)', async () => {
    const events = record('p-done');
    // A plain request just re-announces the file …
    await studioMediaJobs.request('p-done', 'done', 'proxy', 'D:/raw/done.mp4');
    expect(events.map((e) => e.status)).toEqual(['ready']);
    expect(buildsOf('p-done')).toHaveLength(0);

    // … restart builds it again.
    await studioMediaJobs.restart('p-done', 'done', 'proxy', 'D:/raw/done.mp4');
    await vi.waitFor(() => expect(buildsOf('p-done')).toHaveLength(1));
    buildsOf('p-done')[0].finish();
    await vi.waitFor(() => expect(events.at(-1)?.status).toBe('ready'));
    expect(studioMediaJobs.jobState('p-done', 'done', 'proxy')).toBe('none');
  });

  it('a cancel after the restart wins: nothing is queued again', async () => {
    const events = record('p-cancel');
    await studioMediaJobs.request('p-cancel', 'a1', 'proxy', 'D:/raw/a1.mp4');
    await vi.waitFor(() => expect(buildsOf('p-cancel')).toHaveLength(1));

    await studioMediaJobs.restart('p-cancel', 'a1', 'proxy', 'D:/raw/a1.mp4');
    expect(studioMediaJobs.cancel('p-cancel', 'a1', 'proxy')).toBe(true);

    await vi.waitFor(() => expect(studioMediaJobs.jobState('p-cancel', 'a1', 'proxy')).toBe('none'));
    await new Promise((r) => setTimeout(r, 30));
    expect(buildsOf('p-cancel')).toHaveLength(1);
    expect(events.at(-1)?.status).toBe('canceled');
  });

  it('jobState reports queued for a job waiting behind the concurrency limit', async () => {
    await studioMediaJobs.request('p-queue', 'q1', 'proxy', 'D:/raw/q1.mp4');
    await studioMediaJobs.request('p-queue', 'q2', 'proxy', 'D:/raw/q2.mp4');
    await studioMediaJobs.request('p-queue', 'q3', 'proxy', 'D:/raw/q3.mp4');
    await vi.waitFor(() => expect(buildsOf('p-queue')).toHaveLength(2));
    expect(studioMediaJobs.jobState('p-queue', 'q3', 'proxy')).toBe('queued');
    for (const b of buildsOf('p-queue')) b.finish();
    await vi.waitFor(() => expect(buildsOf('p-queue')).toHaveLength(3));
    buildsOf('p-queue')[2].finish();
    await vi.waitFor(() => expect(studioMediaJobs.jobState('p-queue', 'q3', 'proxy')).toBe('none'));
  });
});
