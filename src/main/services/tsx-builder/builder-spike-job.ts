// The dev entry's `build` mode through the job engine (P1 part 7): a run goes
// the way the app will run it, as a `build` job on tsxJobEngine, instead of
// calling generateTsx() directly. `followJob` starts the job, writes every job
// event (the whole snapshot) and every narration chunk through `write`, and
// settles when the job reaches a final status. It takes the engine as an
// interface, so it is tested with a fake. `keepJobResult` copies the saved
// project out of the profile's Creator library into the run's outDir.

import fs from 'fs/promises';
import path from 'path';
import type { BuildBudget, BuildFormat, BuildPack, TsxJobIpc, TsxJobStartRequest } from '@shared/ipc/types';

export interface BuildSpikeRequest {
  mode: 'build';
  intent: string;
  /** Required unless `editOf` is given. */
  format?: BuildFormat;
  outDir: string;
  budget: BuildBudget;
  packsDir?: string;
  packNames?: string[];
  /** A project folder in the profile's Creator library (a job saves there, as the app does). */
  editOf?: { folderPath: string; version?: number };
  name?: string;
  /** Absent = the engine's default (`claude-subscription` on the throwaway profile). */
  providerId?: string;
  model?: string;
  maxMinutes?: number;
  maxOutputTokens?: number;
  cancelAfterMs?: number;
  quit?: boolean;
}

/** What the spike drives: tsxJobEngine's public surface. */
export interface SpikeJobEngine {
  start(request: TsxJobStartRequest): { jobId?: string; error?: string };
  cancel(jobId: string): { success: boolean; error?: string };
  list(): TsxJobIpc[];
  onEvent(listener: (job: TsxJobIpc) => void): () => void;
  onStream(listener: (jobId: string, chunk: string) => void): () => void;
}

export interface FollowedJob {
  jobId?: string;
  /** start() refused the request. */
  startError?: string;
  /** The job's last snapshot: done, error or cancelled. */
  final?: TsxJobIpc;
  events: number;
  streamChunks: number;
  /** Jobs restored from the profile's last quit, cancelled so starting ours does not release them. */
  heldCancelled: string[];
  cancelSentAtMs?: number;
}

const FINAL = new Set(['done', 'error', 'cancelled']);

export function jobRequestFor(req: BuildSpikeRequest, packs: BuildPack[]): TsxJobStartRequest {
  return {
    kind: 'build',
    prompt: req.intent,
    ...(req.providerId ? { providerId: req.providerId } : {}),
    ...(req.model ? { options: { model: req.model } } : {}),
    build: {
      budget: req.budget,
      ...(req.format ? { format: req.format } : {}),
      ...(packs.length ? { packs } : {}),
      ...(req.editOf ? { editOf: req.editOf } : {}),
      ...(req.name ? { name: req.name } : {}),
      ...(req.maxMinutes ? { maxMinutes: req.maxMinutes } : {}),
      ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
    },
  };
}

export async function followJob(
  engine: SpikeJobEngine,
  request: TsxJobStartRequest,
  opts: { write: (entry: object) => void; cancelAfterMs?: number },
): Promise<FollowedJob> {
  const heldCancelled = engine.list().filter((j) => j.status === 'queued').map((j) => j.id);
  for (const id of heldCancelled) engine.cancel(id);

  let jobId: string | undefined;
  let events = 0;
  let streamChunks = 0;
  let settle: (job: TsxJobIpc) => void = () => {};
  const finished = new Promise<TsxJobIpc>((resolve) => {
    settle = resolve;
  });
  const record = (job: TsxJobIpc) => {
    events++;
    opts.write({ job });
    if (FINAL.has(job.status)) settle(job);
  };
  // start() emits (queued, generating, the first build status) before it returns the id.
  const early: TsxJobIpc[] = [];
  const offEvent = engine.onEvent((job) => {
    if (!jobId) early.push(job);
    else if (job.id === jobId) record(job);
  });
  const offStream = engine.onStream((id, chunk) => {
    if (!jobId || id !== jobId) return;
    streamChunks++;
    opts.write({ stream: chunk });
  });

  const started = Date.now();
  let cancelSentAtMs: number | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = engine.start(request);
    if (!result.jobId) return { startError: result.error ?? 'start refused', events, streamChunks, heldCancelled };
    const id = result.jobId;
    jobId = id;
    for (const job of early.splice(0)) if (job.id === id) record(job);
    if (opts.cancelAfterMs) {
      timer = setTimeout(() => {
        cancelSentAtMs = Date.now() - started;
        engine.cancel(id);
      }, opts.cancelAfterMs);
    }
    const final = await finished;
    return {
      jobId: id,
      final,
      events,
      streamChunks,
      heldCancelled,
      ...(cancelSentAtMs !== undefined ? { cancelSentAtMs } : {}),
    };
  } finally {
    if (timer) clearTimeout(timer);
    offEvent();
    offStream();
  }
}

/** The numbers the wall needs, from the final snapshot (+ the SDK's cost from the version's debug JSON). */
export async function keepJobResult(final: TsxJobIpc, outDir: string): Promise<Record<string, unknown>> {
  const build = final.build;
  const head = {
    status: final.status,
    ...(final.error ? { error: final.error } : {}),
    jobMs: final.startedAt && final.completedAt ? final.completedAt - final.startedAt : null,
    ...(build
      ? {
          builderMs: build.elapsedMs,
          rounds: build.round,
          roundsMax: build.roundsMax,
          checks: build.checks,
          turns: build.turns,
          tokens: build.tokens,
          stopReason: build.stopReason,
          finished: build.finished,
          seamOk: build.seamOk,
          pureOk: build.pureOk,
          notice: build.notice,
        }
      : {}),
    versionPath: final.versionPath ?? null,
  };
  if (!final.folderPath || !final.versionPath) return head;
  const debugPath = final.versionPath.replace(/\.tsx$/, '.debug.json');
  const debug = JSON.parse(await fs.readFile(debugPath, 'utf-8').catch(() => '{}')) as {
    model?: string;
    usage?: { costUsd?: number };
  };
  const copiedTo = path.join(outDir, 'projects', path.basename(final.folderPath));
  await fs.rm(copiedTo, { recursive: true, force: true });
  await fs.cp(final.folderPath, copiedTo, { recursive: true });
  return { ...head, model: debug.model ?? null, costUsd: debug.usage?.costUsd ?? null, copiedTo };
}
