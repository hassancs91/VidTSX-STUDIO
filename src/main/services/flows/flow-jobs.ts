// Settling a `job` artifact inside a flow run (flows plan §1.3). A tool that
// SUBMITS work — `generate_video`, `render_composition` — returns a job; the
// node is not done until that job is terminal and its output is a filed
// artifact the next port can carry.
//
// Video jobs settle here: main subscribes to the video engine directly and
// re-drives the same idempotent reconciler the agents use, so the clip is
// gated, filed in the library and written back onto the job artifact by one
// piece of code. Cancel aborts the provider job through the run's signal.
//
// Render jobs cannot settle in main: the render queue lives in the renderer
// (agents plan §1.5). Stage 3 adds the bridge; until then a render node fails
// with a message that says so, never hangs.

import type { AgentArtifact } from '../../../shared/types/agents';
import { videoEngine } from '../../../video-engine';
import type { AgentArtifactStore } from '../agents/artifact-store';
import { reconcileVideoJob, type VideoJobDeps } from '../agents/video-jobs';

export interface SettleJobOptions {
  runId: string;
  store: AgentArtifactStore;
  signal: AbortSignal;
  libraryFolder?: string;
  brandId?: string;
  /** Progress lines for the node's run log. */
  note(detail: string): void;
}

export type SettleJob = (job: AgentArtifact, opts: SettleJobOptions) => Promise<AgentArtifact>;

function terminalResult(store: AgentArtifactStore, jobId: string): AgentArtifact | Error | null {
  const job = store.get(jobId);
  if (!job || job.kind !== 'job') return new Error('The job artifact disappeared from the run.');
  if (job.payload.resultArtifactId) {
    const result = store.get(job.payload.resultArtifactId);
    return result ?? new Error('The job finished but its result artifact is missing.');
  }
  if (job.payload.status === 'failed' || job.payload.status === 'cancelled') {
    return new Error(job.payload.error ?? `The job ${job.payload.status}.`);
  }
  return null;
}

/** The real thing: video through the engine, render refused until Stage 3. */
export const settleJob: SettleJob = (job, opts) => {
  if (job.kind !== 'job') return Promise.resolve(job);
  if (job.payload.job === 'render') {
    return Promise.reject(
      new Error(
        'Rendering inside a flow arrives in Stage 3 (the render queue bridge). Render the composition from the Agents stage or the Creator for now.',
      ),
    );
  }

  const jobId = job.payload.jobId;
  const deps: VideoJobDeps = {
    sessionId: opts.runId,
    store: opts.store,
    filing: {
      ...(opts.libraryFolder ? { folder: opts.libraryFolder } : {}),
      ...(opts.brandId ? { brandId: opts.brandId } : {}),
    },
    emit: (event) => {
      if (event.kind === 'progress') opts.note(event.detail);
    },
  };

  return new Promise<AgentArtifact>((resolve, reject) => {
    let settled = false;
    const finish = (outcome: AgentArtifact | Error) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      opts.signal.removeEventListener('abort', onAbort);
      if (outcome instanceof Error) reject(outcome);
      else resolve(outcome);
    };
    const check = async () => {
      try {
        await reconcileVideoJob(deps, job.id);
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const outcome = terminalResult(opts.store, job.id);
      if (outcome) finish(outcome);
    };
    const unsubscribe = videoEngine.subscribe((record) => {
      if (record.jobId === jobId) void check();
    });
    const onAbort = () => {
      void videoEngine.cancel(jobId).catch(() => {});
      finish(new Error('Cancelled.'));
    };
    if (opts.signal.aborted) {
      onAbort();
      return;
    }
    opts.signal.addEventListener('abort', onAbort, { once: true });
    void check();
  });
};
