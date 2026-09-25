// The analysis models on disk (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
// tracks" → F1): downloaded on first use through the app's download engine
// (resumable, sha256-verified before the `.part` → final rename), then
// integrity-checked again before every load, the way `image-safety.ts`
// checks the Content Safety classifier. A file that is not exactly the
// pinned bytes is deleted and fetched again — never loaded.
//
// No Settings surface: the app has no generic local-model screen for ONNX
// files, so a job reports the download as its own progress ("Downloading
// face models… 43 %") and the models folder sits beside the other
// downloaded models (paths.ts `getAnalysisModelsDir`).

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { analysisModel, verifyModelFile, type AnalysisModelId } from '../../../analysis-engine/model-manifest';
import { cancelDownload, enqueueDownload } from '../download-manager';
import { getAnalysisModelsDir } from '../../utils/paths';

const log = logEngine.createLogger('AnalysisModels');

/** Download-task metadata.type — the download UI can tell these apart. */
export const ANALYSIS_MODEL_DOWNLOAD_TYPE = 'analysis-model';

export interface EnsuredModel {
  id: AnalysisModelId;
  path: string;
  sha256: string;
}

export type ModelProgress = (percent: number, message: string) => void;

/** Verified once per process per (path, size, mtime) — a 26 MB hash is not free on every job. */
const verified = new Map<string, { size: number; mtimeMs: number; sha256: string }>();
/** One in-flight ensure per model, so two jobs that start together share a download. */
const inflight = new Map<AnalysisModelId, Promise<EnsuredModel>>();

async function verifyCached(filePath: string, id: AnalysisModelId): Promise<EnsuredModel | null> {
  const spec = analysisModel(id);
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return null;
  }
  const cached = verified.get(filePath);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return { id, path: filePath, sha256: cached.sha256 };
  const check = await verifyModelFile(filePath, spec);
  if (!check.ok) {
    log.warn('Analysis model failed its integrity check — deleting and fetching again', { id, reason: check.reason });
    await fs.rm(filePath, { force: true }).catch(() => {});
    return null;
  }
  verified.set(filePath, { size: stat.size, mtimeMs: stat.mtimeMs, sha256: check.sha256 });
  return { id, path: filePath, sha256: check.sha256 };
}

async function download(id: AnalysisModelId, filePath: string, onProgress: ModelProgress | undefined, signal: AbortSignal | undefined): Promise<void> {
  const spec = analysisModel(id);
  const taskId = `analysis-model-${id}`;
  const onAbort = () => cancelDownload(taskId);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await enqueueDownload(
      {
        id: taskId,
        url: spec.url,
        destPath: `${filePath}.part`,
        finalizePath: filePath,
        sha256: spec.sha256,
        metadata: { type: ANALYSIS_MODEL_DOWNLOAD_TYPE, modelId: id },
      },
      (progress) => {
        if (progress.status === 'downloading' && progress.percent >= 0) {
          onProgress?.(progress.percent, `Downloading face models (${spec.file})… ${Math.round(progress.percent)}%`);
        } else if (progress.status === 'verifying') {
          onProgress?.(100, `Verifying ${spec.file}…`);
        }
      },
    );
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted) throw new Error('Cancelled');
}

async function ensureOne(id: AnalysisModelId, onProgress: ModelProgress | undefined, signal: AbortSignal | undefined): Promise<EnsuredModel> {
  const dir = getAnalysisModelsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, analysisModel(id).file);
  const present = await verifyCached(filePath, id);
  if (present) return present;
  log.info('Downloading analysis model', { id, url: analysisModel(id).url });
  await download(id, filePath, onProgress, signal);
  const fetched = await verifyCached(filePath, id);
  if (!fetched) throw new Error(`${analysisModel(id).file} downloaded but failed its integrity check`);
  log.info('Analysis model ready', { id, sha256: fetched.sha256.slice(0, 12) });
  return fetched;
}

/**
 * The requested models, present and verified — downloading whatever is
 * missing, in order. Progress carries the download's own percent with a
 * message that names the file; a job forwards it as its "generating" ticks.
 */
export async function ensureAnalysisModels(
  ids: readonly AnalysisModelId[],
  onProgress?: ModelProgress,
  signal?: AbortSignal,
): Promise<Record<string, EnsuredModel>> {
  const out: Record<string, EnsuredModel> = {};
  for (const id of ids) {
    if (signal?.aborted) throw new Error('Cancelled');
    let pending = inflight.get(id);
    if (!pending) {
      pending = ensureOne(id, onProgress, signal).finally(() => inflight.delete(id));
      inflight.set(id, pending);
    }
    out[id] = await pending;
  }
  return out;
}
