/**
 * "Remove background" for Image Studio (plan §4 step 5): the first caller of the shared
 * `runPythonModel` service. Resolves the source (gallery image or a dropped file), runs
 * `rembg-u2net`, stores `<name>-nobg.png` in the images folder as a gallery entry with
 * `derivedFrom`, and pushes progress / complete / error events through the shared
 * model-job skeleton (python-model-job.ts), install step included.
 */
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type { RembgCancelRequest, RembgCancelResponse, RembgRunRequest, RembgRunResponse, RembgStage } from '@shared/ipc/types';
import { getTempDir } from '../utils/paths';
import { getImageEntry, getImageFilePath, registerImageFile } from '../services/image-studio-db';
import { getImagesDir } from '../services/image-studio-files';
import { startPythonModel } from '../services/python-models';
import { cancelModelJob, startModelJob } from './python-model-job';

const MODEL_ID = 'rembg-u2net';

const STAGE_MESSAGE: Record<string, string> = {
  starting: 'Starting the AI runtime',
  ready: 'Loading image tools',
  import: 'Loading image tools',
  'load-model': 'Loading the model',
  process: 'Removing background',
  export: 'Saving',
};

/** ready → load-model → process → export; everything before the first model stage is "Preparing runtime". */
function mapStage(workerStage: string): { stage: RembgStage; message?: string } {
  const stage: RembgStage = workerStage === 'load-model' || workerStage === 'process' || workerStage === 'export' ? 'removing-background' : 'preparing-runtime';
  return { stage, message: STAGE_MESSAGE[workerStage] };
}

function extFor(contentType: string | undefined, fileName: string | undefined): string {
  const fromName = fileName ? path.extname(fileName).toLowerCase() : '';
  if (fromName && /^\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(fromName)) return fromName;
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return '.jpg';
  if (contentType?.includes('webp')) return '.webp';
  return '.png';
}

interface Source {
  imagePath: string;
  temp: boolean;
  prompt: string;
  derivedFrom: string | null;
  stem: string;
}

/** Resolve the request's source into an absolute path + display facts; temp files are cleaned by the caller. */
async function resolveSource(req: RembgRunRequest): Promise<Source> {
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

export async function handleRembgRun(event: IpcMainInvokeEvent, req: RembgRunRequest): Promise<RembgRunResponse> {
  try {
    const result = await startModelJob<RembgStage, { entry: Awaited<ReturnType<typeof registerImageFile>>; seconds: number }>({
      modelId: MODEL_ID,
      sender: event.sender,
      channels: { progress: IPC.REMBG_PROGRESS, complete: IPC.REMBG_COMPLETE, error: IPC.REMBG_ERROR },
      installIfMissing: req.installIfMissing === true,
      runtimeVariant: req.runtimeVariant,
      installStages: { runtime: 'installing-runtime', model: 'downloading-model' },
      mapWorkerStage: mapStage,
      run: async ({ signal, onProgress, setStarted, stage }) => {
        const source = await resolveSource(req);
        try {
          const started = await startPythonModel({
            modelId: MODEL_ID,
            input: { imagePath: source.imagePath },
            options: { alphaMatting: req.options?.alphaMatting === true, postProcessMask: req.options?.postProcessMask === true },
            outputDir: getImagesDir(),
            outputBaseName: `${source.stem}-nobg`,
            source: source.derivedFrom ? { imageStudioId: source.derivedFrom } : { uploaded: true },
            signal,
            onProgress,
          });
          setStarted(started);
          const run = await started.promise;
          stage('saving', 'Adding to the gallery');
          const entry = await registerImageFile(run.outputPath, {
            prompt: source.prompt,
            model: MODEL_ID,
            width: typeof run.stats.width === 'number' ? run.stats.width : null,
            height: typeof run.stats.height === 'number' ? run.stats.height : null,
            contentType: 'image/png',
            durationMs: Math.round(run.seconds * 1000),
            folderId: req.folderId ?? null,
            derivedFrom: source.derivedFrom,
          });
          return { entry, seconds: run.seconds };
        } finally {
          if (source.temp) await fs.unlink(source.imagePath).catch(() => {});
        }
      },
    });
    if (result.success) return { success: true, requestId: result.requestId };
    return 'notReady' in result ? { success: false, notReady: result.notReady, error: result.error } : { success: false, error: result.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Background removal failed' };
  }
}

export async function handleRembgCancel(_event: IpcMainInvokeEvent, req: RembgCancelRequest): Promise<RembgCancelResponse> {
  return { success: cancelModelJob(req.requestId) };
}
