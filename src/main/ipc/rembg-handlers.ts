/**
 * "Remove background" for Image Studio (plan §4 step 5): the first caller of the shared
 * `runPythonModel` service. Resolves the source (gallery image or a dropped file), runs
 * `rembg-u2net`, stores `<name>-nobg.png` in the images folder as a gallery entry with
 * `derivedFrom`, and pushes progress / complete / error events keyed by a job id that
 * is valid from the first reply — including through the optional install step.
 */
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type {
  RembgCancelRequest,
  RembgCancelResponse,
  RembgCompleteEvent,
  RembgErrorEvent,
  RembgProgressEvent,
  RembgRunRequest,
  RembgRunResponse,
  RembgStage,
} from '@shared/ipc/types';
import { PythonRunError } from '../../local-python-engine';
import { logEngine } from '../../logging/log-engine';
import { getTempDir } from '../utils/paths';
import { getImageEntry, getImageFilePath, registerImageFile } from '../services/image-studio-db';
import { getImagesDir } from '../services/image-studio-files';
import { cancelPythonModelDownload, ensurePythonModelReady, preflightPythonModel, PythonModelNotReadyError, startPythonModel, cancelPythonModelRun } from '../services/python-models';
import { onAiRuntimeStatusChanged, getAiRuntimeInstallProgress } from '../services/ai-runtime/install';
import { onDownloadProgress } from '../services/download-manager';

const log = logEngine.createLogger('RembgIpc');
const MODEL_ID = 'rembg-u2net';

interface Job {
  abort: AbortController;
  runRequestId: string | null;
  cancelled: boolean;
}
const jobs = new Map<string, Job>();

function stageOf(workerStage: string): RembgStage {
  // The runner emits ready → load-model → process → export; everything before the
  // first model stage is the interpreter + imports ("Preparing runtime").
  return workerStage === 'load-model' || workerStage === 'process' || workerStage === 'export' ? 'removing-background' : 'preparing-runtime';
}

const STAGE_MESSAGE: Record<string, string> = {
  starting: 'Starting the AI runtime',
  ready: 'Loading image tools',
  import: 'Loading image tools',
  'load-model': 'Loading the model',
  process: 'Removing background',
  export: 'Saving',
};

function extFor(contentType: string | undefined, fileName: string | undefined): string {
  const fromName = fileName ? path.extname(fileName).toLowerCase() : '';
  if (fromName && /^\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(fromName)) return fromName;
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return '.jpg';
  if (contentType?.includes('webp')) return '.webp';
  return '.png';
}

/** Resolve the request's source into an absolute path + display facts; temp files are cleaned by the caller. */
async function resolveSource(req: RembgRunRequest): Promise<{ imagePath: string; temp: boolean; prompt: string; derivedFrom: string | null; stem: string }> {
  if (req.source.kind === 'image') {
    const entry = getImageEntry(req.source.id);
    const imagePath = getImageFilePath(req.source.id);
    if (!entry || !imagePath) throw new Error('Image not found');
    const stem = path.basename(entry.fileName, path.extname(entry.fileName));
    return { imagePath, temp: false, prompt: entry.prompt, derivedFrom: entry.id, stem };
  }
  const dir = path.join(getTempDir(), 'rembg-inputs');
  await fs.mkdir(dir, { recursive: true });
  const stem = (req.source.fileName ? path.basename(req.source.fileName, path.extname(req.source.fileName)) : 'image').replace(/[^\w.-]+/g, '_') || 'image';
  const imagePath = path.join(dir, `${stem}-${randomUUID().slice(0, 8)}${extFor(req.source.contentType, req.source.fileName)}`);
  await fs.writeFile(imagePath, Buffer.from(req.source.base64, 'base64'));
  return { imagePath, temp: true, prompt: req.source.fileName ?? 'Uploaded image', derivedFrom: null, stem };
}

/** Install-phase progress: runtime phases from the install service, bytes from the download engine. */
function watchInstall(send: (e: RembgProgressEvent) => void, requestId: string): () => void {
  const unsubRuntime = onAiRuntimeStatusChanged(() => {
    const p = getAiRuntimeInstallProgress();
    if (!p) return;
    const message =
      p.phase === 'downloading' ? 'Downloading the AI runtime'
        : p.phase === 'verifying' ? 'Verifying the AI runtime'
          : p.phase === 'warming-up' ? 'Warming up the AI runtime (first launch)'
            : p.phase === 'finalizing' ? 'Finishing the runtime install' : 'Checking this PC';
    send({ requestId, stage: 'installing-runtime', message: p.message ? `${message} — ${p.message}` : message });
  });
  const unsubDownload = onDownloadProgress((d) => {
    if (d.metadata?.type === 'ai-runtime') {
      if (d.status === 'downloading') send({ requestId, stage: 'installing-runtime', pct: d.percent >= 0 ? d.percent : undefined, message: 'Downloading the AI runtime' });
      else if (d.status === 'extracting') send({ requestId, stage: 'installing-runtime', message: 'Extracting the AI runtime' });
    } else if (d.metadata?.type === 'python-model' && d.metadata.modelId === MODEL_ID) {
      if (d.status === 'downloading') send({ requestId, stage: 'downloading-model', pct: d.percent >= 0 ? d.percent : undefined, message: `Downloading ${d.metadata.fileLabel ?? 'the model'}` });
    }
  });
  return () => {
    unsubRuntime();
    unsubDownload();
  };
}

export async function handleRembgRun(event: IpcMainInvokeEvent, req: RembgRunRequest): Promise<RembgRunResponse> {
  try {
    const pre = await preflightPythonModel(MODEL_ID);
    if (!pre.ready && !req.installIfMissing) {
      return { success: false, notReady: pre, error: pre.message };
    }
    const requestId = randomUUID();
    const job: Job = { abort: new AbortController(), runRequestId: null, cancelled: false };
    jobs.set(requestId, job);
    const sender = event.sender;
    const send = <T>(channel: string, payload: T) => {
      if (!sender.isDestroyed()) sender.send(channel, payload);
    };
    const progress = (e: RembgProgressEvent) => send(IPC.REMBG_PROGRESS, e);

    void (async () => {
      let source: Awaited<ReturnType<typeof resolveSource>> | null = null;
      try {
        if (!pre.ready) {
          const stop = watchInstall(progress, requestId);
          try {
            progress({ requestId, stage: 'installing-runtime', message: 'Preparing the download' });
            await ensurePythonModelReady(MODEL_ID, { variant: req.runtimeVariant });
          } finally {
            stop();
          }
          if (job.cancelled) throw new PythonRunError({ code: 'cancelled', message: 'Cancelled.' }, '');
        }
        source = await resolveSource(req);
        progress({ requestId, stage: 'preparing-runtime', message: STAGE_MESSAGE.starting });
        const started = await startPythonModel({
          modelId: MODEL_ID,
          input: { imagePath: source.imagePath },
          options: { alphaMatting: req.options?.alphaMatting === true, postProcessMask: req.options?.postProcessMask === true },
          outputDir: getImagesDir(),
          outputBaseName: `${source.stem}-nobg`,
          source: source.derivedFrom ? { imageStudioId: source.derivedFrom } : { uploaded: true },
          signal: job.abort.signal,
          onProgress: (p) => progress({ requestId, stage: stageOf(p.stage), pct: p.pct, message: STAGE_MESSAGE[p.stage] }),
        });
        job.runRequestId = started.requestId;
        if (job.cancelled) cancelPythonModelRun(started.requestId);
        const result = await started.promise;

        progress({ requestId, stage: 'saving', message: 'Adding to the gallery' });
        const width = typeof result.stats.width === 'number' ? result.stats.width : null;
        const height = typeof result.stats.height === 'number' ? result.stats.height : null;
        const entry = await registerImageFile(result.outputPath, {
          prompt: source.prompt,
          model: MODEL_ID,
          width,
          height,
          contentType: 'image/png',
          durationMs: Math.round(result.seconds * 1000),
          folderId: req.folderId ?? null,
          derivedFrom: source.derivedFrom,
        });
        const done: RembgCompleteEvent = { requestId, entry, seconds: result.seconds };
        send(IPC.REMBG_COMPLETE, done);
      } catch (err) {
        const payload: RembgErrorEvent =
          err instanceof PythonRunError
            ? { requestId, error: err.message, code: err.code, details: err.details }
            : err instanceof PythonModelNotReadyError
              ? { requestId, error: err.message, code: `not-ready:${err.preflight.reason}` }
              : { requestId, error: err instanceof Error ? err.message : 'Background removal failed', code: job.cancelled ? 'cancelled' : undefined };
        if (payload.code !== 'cancelled') log.warn('rembg failed', { requestId, code: payload.code, error: payload.error });
        send(IPC.REMBG_ERROR, payload);
      } finally {
        jobs.delete(requestId);
        if (source?.temp) await fs.unlink(source.imagePath).catch(() => {});
      }
    })();

    return { success: true, requestId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Background removal failed' };
  }
}

export async function handleRembgCancel(_event: IpcMainInvokeEvent, req: RembgCancelRequest): Promise<RembgCancelResponse> {
  const job = jobs.get(req.requestId);
  if (!job) return { success: false };
  job.cancelled = true;
  job.abort.abort();
  if (job.runRequestId) cancelPythonModelRun(job.runRequestId);
  // A cancel during the install step stops the model download; the runtime install
  // (a single shared task) keeps going — it is owned by the System row.
  cancelPythonModelDownload(MODEL_ID);
  return { success: true };
}
