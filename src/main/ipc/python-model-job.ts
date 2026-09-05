/**
 * Shared skeleton for IPC handlers that run a catalogue model for a screen (rembg for
 * Image Studio, TripoSR for 3D Studio): one job id valid from the first reply,
 * optional install step (runtime + model, with progress mapped from the install
 * service and the download engine), the run itself through `startPythonModel`, and a
 * cancel that stops whichever step is active — including a runtime download the job
 * started. Screens differ only in stage names and the complete payload.
 */
import { randomUUID } from 'crypto';
import type { WebContents } from 'electron';
import type { AiRuntimeVariant, PythonModelPreflightIpc } from '@shared/ipc/types';
import { PythonRunError } from '../../local-python-engine';
import { logEngine } from '../../logging/log-engine';
import { aiRuntimeDownloadId } from '../services/ai-runtime/catalogue';
import { getAiRuntimeInstallProgress, onAiRuntimeStatusChanged } from '../services/ai-runtime/install';
import { cancelDownload, onDownloadProgress } from '../services/download-manager';
import {
  cancelPythonModelDownload,
  cancelPythonModelRun,
  ensurePythonModelReady,
  preflightPythonModel,
  PythonModelNotReadyError,
  type PythonModelProgress,
  type StartedPythonModel,
} from '../services/python-models';

const log = logEngine.createLogger('PythonModelJob');

export interface ModelJobProgress<TStage extends string> {
  requestId: string;
  stage: TStage;
  pct?: number;
  message?: string;
}

export interface ModelJobError {
  requestId: string;
  error: string;
  code?: string;
  details?: string;
}

interface Job {
  modelId: string;
  abort: AbortController;
  runRequestId: string | null;
  runtimeVariant: AiRuntimeVariant | null;
  cancelled: boolean;
}

const jobs = new Map<string, Job>();

export interface StartModelJobOptions<TStage extends string, TComplete> {
  modelId: string;
  sender: WebContents;
  channels: { progress: string; complete: string; error: string };
  installIfMissing: boolean;
  runtimeVariant?: AiRuntimeVariant;
  /** Stage names for the two install phases and the worker's stages. */
  installStages: { runtime: TStage; model: TStage };
  mapWorkerStage: (workerStage: string) => { stage: TStage; message?: string };
  /** Runs after the install step; receives the job's signal and progress sinks. */
  run: (ctx: ModelJobContext<TStage>) => Promise<TComplete>;
}

export interface ModelJobContext<TStage extends string> {
  requestId: string;
  signal: AbortSignal;
  /** Worker progress from startPythonModel → mapped stage events. */
  onProgress: (p: PythonModelProgress) => void;
  /** Register the queued run so cancel can reach it. */
  setStarted: (s: StartedPythonModel) => void;
  /** Emit a screen-level stage (e.g. 'saving'). */
  stage: (stage: TStage, message?: string, pct?: number) => void;
}

export type StartModelJobResult =
  | { success: true; requestId: string }
  | { success: false; notReady: PythonModelPreflightIpc; error: string }
  | { success: false; error: string };

/** Install-phase progress: runtime phases from the install service, bytes from the download engine. */
function watchInstall<TStage extends string>(
  modelId: string,
  stages: { runtime: TStage; model: TStage },
  send: (e: ModelJobProgress<TStage>) => void,
  requestId: string,
): () => void {
  const unsubRuntime = onAiRuntimeStatusChanged(() => {
    const p = getAiRuntimeInstallProgress();
    if (!p) return;
    const message =
      p.phase === 'downloading' ? 'Downloading the AI runtime'
        : p.phase === 'verifying' ? 'Verifying the AI runtime'
          : p.phase === 'warming-up' ? 'Warming up the AI runtime (first launch)'
            : p.phase === 'finalizing' ? 'Finishing the runtime install' : 'Checking this PC';
    send({ requestId, stage: stages.runtime, message: p.message ? `${message} — ${p.message}` : message });
  });
  const unsubDownload = onDownloadProgress((d) => {
    if (d.metadata?.type === 'ai-runtime') {
      if (d.status === 'downloading') send({ requestId, stage: stages.runtime, pct: d.percent >= 0 ? d.percent : undefined, message: 'Downloading the AI runtime' });
      else if (d.status === 'extracting') send({ requestId, stage: stages.runtime, message: 'Extracting the AI runtime' });
    } else if (d.metadata?.type === 'python-model' && d.metadata.modelId === modelId) {
      if (d.status === 'downloading') send({ requestId, stage: stages.model, pct: d.percent >= 0 ? d.percent : undefined, message: `Downloading ${d.metadata.fileLabel ?? 'the model'}` });
    }
  });
  return () => {
    unsubRuntime();
    unsubDownload();
  };
}

export async function startModelJob<TStage extends string, TComplete>(opts: StartModelJobOptions<TStage, TComplete>): Promise<StartModelJobResult> {
  const pre = await preflightPythonModel(opts.modelId);
  if (!pre.ready && !opts.installIfMissing) {
    return { success: false, notReady: pre, error: pre.message };
  }
  const requestId = randomUUID();
  const runtimeNeeded = !pre.ready && pre.action !== undefined && pre.action.kind !== 'download-model';
  const job: Job = {
    modelId: opts.modelId,
    abort: new AbortController(),
    runRequestId: null,
    runtimeVariant: runtimeNeeded ? (opts.runtimeVariant ?? (!pre.ready ? pre.action?.variant : undefined) ?? null) : null,
    cancelled: false,
  };
  jobs.set(requestId, job);
  const { sender } = opts;
  const send = <T>(channel: string, payload: T) => {
    if (!sender.isDestroyed()) sender.send(channel, payload);
  };
  const progress = (e: ModelJobProgress<TStage>) => send(opts.channels.progress, e);

  void (async () => {
    try {
      if (!pre.ready) {
        const stop = watchInstall(opts.modelId, opts.installStages, progress, requestId);
        try {
          progress({ requestId, stage: runtimeNeeded ? opts.installStages.runtime : opts.installStages.model, message: 'Preparing the download' });
          await ensurePythonModelReady(opts.modelId, { variant: opts.runtimeVariant });
        } finally {
          stop();
        }
        if (job.cancelled) throw new PythonRunError({ code: 'cancelled', message: 'Cancelled.' }, '');
      }
      const result = await opts.run({
        requestId,
        signal: job.abort.signal,
        stage: (stage, message, pct) => progress({ requestId, stage, message, pct }),
        onProgress: (p) => {
          const mapped = opts.mapWorkerStage(p.stage);
          progress({ requestId, stage: mapped.stage, pct: p.pct, message: mapped.message });
        },
        setStarted: (s) => {
          job.runRequestId = s.requestId;
          if (job.cancelled) cancelPythonModelRun(s.requestId);
        },
      });
      send(opts.channels.complete, { requestId, ...result });
    } catch (err) {
      const payload: ModelJobError =
        err instanceof PythonRunError
          ? { requestId, error: err.message, code: err.code, details: err.details }
          : err instanceof PythonModelNotReadyError
            ? { requestId, error: err.message, code: `not-ready:${err.preflight.reason}` }
            : { requestId, error: err instanceof Error ? err.message : 'Generation failed', code: job.cancelled ? 'cancelled' : undefined };
      if (payload.code !== 'cancelled') log.warn('model job failed', { modelId: opts.modelId, requestId, code: payload.code, error: payload.error });
      send(opts.channels.error, payload);
    } finally {
      jobs.delete(requestId);
    }
  })();

  return { success: true, requestId };
}

/** Stop whatever the job is doing: the worker, the model download, and a runtime download it started. */
export function cancelModelJob(requestId: string): boolean {
  const job = jobs.get(requestId);
  if (!job) return false;
  job.cancelled = true;
  job.abort.abort();
  if (job.runRequestId) cancelPythonModelRun(job.runRequestId);
  cancelPythonModelDownload(job.modelId);
  if (job.runtimeVariant) cancelDownload(aiRuntimeDownloadId(job.runtimeVariant));
  return true;
}
