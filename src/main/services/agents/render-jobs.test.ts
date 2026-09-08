import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let libraryRoot = '';
let sessionDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => sessionDir,
    isPackaged: false,
    getAppPath: () => sessionDir,
    getVersion: () => '1.0.0',
  },
}));
// The library root is a temp folder per test; the index write is real, so the
// idempotency claim is tested against the actual store rather than a fake.
vi.mock('../library/library-paths', async () => {
  const actual = await vi.importActual<typeof import('../library/library-paths')>(
    '../library/library-paths',
  );
  return {
    ...actual,
    ensureLibraryRoot: async () => libraryRoot,
    resolveLibraryPath: (root: string, relPath: string) => path.join(root, relPath),
  };
});
// ffprobe is not available in a unit test, and its absence must not lose the
// artifact — the reconciler files with zero dimensions instead.
vi.mock('../frame-extractor', () => ({
  probeVideo: async () => {
    throw new Error('no ffprobe here');
  },
}));

import type { AgentArtifact, AgentRunEvent } from '../../../shared/types/agents';
import { AgentArtifactStore } from './artifact-store';
import type { AgentSessionContext } from './session-context';
import {
  applyRenderJobUpdate,
  reconcileSessionRenderJobs,
  buildQueueRequest,
  type RenderJobDeps,
} from './render-jobs';

const OUT_REL = 'agents/motion-post/session/render.mp4';

let store: AgentArtifactStore;
let events: AgentRunEvent[];
let notes: string[];
let deps: RenderJobDeps;

async function seedJob(outputRelPath?: string): Promise<AgentArtifact> {
  const job = await store.add(
    { kind: 'job', title: 'Render — Teaser', payload: { jobId: 'job-1', job: 'render', status: 'pending' } },
    { tool: 'render_composition', callId: 'call-1' },
  );
  if (outputRelPath) await store.patchPayload(job.id, { outputRelPath });
  return job;
}

async function writeOutput(): Promise<void> {
  const abs = path.join(libraryRoot, OUT_REL);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, 'not really an mp4', 'utf-8');
}

beforeEach(async () => {
  libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-render-lib-'));
  sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-render-session-'));
  store = await AgentArtifactStore.open(sessionDir);
  events = [];
  notes = [];
  deps = {
    sessionId: 's-1',
    store,
    filing: {},
    emit: (event) => events.push(event),
    onSettled: (note) => notes.push(note),
  };
});

afterEach(async () => {
  await fs.rm(libraryRoot, { recursive: true, force: true });
  await fs.rm(sessionDir, { recursive: true, force: true });
});

describe('applyRenderJobUpdate', () => {
  it('records progress without filing anything', async () => {
    const job = await seedJob(OUT_REL);
    await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'running', progress: 40 });

    const updated = store.get(job.id);
    expect(updated?.kind === 'job' && updated.payload.status).toBe('running');
    expect(updated?.kind === 'job' && updated.payload.progress).toBe(40);
    expect(store.list().filter((a) => a.kind === 'video')).toHaveLength(0);
  });

  it('files the output and links it back into the job', async () => {
    const job = await seedJob(OUT_REL);
    await writeOutput();
    await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'completed' });

    const video = store.list().find((a) => a.kind === 'video');
    expect(video?.kind === 'video' && video.payload.relPath).toBe(OUT_REL);
    const updated = store.get(job.id);
    expect(updated?.kind === 'job' && updated.payload.resultArtifactId).toBe(video?.id);
    expect(notes[0]).toContain(`finished: video artifact ${video?.id}`);
  });

  it('is idempotent — a second completion adds no second video', async () => {
    const job = await seedJob(OUT_REL);
    await writeOutput();
    await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'completed' });
    await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'completed' });

    expect(store.list().filter((a) => a.kind === 'video')).toHaveLength(1);
  });

  it('fails a job whose queue said "done" with no file behind it', async () => {
    const job = await seedJob(OUT_REL);
    await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'completed' });

    const updated = store.get(job.id);
    expect(updated?.kind === 'job' && updated.payload.status).toBe('failed');
    expect(store.list().filter((a) => a.kind === 'video')).toHaveLength(0);
  });

  it('reports a failure with its reason', async () => {
    const job = await seedJob(OUT_REL);
    await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'failed', error: 'out of memory' });

    expect(notes[0]).toContain('out of memory');
    expect(events.some((e) => e.kind === 'artifact-updated')).toBe(true);
  });
});

describe('reconcileSessionRenderJobs', () => {
  it('files a render that finished while the session was closed', async () => {
    const job = await seedJob(OUT_REL);
    await writeOutput();
    await reconcileSessionRenderJobs(deps);

    const updated = store.get(job.id);
    expect(updated?.kind === 'job' && updated.payload.status).toBe('completed');
  });

  it('leaves a job alone when its file is not there yet', async () => {
    // The queue persists across restarts, so "no file" means "still queued" —
    // only the renderer can tell that from "gone", and it reports that itself.
    const job = await seedJob(OUT_REL);
    await reconcileSessionRenderJobs(deps);

    const updated = store.get(job.id);
    expect(updated?.kind === 'job' && updated.payload.status).toBe('pending');
  });
});

describe('buildQueueRequest', () => {
  it('completes the tool half-request with both paths and stamps the artifact', async () => {
    const composition = await store.add(
      {
        kind: 'composition',
        title: 'Teaser',
        payload: {
          relPath: 'compositions/teaser.tsx',
          config: { id: 'Teaser', durationInFrames: 90, fps: 30, width: 1080, height: 1920 },
        },
      },
      { tool: 'generate_composition', callId: 'call-0' },
    );
    const job = await seedJob();
    const ctx = {
      session: { id: 's-1', libraryFolder: 'agents/motion-post/session' },
      store,
      workspaceDir: path.join(sessionDir, 'work'),
    } as unknown as AgentSessionContext;

    const request = await buildQueueRequest(ctx, {
      artifactId: job.id,
      jobId: 'job-1',
      job: 'render',
      compositionArtifactId: composition.id,
      config: composition.kind === 'composition' ? composition.payload.config : undefined,
      outputName: 'render',
    });

    expect(request?.tsxPath).toBe(path.join(sessionDir, 'work', 'compositions/teaser.tsx'));
    expect(request?.outputPath).toBe(path.join(libraryRoot, OUT_REL));
    // Stamped so a restart can reconcile without asking the renderer.
    const updated = store.get(job.id);
    expect(updated?.kind === 'job' && updated.payload.outputRelPath).toBe(OUT_REL);
  });

  it('refuses a request that does not name a composition', async () => {
    const job = await seedJob();
    const ctx = {
      session: { id: 's-1' },
      store,
      workspaceDir: sessionDir,
    } as unknown as AgentSessionContext;

    await expect(
      buildQueueRequest(ctx, { artifactId: job.id, jobId: 'job-1', job: 'render' }),
    ).resolves.toBeNull();
  });
});
