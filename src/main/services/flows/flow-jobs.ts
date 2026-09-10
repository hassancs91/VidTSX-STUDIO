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
// Render jobs settle in main too (W8 Stage 3, `flow-render.ts`): the queue's
// rows live in the renderer, so a flow renders through the same main services
// the queue's handler calls and files the MP4 through the agents' reconciler.

import type { AgentArtifact, AgentJobRequest } from '../../../shared/types/agents';
import { videoEngine } from '../../../video-engine';
import type { AgentArtifactStore } from '../agents/artifact-store';
import { reconcileVideoJob, type VideoJobDeps } from '../agents/video-jobs';
import { settleRenderJob } from './flow-render';

export interface SettleJobOptions {
  runId: string;
  store: AgentArtifactStore;
  signal: AbortSignal;
  libraryFolder?: string;
  /** The brand the filed output is tagged with — the node's, resolved (§0.1 item 9). */
  brandId?: string;
  /** Stage 3: what the tool asked for beside the job (the composition to render). */
  request?: Omit<AgentJobRequest, 'artifactId'>;
  /** Stage 3: the run's `files/` — where a composition's TSX lives. */
  workspaceDir?: string;
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

/** The real thing: video through the engine, render through main's Remotion path. */
export const settleJob: SettleJob = (job, opts) => {
  if (job.kind !== 'job') return Promise.resolve(job);
  if (job.payload.job === 'render') return settleRenderJob(job, opts);

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
