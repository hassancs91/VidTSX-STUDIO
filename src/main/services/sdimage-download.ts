/**
 * One-click download for image profiles + installed models. All-in-one
 * checkpoints (SD1.5/SDXL/SD3.5) are single-file and download exactly as before.
 * A Flux profile is only usable with its companions (text encoders + VAE), so a
 * profile download fetches the model file AND any companions missing from the
 * folder — each as its own download-manager task (.part + finalizePath), and the
 * model lands Ready in one click.
 *
 * Companions land in the models-folder root under their canonical names, shared
 * by every model in the folder (and skipped when already present — one t5xxl
 * serves every Flux model). Companion downloads are best-effort: if a URL is
 * unreachable the model + other files still land, and the missing one degrades to
 * a "Needs N files · Get ↗" issue — never a hard failure. Progress carries
 * `fileLabel` + `fileStep` so the renderer can show which file is downloading.
 *
 * NOTE: `downloadUrl`s are compiled into the catalog today. They are structured
 * so a backend override manifest can repoint them later without an app release
 * (the download mechanism here is URL-source-agnostic).
 */
import fs from 'fs/promises';
import path from 'path';
import { ModelLibraryError } from '@shared/model-library/types';
import type {
  CompanionRequirement,
  SdDownloadProgress,
  SdModelMeta,
} from '../../local-image-engine/types';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import { enqueueDownload } from './download-manager';
import { getImageModelsDir, getLastScan, scanImageLibrary } from './sdimage-library';
import { missingCompanionsFor } from './sdimage-companions';

type ProgressCallback = (progress: SdDownloadProgress) => void;

interface DownloadFile {
  url: string;
  fileName: string;
  label: string;
  /** Stable engine task id — companions share one id across models. */
  taskId: string;
  /** When true a download failure throws; companions are best-effort (false). */
  required: boolean;
  /** Catalogue sha256 (hex); the engine refuses to reveal a file that does not match. */
  sha256?: string;
}

const COMPANION_LABELS: Record<CompanionRequirement['kind'], string> = {
  clip_l: 'CLIP-L',
  t5xxl: 'Text encoder',
  vae: 'VAE',
  llm: 'LLM encoder',
};

/** Download tasks for a model's missing, directly-downloadable companions. */
function companionFiles(meta: SdModelMeta, modelsDir: string): DownloadFile[] {
  const files: DownloadFile[] = [];
  for (const companion of missingCompanionsFor(meta, modelsDir)) {
    if (!companion.downloadUrl) continue; // link-only (e.g. gated) — stays a manual issue
    files.push({
      url: companion.downloadUrl,
      fileName: companion.fileNames[0],
      label: COMPANION_LABELS[companion.kind] ?? companion.kind,
      taskId: `sdimage-companion-${companion.fileNames[0].toLowerCase()}`,
      required: false,
      ...(companion.sha256 ? { sha256: companion.sha256 } : {}),
    });
  }
  return files;
}

/**
 * Run a set of downloads sequentially. Required failures throw; best-effort
 * (companion) failures are logged and skipped so the rest of the set still lands.
 * The engine renames .part → final BEFORE emitting 'completed', so a rescan on
 * complete always sees the finished file.
 */
async function runDownloadSet(
  files: DownloadFile[],
  modelsDir: string,
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  // Single-file (all-in-one) downloads carry no per-file label — the renderer
  // just shows the percent, as before. Multi-file (Flux) sets label each step.
  const multiFile = files.length > 1;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const finalPath = path.join(modelsDir, file.fileName);
    try {
      await enqueueDownload(
        {
          id: file.taskId,
          url: file.url,
          destPath: `${finalPath}.part`,
          finalizePath: finalPath,
          ...(file.sha256 ? { sha256: file.sha256 } : {}),
          metadata: {
            modelId,
            type: 'sdimage-model',
            ...(multiFile ? { fileLabel: file.label, fileStep: `${i + 1}/${files.length}` } : {}),
          },
        },
        onProgress
          ? (progress) =>
              onProgress({
                modelId,
                percent: progress.percent,
                downloadedBytes: progress.downloadedBytes,
                totalBytes: progress.totalBytes,
              })
          : undefined,
      );
    } catch (err) {
      if (file.required) throw err;
      console.warn(`[sdimage-download] companion "${file.fileName}" failed to download:`, err);
    }
  }
}

/** Download a catalog profile: the model file + any missing companions. */
export async function downloadProfileModel(
  profileId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const profile = SD_MODEL_CATALOG.find((p) => p.id === profileId);
  if (!profile) {
    throw new ModelLibraryError('unknown-model', `Unknown model: ${profileId}`);
  }
  if (!profile.downloadUrl) {
    throw new ModelLibraryError(
      'import-failed',
      `"${profile.name}" has no direct download — get it from ${profile.sourceUrl} and drop it into your models folder.`,
    );
  }

  const modelsDir = await getImageModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  const modelFileName =
    profile.matchFileNames?.[0] ?? path.basename(profile.downloadUrl.split('?')[0]);
  const files: DownloadFile[] = [
    {
      url: profile.downloadUrl,
      fileName: modelFileName,
      label: 'Model',
      taskId: `sdimage-model-${profileId}`,
      required: true,
      ...(profile.sha256 ? { sha256: profile.sha256 } : {}),
    },
    ...companionFiles(profile.meta, modelsDir),
  ];

  await runDownloadSet(files, modelsDir, profileId, onProgress);
  return path.join(modelsDir, modelFileName);
}

/**
 * Fetch only the missing companions for an already-installed model — the
 * "Download files" action on a "Needs N files" row. Works for profile and custom
 * imports (reads companions from the scanned model's meta). No-op when nothing is
 * missing or directly downloadable.
 */
export async function downloadModelCompanions(
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const scan = getLastScan() ?? (await scanImageLibrary());
  const installed = scan.installed.find((m) => m.id === modelId);
  if (!installed) {
    throw new ModelLibraryError('unknown-model', `Model not installed: ${modelId}`);
  }

  const modelsDir = await getImageModelsDir();
  const files = companionFiles(installed.meta, modelsDir);
  if (files.length === 0) return;

  await runDownloadSet(files, modelsDir, modelId, onProgress);
}
