import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentRunEvent } from '../../../shared/types/agents';
import type { AgentArtifactStore as ArtifactStore } from './artifact-store';

const getJob = vi.fn();
const subscribe = vi.fn();
const fileVideoAsset = vi.fn();

vi.mock('../../../video-engine', () => ({
  videoEngine: {
    getJob: (id: string) => getJob(id),
    subscribe: (listener: unknown) => subscribe(listener),
  },
}));
vi.mock('../library/generate-video-asset', () => ({
  fileVideoAsset: (record: unknown, options: unknown) => fileVideoAsset(record, options),
}));

const { AgentArtifactStore } = await import('./artifact-store');
const { reconcileSessionVideoJobs, reconcileVideoJob } = await import('./video-jobs');

const ASSET = {
  relPath: 'agents/test/session/a-calm-lake-7f3a2b1c9d0e.mp4',
  entryId: 'vid-1',
  durationSeconds: 4,
  aspectRatio: '16:9',
  hasAudio: false,
  description: 'a calm lake at dawn',
  filed: true,
};

function completed(jobId = 'job-77') {
  return {
    jobId,
    providerId: 'fal',
    status: 'completed',
    request: { prompt: 'a calm lake at dawn', durationSeconds: 4, aspectRatio: '16:9' },
    result: { entry: { id: 'vid-1', fileName: 'clip.mp4' }, filePath: '/tmp/clip.mp4' },
  };
}

let dir: string;
let store: ArtifactStore;
let events: AgentRunEvent[];
let notes: string[];

async function seedJob(jobId = 'job-77'): Promise<string> {
  const artifact = await store.add(
    { kind: 'job', title: 'a calm lake', payload: { jobId, job: 'video', status: 'pending' } },
    { tool: 'generate_video', callId: 'call-1' },
  );
  return artifact.id;
}

function deps() {
  return {
    sessionId: 'session-1',
    store,
    filing: { folder: 'agents/test/session', brandId: 'brand-1' },
    emit: (e: AgentRunEvent) => events.push(e),
    onSettled: (note: string) => notes.push(note),
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-videojobs-'));
  store = await AgentArtifactStore.open(dir);
  events = [];
  notes = [];
  getJob.mockReset();
  subscribe.mockReset();
  fileVideoAsset.mockReset();
  fileVideoAsset.mockResolvedValue(ASSET);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('video job reconciler', () => {
  it('files a completed job, appends the video artifact and links it back', async () => {
    const jobArtifactId = await seedJob();
    getJob.mockReturnValue(completed());

    await reconcileVideoJob(deps(), jobArtifactId);

    expect(fileVideoAsset).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-77' }),
      { folder: 'agents/test/session', brandId: 'brand-1' },
    );
    const video = store.list().find((a) => a.kind === 'video');
    expect(video?.payload).toMatchObject({ relPath: ASSET.relPath, entryId: 'vid-1' });
    const job = store.get(jobArtifactId);
    expect(job?.payload).toMatchObject({ status: 'completed', resultArtifactId: video?.id });
    expect(notes[0]).toContain(`video artifact ${video?.id}`);
  });

  it('is idempotent — a second reconcile of the same job files nothing new', async () => {
    const jobArtifactId = await seedJob();
    getJob.mockReturnValue(completed());
    await reconcileVideoJob(deps(), jobArtifactId);
    await reconcileVideoJob(deps(), jobArtifactId);
    expect(fileVideoAsset).toHaveBeenCalledTimes(1);
    expect(store.list().filter((a) => a.kind === 'video')).toHaveLength(1);
  });

  it('re-drives on session open for a terminal job with no resultArtifactId', async () => {
    const jobArtifactId = await seedJob();
    // Nobody was subscribed when it finished — the clip is gated and on disk,
    // but it never reached the library. Opening the session must fix that.
    getJob.mockReturnValue(completed());
    await reconcileSessionVideoJobs(deps());
    expect(fileVideoAsset).toHaveBeenCalledTimes(1);
    expect(store.get(jobArtifactId)?.payload).toMatchObject({ status: 'completed' });
  });

  it('does not mark the job failed when filing throws — the next open retries', async () => {
    const jobArtifactId = await seedJob();
    getJob.mockReturnValue(completed());
    fileVideoAsset.mockRejectedValueOnce(new Error('library is offline'));

    await reconcileVideoJob(deps(), jobArtifactId);
    expect(store.get(jobArtifactId)?.payload).toMatchObject({ status: 'pending' });
    expect(store.list().some((a) => a.kind === 'video')).toBe(false);

    fileVideoAsset.mockResolvedValue(ASSET);
    await reconcileVideoJob(deps(), jobArtifactId);
    expect(store.get(jobArtifactId)?.payload).toMatchObject({ status: 'completed' });
  });

  it('records a provider failure without inventing a video artifact', async () => {
    const jobArtifactId = await seedJob();
    getJob.mockReturnValue({ ...completed(), status: 'failed', error: 'provider rejected it' });
    await reconcileVideoJob(deps(), jobArtifactId);
    expect(store.get(jobArtifactId)?.payload).toMatchObject({
      status: 'failed',
      error: 'provider rejected it',
    });
    expect(fileVideoAsset).not.toHaveBeenCalled();
    expect(notes[0]).toContain('failed');
  });

  it('reports a job the in-memory tracker no longer has, rather than waiting forever', async () => {
    const jobArtifactId = await seedJob();
    getJob.mockReturnValue(undefined);
    await reconcileVideoJob(deps(), jobArtifactId);
    expect(store.get(jobArtifactId)?.payload).toMatchObject({ status: 'failed' });
    expect(notes[0]).toContain('lost when the app restarted');
  });

  it('only carries the status forward while a job is still running', async () => {
    const jobArtifactId = await seedJob();
    getJob.mockReturnValue({ ...completed(), status: 'running', result: undefined });
    await reconcileVideoJob(deps(), jobArtifactId);
    expect(store.get(jobArtifactId)?.payload).toMatchObject({ status: 'running' });
    expect(fileVideoAsset).not.toHaveBeenCalled();
    expect(events.some((e) => e.kind === 'artifact-updated')).toBe(true);
  });

  it('leaves alone jobs that are not video jobs', async () => {
    const render = await store.add(
      { kind: 'job', title: 'Render', payload: { jobId: 'r1', job: 'render', status: 'pending' } },
      { tool: 'render_composition', callId: 'call-2' },
    );
    await reconcileSessionVideoJobs(deps());
    expect(getJob).not.toHaveBeenCalled();
    expect(store.get(render.id)?.payload).toMatchObject({ status: 'pending' });
  });
});
