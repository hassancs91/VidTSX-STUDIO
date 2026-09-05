/**
 * Download / cancel / remove a catalogue model's files (plan §4 step 2), in the
 * sdvideo-download.ts shape: one download-engine task per file, `.part` + `finalizePath`
 * + sha256 (the engine verifies before the rename, so a `completed` event never shows a
 * partial file), sequential, with `metadata.fileLabel` + `fileStep` so the renderer can
 * say "Model weights (1/4)". Companion files shared with another model are fetched only
 * when missing and are never deleted by `removePythonModel` of a model that merely
 * uses them.
 */
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { getPythonModelsRoot } from '../../utils/paths';
import { cancelDownload, enqueueDownload, getAllDownloads } from '../download-manager';
import { PYTHON_MODEL_DOWNLOAD_TYPE, pythonModelById, pythonModelFileTaskId } from './registry';
import { checkPythonModelFiles, pythonModelFilePath } from './status';

const log = logEngine.createLogger('PythonModels');

const inflight = new Map<string, Promise<void>>();

export function isPythonModelDownloadInflight(modelId: string): boolean {
  return inflight.has(modelId);
}

/**
 * Fetch every missing file the model needs. Idempotent while running (a second call
 * joins the first). Resolves when all files are on disk and verified.
 */
export function downloadPythonModel(modelId: string): Promise<void> {
  const existing = inflight.get(modelId);
  if (existing) return existing;
  const p = doDownload(modelId).finally(() => inflight.delete(modelId));
  inflight.set(modelId, p);
  return p;
}

async function doDownload(modelId: string): Promise<void> {
  const profile = pythonModelById(modelId);
  if (!profile) throw new Error(`Unknown model: ${modelId}`);
  const root = getPythonModelsRoot();
  const missing = (await checkPythonModelFiles(profile, root)).filter((f) => !f.present);
  if (missing.length === 0) return;

  for (let i = 0; i < missing.length; i++) {
    const { file, absPath } = missing[i];
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    // A stale file with the wrong size would fail the size check forever; the engine
    // overwrites the .part and the rename replaces the final file.
    log.info('Downloading model file', { modelId, dest: file.dest, bytes: file.bytes });
    await enqueueDownload({
      id: pythonModelFileTaskId(file),
      url: file.url,
      destPath: `${absPath}.part`,
      finalizePath: absPath,
      sha256: file.sha256,
      metadata: {
        type: PYTHON_MODEL_DOWNLOAD_TYPE,
        modelId,
        fileLabel: file.label,
        fileStep: `${i + 1}/${missing.length}`,
      },
    });
  }
  log.info('Model files complete', { modelId, files: missing.length });
}

/** Cancel every in-flight task that belongs to this model. */
export function cancelPythonModelDownload(modelId: string): boolean {
  let any = false;
  for (const d of getAllDownloads()) {
    if (d.metadata?.type !== PYTHON_MODEL_DOWNLOAD_TYPE || d.metadata.modelId !== modelId) continue;
    if (['completed', 'failed', 'cancelled'].includes(d.status)) continue;
    cancelDownload(d.id);
    any = true;
  }
  return any;
}

/**
 * Delete the model's own files (and their `.part` leftovers). Companion files are left
 * alone — another model may own them; removing that model removes them.
 */
export async function removePythonModel(modelId: string): Promise<void> {
  const profile = pythonModelById(modelId);
  if (!profile) throw new Error(`Unknown model: ${modelId}`);
  cancelPythonModelDownload(modelId);
  const root = getPythonModelsRoot();
  for (const file of profile.files) {
    const abs = pythonModelFilePath(file, root);
    await fs.rm(abs, { force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {});
    await fs.rm(`${abs}.part`, { force: true }).catch(() => {});
    // Prune the now-empty folders up to the models root (rmdir fails on non-empty ones).
    for (let dir = path.dirname(abs); dir.startsWith(root) && dir !== root; dir = path.dirname(dir)) {
      try { await fs.rmdir(dir); } catch { break; }
    }
  }
  log.info('Model removed', { modelId });
}
