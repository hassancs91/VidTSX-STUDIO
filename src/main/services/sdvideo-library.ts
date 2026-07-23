/**
 * Video model library — the second adapter on the category-agnostic
 * model-library core (image was the first, see sdimage-library.ts). The models
 * folder (`{aiModelsFolder}/video`) is the single source of truth: scanning
 * classifies files against the profile catalog; companions (umt5 encoder, VAE)
 * resolve next to the model file or in the folder root.
 *
 * v1 scope: catalog + downloads + scan + remove. No custom imports/sidecars
 * (allowCustomImport: false) and no folder override setting yet — both can be
 * added the way image did when needed.
 */
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { InstalledModel, ModelCategoryDescriptor, ModelIssue } from '@shared/model-library/types';
import { ModelLibraryError } from '@shared/model-library/types';
import { classifyFile, registerCategory, scanModelFiles } from './model-library';
import type {
  ResolvedVideoModel,
  VideoCompanionRequirement,
  VideoModelMeta,
} from '../../local-video-engine/types';
import { VIDEO_MODEL_CATALOG, type VideoModelProfile } from '../../local-video-engine/model-registry';
import { getAiModelsFolder } from './settings';

const VIDEO_EXTENSIONS = ['.safetensors', '.gguf'];

export interface VideoUnrecognizedFile {
  fileName: string;
  filePath: string;
  sizeBytes: number;
}

export interface VideoCompanionFileEntry {
  fileName: string;
  kind: string;
  filePath: string;
}

export interface VideoLibraryScan {
  root: string;
  installed: InstalledModel<VideoModelMeta>[];
  unrecognized: VideoUnrecognizedFile[];
  companionsFound: VideoCompanionFileEntry[];
}

let lastScan: VideoLibraryScan | null = null;
let companionKindsCache: Record<string, string> | null = null;

/** Companion filenames a scanned file might be, mapped to their kind. */
function companionKinds(): Record<string, string> {
  if (!companionKindsCache) {
    const map: Record<string, string> = {};
    for (const profile of VIDEO_MODEL_CATALOG) {
      for (const req of profile.meta.companions ?? []) {
        for (const name of req.fileNames) {
          map[name.toLowerCase()] = req.kind;
        }
      }
    }
    companionKindsCache = map;
  }
  return companionKindsCache;
}

export async function getVideoModelsDir(): Promise<string> {
  return path.join(await getAiModelsFolder(), 'video');
}

export function videoProfileById(id: string): VideoModelProfile | undefined {
  return VIDEO_MODEL_CATALOG.find((p) => p.id === id);
}

// ─── Companion resolution (model dir first, then folder root) ───────────

function findCompanionFile(fileNames: string[], searchDirs: string[]): string | undefined {
  for (const dir of searchDirs) {
    for (const fileName of fileNames) {
      const candidate = path.join(dir, fileName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

interface VideoCompanionResolution {
  companionPaths: ResolvedVideoModel['companionPaths'];
  issues: Extract<ModelIssue, { code: 'missing-companion' }>[];
}

export function resolveVideoCompanions(
  meta: VideoModelMeta,
  modelDir: string,
  modelsRoot: string,
): VideoCompanionResolution {
  const companionPaths: ResolvedVideoModel['companionPaths'] = {};
  const issues: Extract<ModelIssue, { code: 'missing-companion' }>[] = [];

  const searchDirs = modelDir === modelsRoot ? [modelDir] : [modelDir, modelsRoot];

  const kindToPathKey: Record<
    VideoCompanionRequirement['kind'],
    keyof ResolvedVideoModel['companionPaths']
  > = {
    vae: 'vae',
    t5xxl: 't5xxl',
    clip_vision: 'clipVision',
    llm: 'llm',
    audio_vae: 'audioVae',
    embeddings: 'embeddings',
  };

  for (const req of meta.companions ?? []) {
    const found = findCompanionFile(req.fileNames, searchDirs);
    if (found) {
      companionPaths[kindToPathKey[req.kind]] = found;
    } else {
      issues.push({
        code: 'missing-companion',
        kind: req.kind,
        expectedNames: req.fileNames,
        searchedDirs: searchDirs,
        sourceUrl: req.sourceUrl,
      });
    }
  }

  return { companionPaths, issues };
}

/** Companions of a profile that are not yet present on disk. */
export async function missingCompanionsFor(
  profile: VideoModelProfile,
): Promise<VideoCompanionRequirement[]> {
  const root = await getVideoModelsDir();
  return (profile.meta.companions ?? []).filter(
    (req) => !findCompanionFile(req.fileNames, [root]),
  );
}

// ─── Scan ───────────────────────────────────────────────────────────────

function buildInstalledFromProfile(
  profile: VideoModelProfile,
  filePath: string,
  sizeBytes: number,
  root: string,
): InstalledModel<VideoModelMeta> {
  const { issues } = resolveVideoCompanions(profile.meta, path.dirname(filePath), root);
  return {
    id: profile.id,
    category: 'video',
    name: profile.name,
    filePath,
    origin: 'profile',
    sizeBytes,
    meta: profile.meta,
    issues,
  };
}

/** Scan the video models folder, classify every file, and cache the result. */
export async function scanVideoLibrary(): Promise<VideoLibraryScan> {
  const root = await getVideoModelsDir();
  const files = await scanModelFiles(root, { extensions: VIDEO_EXTENSIONS });

  const installed: InstalledModel<VideoModelMeta>[] = [];
  const unrecognized: VideoUnrecognizedFile[] = [];
  const companionsFound: VideoCompanionFileEntry[] = [];

  for (const file of files) {
    const classification = await classifyFile(file, {
      profiles: VIDEO_MODEL_CATALOG,
      companionFileNames: companionKinds(),
      // No custom-model sidecars for video yet (allowCustomImport: false).
      readSidecar: () => null,
    });

    if (classification.kind === 'profile') {
      const profile = videoProfileById(classification.profileId);
      if (profile) {
        installed.push(buildInstalledFromProfile(profile, file.absolutePath, file.sizeBytes, root));
        continue;
      }
    }
    if (classification.kind === 'companion') {
      companionsFound.push({
        fileName: file.fileName,
        kind: classification.companionKind,
        filePath: file.absolutePath,
      });
      continue;
    }
    unrecognized.push({ fileName: file.fileName, filePath: file.absolutePath, sizeBytes: file.sizeBytes });
  }

  lastScan = { root, installed, unrecognized, companionsFound };
  return lastScan;
}

export function getLastVideoScan(): VideoLibraryScan | null {
  return lastScan;
}

// ─── Resolve / remove ───────────────────────────────────────────────────

export function resolveInstalledVideoModel(
  installed: InstalledModel<VideoModelMeta>,
  modelsRoot: string,
): ResolvedVideoModel {
  if (!existsSync(installed.filePath)) {
    throw new ModelLibraryError('missing-file', `Model file not found: ${installed.filePath}`);
  }

  const meta = installed.meta;
  const { companionPaths, issues } = resolveVideoCompanions(
    meta,
    path.dirname(installed.filePath),
    modelsRoot,
  );

  if (issues.length > 0) {
    const issue = issues[0];
    throw new ModelLibraryError(
      'missing-companion',
      `${installed.name} needs "${issue.expectedNames[0]}" (${issue.kind}). ` +
        `Place it in the video models folder. Get it: ${issue.sourceUrl}`,
    );
  }

  return {
    modelId: installed.id,
    modelFilePath: installed.filePath,
    family: meta.family,
    defaults: meta.defaults,
    capabilities: meta.capabilities,
    useDiffusionModelFlag: meta.useDiffusionModelFlag,
    companionPaths,
  };
}

/** Remove a model file from disk (companions are shared — never deleted here). */
export async function removeVideoModel(
  modelId: string,
  options: { deleteFile: boolean },
): Promise<void> {
  const scan = lastScan ?? (await scanVideoLibrary());
  const installed = scan.installed.find((m) => m.id === modelId);
  if (!installed) {
    throw new ModelLibraryError('unknown-model', `Model not installed: ${modelId}`);
  }

  if (options.deleteFile) {
    await fs.rm(installed.filePath, { force: true });
    await fs.rm(`${installed.filePath}.part`, { force: true });
  }

  await scanVideoLibrary();
}

/** Resolver injected into the video engine. */
export function createVideoModelResolver(): {
  list: () => InstalledModel<VideoModelMeta>[];
  resolve: (modelId: string) => ResolvedVideoModel;
} {
  return {
    list: () => lastScan?.installed ?? [],
    resolve: (modelId: string) => {
      const scan = lastScan;
      const installed = scan?.installed.find((m) => m.id === modelId);
      if (!scan || !installed) {
        throw new ModelLibraryError('unknown-model', `Model not installed: ${modelId}`);
      }
      return resolveInstalledVideoModel(installed, scan.root);
    },
  };
}

// ─── Registration ───────────────────────────────────────────────────────

function buildVideoDescriptor(): ModelCategoryDescriptor<VideoModelMeta, ResolvedVideoModel> {
  return {
    category: 'video',
    dirName: 'video',
    installKind: 'single-file',
    fileExtensions: VIDEO_EXTENSIONS,
    profiles: VIDEO_MODEL_CATALOG,
    allowCustomImport: false,
    requiredRuntime: 'sd-cli',
    resolve: (installed) =>
      resolveInstalledVideoModel(installed, lastScan?.root ?? path.dirname(installed.filePath)),
  };
}

/** Register the video category with the model-library core + run the initial scan. */
export async function initVideoLibrary(): Promise<void> {
  registerCategory(buildVideoDescriptor());
  const dir = await getVideoModelsDir();
  await fs.mkdir(dir, { recursive: true });
  await scanVideoLibrary();
}
