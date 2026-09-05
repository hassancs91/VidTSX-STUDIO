/**
 * Image → 3D for 3D Studio (plan §5): resolves the source image, runs `triposr` through
 * the shared model-job skeleton (install step, progress, cancel), and files the result as
 * {userData}/threed-studio/models/<id>/{mesh.glb, input.png, preview.png, request.json}
 * + a db row. Stage mapping: worker import/load-model → "Loading model", preprocess →
 * "Preparing image", encode/shape → "Shape" (pct from the slab progress), export/preview
 * → "Export".
 */
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type { Sd3dCancelRequest, Sd3dCancelResponse, Sd3dGenerateRequest, Sd3dGenerateResponse, Sd3dStage, ThreedStudioEntry } from '@shared/ipc/types';
import { getTempDir } from '../utils/paths';
import { getImageEntry, getImageFilePath } from '../services/image-studio-db';
import { startPythonModel } from '../services/python-models';
import { INPUT_FILE_NAME, MESH_FILE_NAME, PREVIEW_FILE_NAME, REQUEST_FILE_NAME } from '../services/threed-studio-files';
import { registerModel, reserveModelDir } from '../services/threed-studio-db';
import { cancelModelJob, startModelJob } from './python-model-job';

const MODEL_ID = 'triposr';

const STAGE_MAP: Record<string, { stage: Sd3dStage; message?: string }> = {
  starting: { stage: 'preparing-runtime', message: 'Starting the AI runtime' },
  ready: { stage: 'preparing-runtime', message: 'Loading the 3D pipeline' },
  import: { stage: 'preparing-runtime', message: 'Loading the 3D pipeline' },
  'load-model': { stage: 'loading-model', message: 'Loading TripoSR (1.6 GB)' },
  preprocess: { stage: 'preparing-image', message: 'Cutting out the subject' },
  encode: { stage: 'shape', message: 'Encoding the image' },
  shape: { stage: 'shape', message: 'Building the mesh' },
  export: { stage: 'export', message: 'Writing the GLB' },
  preview: { stage: 'export', message: 'Rendering the preview' },
};

function mapStage(workerStage: string): { stage: Sd3dStage; message?: string } {
  return STAGE_MAP[workerStage] ?? { stage: 'shape' };
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
  name: string;
  imageStudioId: string | null;
}

async function resolveSource(req: Sd3dGenerateRequest): Promise<Source> {
  if (req.source.kind === 'image-studio') {
    const entry = getImageEntry(req.source.id);
    const imagePath = getImageFilePath(req.source.id);
    if (!entry || !imagePath) throw new Error('Image not found in Image Studio');
    return { imagePath, temp: false, name: entry.prompt.slice(0, 60) || entry.fileName, imageStudioId: entry.id };
  }
  const dir = path.join(getTempDir(), 'sd3d-inputs');
  await fs.mkdir(dir, { recursive: true });
  const stem = (req.source.fileName ? path.basename(req.source.fileName, path.extname(req.source.fileName)) : 'image').replace(/[^\w.-]+/g, '_') || 'image';
  const imagePath = path.join(dir, `${stem}-${randomUUID().slice(0, 8)}${extFor(req.source.contentType, req.source.fileName)}`);
  await fs.writeFile(imagePath, Buffer.from(req.source.base64, 'base64'));
  return { imagePath, temp: true, name: req.source.fileName ?? 'Uploaded image', imageStudioId: null };
}

export async function handleSd3dGenerate(event: IpcMainInvokeEvent, req: Sd3dGenerateRequest): Promise<Sd3dGenerateResponse> {
  try {
    const result = await startModelJob<Sd3dStage, { entry: ThreedStudioEntry; seconds: number }>({
      modelId: MODEL_ID,
      sender: event.sender,
      channels: { progress: IPC.SD3D_GENERATE_PROGRESS, complete: IPC.SD3D_GENERATE_COMPLETE, error: IPC.SD3D_GENERATE_ERROR },
      installIfMissing: req.installIfMissing === true,
      runtimeVariant: req.runtimeVariant,
      installStages: { runtime: 'installing-runtime', model: 'downloading-model' },
      mapWorkerStage: mapStage,
      run: async ({ signal, onProgress, setStarted, stage }) => {
        const source = await resolveSource(req);
        const slot = await reserveModelDir();
        try {
          const quality = req.quality === '512' ? '512' : '256';
          const options = {
            quality,
            removeBackground: req.removeBackground !== false,
            ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
            ...(req.device === 'cpu' ? { device: 'cpu' as const } : {}),
          };
          const started = await startPythonModel({
            modelId: MODEL_ID,
            input: { imagePath: source.imagePath },
            options,
            outputDir: slot.dir,
            outputBaseName: path.basename(MESH_FILE_NAME, path.extname(MESH_FILE_NAME)),
            previewPath: path.join(slot.dir, PREVIEW_FILE_NAME),
            source: source.imageStudioId ? { imageStudioId: source.imageStudioId } : { uploaded: true, fileName: source.name },
            signal,
            onProgress,
          });
          setStarted(started);
          const run = await started.promise;
          stage('saving', 'Adding to the gallery');

          // The runner writes `<output>.input.png` (the preprocessed input) — keep it as input.png.
          const preprocessed = path.join(slot.dir, 'mesh.input.png');
          let hasInput = false;
          try {
            await fs.rename(preprocessed, path.join(slot.dir, INPUT_FILE_NAME));
            hasInput = true;
          } catch {
            await fs.copyFile(source.imagePath, path.join(slot.dir, INPUT_FILE_NAME)).then(() => { hasInput = true; }).catch(() => {});
          }
          const hasPreview = await fs.stat(path.join(slot.dir, PREVIEW_FILE_NAME)).then((s) => s.size > 0).catch(() => false);
          await fs.writeFile(
            path.join(slot.dir, REQUEST_FILE_NAME),
            JSON.stringify({ modelId: MODEL_ID, options, source: { name: source.name, imageStudioId: source.imageStudioId }, stats: run.stats, seconds: run.seconds, createdAt: new Date().toISOString() }, null, 2),
            'utf8',
          );
          const entry = await registerModel({
            id: slot.id,
            dirName: slot.dirName,
            name: source.name,
            sourceImageName: source.name,
            sourceImageId: source.imageStudioId,
            model: MODEL_ID,
            quality: Number.parseInt(quality, 10),
            seed: typeof req.seed === 'number' ? req.seed : null,
            removeBackground: req.removeBackground !== false,
            vertices: typeof run.stats.vertices === 'number' ? run.stats.vertices : null,
            faces: typeof run.stats.faces === 'number' ? run.stats.faces : null,
            seconds: run.seconds,
            device: typeof run.stats.device === 'string' ? run.stats.device : run.device,
            hasPreview,
            hasInput,
          });
          return { entry, seconds: run.seconds };
        } catch (err) {
          await fs.rm(slot.dir, { recursive: true, force: true }).catch(() => {});
          throw err;
        } finally {
          if (source.temp) await fs.unlink(source.imagePath).catch(() => {});
        }
      },
    });
    if (result.success) return { success: true, requestId: result.requestId };
    return 'notReady' in result ? { success: false, notReady: result.notReady, error: result.error } : { success: false, error: result.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '3D generation failed' };
  }
}

export async function handleSd3dCancel(_event: IpcMainInvokeEvent, req: Sd3dCancelRequest): Promise<Sd3dCancelResponse> {
  return { success: cancelModelJob(req.requestId) };
}
