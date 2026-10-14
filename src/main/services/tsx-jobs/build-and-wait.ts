// Start a build job and wait for it (P3 part 1). Every caller in main that
// needs a piece built (agents' generate_composition, Studio shots, flows)
// goes through here instead of calling the builder directly, so every build
// in the app shares the job engine's queue (one build at a time), its cancel
// and its progress events. The caller's signal cancels the job, queued or
// running; `onJob` sees every snapshot, `onStream` the builder's narration.
// It takes the engine as an interface, so it is tested with a fake (and the
// dev entry's followJob runs on it too).

import type { TsxJobIpc, TsxJobStartRequest } from '@shared/ipc/types';
import type { TsxJobOwner } from './tsx-build-job';

/** What a waiting caller needs of tsxJobEngine. */
export interface BuildJobEngine {
  start(request: TsxJobStartRequest, owner?: TsxJobOwner): { jobId?: string; error?: string };
  cancel(jobId: string): { success: boolean; error?: string };
  onEvent(listener: (job: TsxJobIpc) => void): () => void;
  onStream(listener: (jobId: string, chunk: string) => void): () => void;
}

export interface BuildWaitOptions {
  owner?: TsxJobOwner;
  /** Cancels the job: a queued one at once, a running one through its run. */
  signal?: AbortSignal;
  /** Called once with the id, before any later snapshot. */
  onStarted?: (jobId: string) => void;
  onJob?: (job: TsxJobIpc) => void;
  onStream?: (chunk: string) => void;
}

export interface AwaitedBuild {
  jobId?: string;
  /** start() refused the request (or the signal had already fired). */
  startError?: string;
  /** The job's last snapshot: done, error or cancelled. */
  final?: TsxJobIpc;
}

const FINAL = new Set(['done', 'error', 'cancelled']);

export async function startBuildAndWait(
  engine: BuildJobEngine,
  request: TsxJobStartRequest,
  options: BuildWaitOptions = {},
): Promise<AwaitedBuild> {
  const { signal } = options;
  if (signal?.aborted) return { startError: 'Cancelled before it started' };

  let jobId: string | undefined;
  let settle: (job: TsxJobIpc) => void = () => {};
  const finished = new Promise<TsxJobIpc>((resolve) => {
    settle = resolve;
  });
  const seen = (job: TsxJobIpc) => {
    options.onJob?.(job);
    if (FINAL.has(job.status)) settle(job);
  };
  // start() emits (queued, maybe running) before it returns the id.
  const early: TsxJobIpc[] = [];
  const offEvent = engine.onEvent((job) => {
    if (!jobId) early.push(job);
    else if (job.id === jobId) seen(job);
  });
  const offStream = engine.onStream((id, chunk) => {
    if (jobId && id === jobId) options.onStream?.(chunk);
  });
  const cancel = () => {
    if (jobId) engine.cancel(jobId);
  };

  try {
    const result = options.owner ? engine.start(request, options.owner) : engine.start(request);
    if (!result.jobId) return { startError: result.error ?? 'start refused' };
    const id = result.jobId;
    jobId = id;
    options.onStarted?.(id);
    for (const job of early.splice(0)) if (job.id === id) seen(job);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    return { jobId: id, final: await finished };
  } finally {
    signal?.removeEventListener('abort', cancel);
    offEvent();
    offStream();
  }
}
