/**
 * Image model library (design §6.2, §7) — the image adapter over the
 * category-agnostic model-library core. The models folder is the single source
 * of truth: scanning classifies files against the profile catalog, sidecars
 * describe custom models, companions resolve at generation time. No owner
 * infrastructure, no central manifest.
 */
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type {
  InstalledModel,
  ModelCategoryDescriptor,
  SidecarFileV1,
} from '@shared/model-library/types';
import { ModelLibraryError } from '@shared/model-library/types';
import {
  classifyFile,
  deleteSidecar,
  importModelFile,
  readSidecar,
  registerCategory,
  registerRuntime,
  scanModelFiles,
  writeSidecar,
} from './model-library';
import type {
  ImportMode,
  ScannedFile,
} from '@shared/model-library/types';
import type {
  ResolvedSdModel,
  SdModelFamily,
  SdModelMeta,
} from '../../local-image-engine/types';
import type { SdModelResolver } from '../../local-image-engine';
import { SD_MODEL_CATALOG, type SdModelProfile } from '../../local-image-engine/model-registry';
import { FAMILY_PRESETS, SD_FAMILIES } from '../../local-image-engine/family-presets';
import { getImageModelsFolder } from './settings';
import { buildCompanionFileKinds, resolveCompanions } from './sdimage-companions';
import { isSdCliInstalled } from './sdimage-models';

const IMAGE_EXTENSIONS = ['.safetensors', '.gguf', '.ckpt'];

export interface UnrecognizedFile {
  fileName: string;
  filePath: string;
  sizeBytes: number;
}

export interface CompanionFileEntry {
  fileName: string;
  kind: string;
  filePath: string;
}

export interface ImageLibraryScan {
  root: string;
  installed: InstalledModel<SdModelMeta>[];
  unrecognized: UnrecognizedFile[];
  companionsFound: CompanionFileEntry[];
}

export interface SetupConfig {
  family: SdModelFamily;
  name?: string;
  allInOne?: boolean;
}

let lastScan: ImageLibraryScan | null = null;
let companionKindsCache: Record<string, string> | null = null;

function companionKinds(): Record<string, string> {
  if (!companionKindsCache) companionKindsCache = buildCompanionFileKinds();
  return companionKindsCache;
}

/** Models folder for image checkpoints (setting, default `{aiModelsFolder}/image`). */
export async function getImageModelsDir(): Promise<string> {
  return getImageModelsFolder();
}

function profileById(id: string): SdModelProfile | undefined {
  return SD_MODEL_CATALOG.find((p) => p.id === id);
}

function profileByFileName(fileName: string): SdModelProfile | undefined {
  const lower = fileName.toLowerCase();
  return SD_MODEL_CATALOG.find((p) =>
    p.matchFileNames?.some((n) => n.toLowerCase() === lower),
  );
}

function normalizeFamily(value: unknown): SdModelFamily {
  return typeof value === 'string' && (SD_FAMILIES as string[]).includes(value)
    ? (value as SdModelFamily)
    : 'sd15';
}

function customIdFor(fileName: string): string {
  const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `custom-${slug}`;
}

function metaForCustom(sidecar: SidecarFileV1): SdModelMeta {
  const family = normalizeFamily(sidecar.family);
  const preset = FAMILY_PRESETS[family];
  const allInOne = sidecar.allInOne === true || preset.allInOne === true;
  return { ...preset, allInOne };
}

function sidecarFromSetup(setup: SetupConfig): SidecarFileV1 {
  return {
    version: 1,
    category: 'image',
    name: setup.name,
    family: setup.family,
    allInOne: setup.allInOne === true,
  };
}

function buildInstalledFromProfile(
  profile: SdModelProfile,
  file: ScannedFile,
  root: string,
): InstalledModel<SdModelMeta> {
  const { issues } = resolveCompanions(profile.meta, path.dirname(file.absolutePath), root);
  return {
    id: profile.id,
    category: 'image',
    name: profile.name,
    filePath: file.absolutePath,
    origin: 'profile',
    sizeBytes: file.sizeBytes,
    meta: profile.meta,
    issues,
  };
}

function buildInstalledFromSidecar(
  sidecar: SidecarFileV1,
  file: ScannedFile,
  root: string,
): InstalledModel<SdModelMeta> {
  const meta = metaForCustom(sidecar);
  const { issues } = resolveCompanions(meta, path.dirname(file.absolutePath), root);
  const name = typeof sidecar.name === 'string' && sidecar.name.length > 0 ? sidecar.name : file.fileName;
  return {
    id: customIdFor(file.fileName),
    category: 'image',
    name,
    filePath: file.absolutePath,
    origin: 'custom',
    sizeBytes: file.sizeBytes,
    meta,
    issues,
  };
}

/** Scan the models folder, classify every file, and cache the result. */
export async function scanImageLibrary(): Promise<ImageLibraryScan> {
  const root = await getImageModelsDir();
  const files = await scanModelFiles(root, { extensions: IMAGE_EXTENSIONS });

  const installed: InstalledModel<SdModelMeta>[] = [];
  const unrecognized: UnrecognizedFile[] = [];
  const companionsFound: CompanionFileEntry[] = [];

  for (const file of files) {
    const classification = await classifyFile(file, {
      profiles: SD_MODEL_CATALOG,
      companionFileNames: companionKinds(),
      readSidecar: async (p) => (await readSidecar(p)).sidecar,
    });

    if (classification.kind === 'profile') {
      const profile = profileById(classification.profileId);
      if (profile) {
        installed.push(buildInstalledFromProfile(profile, file, root));
      } else {
        unrecognized.push({ fileName: file.fileName, filePath: file.absolutePath, sizeBytes: file.sizeBytes });
      }
    } else if (classification.kind === 'custom') {
      installed.push(buildInstalledFromSidecar(classification.sidecar, file, root));
    } else if (classification.kind === 'companion') {
      companionsFound.push({
        fileName: file.fileName,
        kind: classification.companionKind,
        filePath: file.absolutePath,
      });
    } else {
      unrecognized.push({ fileName: file.fileName, filePath: file.absolutePath, sizeBytes: file.sizeBytes });
    }
  }

  lastScan = { root, installed, unrecognized, companionsFound };
  return lastScan;
}

export function getLastScan(): ImageLibraryScan | null {
  return lastScan;
}

/** Resolve an installed model to absolute model + companion paths (throws typed errors). */
export function resolveInstalledModel(
  installed: InstalledModel<SdModelMeta>,
  modelsRoot: string,
): ResolvedSdModel {
  if (!existsSync(installed.filePath)) {
    throw new ModelLibraryError('missing-file', `Model file not found: ${installed.filePath}`);
  }

  const meta = installed.meta;
  const { companionPaths, issues } = resolveCompanions(meta, path.dirname(installed.filePath), modelsRoot);

  if (issues.length > 0) {
    const issue = issues[0];
    throw new ModelLibraryError(
      'missing-companion',
      `${installed.name} needs "${issue.expectedNames[0]}" (${issue.kind}). ` +
        `Place it next to the model file or in the models folder. Get it: ${issue.sourceUrl}`,
    );
  }

  return {
    modelId: installed.id,
    modelFilePath: installed.filePath,
    family: meta.family,
    defaults: meta.defaults,
    capabilities: meta.capabilities,
    useDiffusionModelFlag: meta.useDiffusionModelFlag,
    allInOne: meta.allInOne,
    companionPaths,
  };
}

/** Resolve a model id from the cached scan (used by the engine — synchronous). */
export function resolveModelSync(modelId: string): ResolvedSdModel {
  if (!lastScan) {
    throw new ModelLibraryError('unknown-model', 'Image library has not been scanned yet');
  }
  const installed = lastScan.installed.find((m) => m.id === modelId);
  if (!installed) {
    throw new ModelLibraryError('unknown-model', `Model not installed: ${modelId}`);
  }
  return resolveInstalledModel(installed, lastScan.root);
}

/** Import a user-supplied file; write a sidecar when it doesn't match a profile and setup is provided. */
export async function importImageModel(
  sourcePath: string,
  mode: ImportMode,
  setup?: SetupConfig,
): Promise<{ filePath: string }> {
  const root = await getImageModelsDir();
  const destPath = await importModelFile(sourcePath, root, mode);

  const matched = profileByFileName(path.basename(destPath));
  if (!matched && setup) {
    await writeSidecar(destPath, sidecarFromSetup(setup));
  }

  await scanImageLibrary();
  return { filePath: destPath };
}

/** The "Set up" action for an unrecognized file: write/update its sidecar. */
export async function configureImageModel(filePath: string, setup: SetupConfig): Promise<void> {
  await writeSidecar(filePath, sidecarFromSetup(setup));
  await scanImageLibrary();
}

/** Remove a model: always drop its sidecar; delete the file from disk only when asked. */
export async function removeImageModel(
  modelId: string,
  options: { deleteFile: boolean },
): Promise<void> {
  const scan = lastScan ?? (await scanImageLibrary());
  const installed = scan.installed.find((m) => m.id === modelId);
  if (!installed) {
    throw new ModelLibraryError('unknown-model', `Model not installed: ${modelId}`);
  }

  await deleteSidecar(installed.filePath);
  if (options.deleteFile) {
    await fs.rm(installed.filePath, { force: true });
  }

  await scanImageLibrary();
}

/** Resolver injected into the image engine. */
export function createSdModelResolver(): SdModelResolver {
  return {
    list: () => lastScan?.installed ?? [],
    resolve: (modelId) => resolveModelSync(modelId),
  };
}

function buildImageDescriptor(): ModelCategoryDescriptor<SdModelMeta, ResolvedSdModel> {
  return {
    category: 'image',
    dirName: 'image',
    installKind: 'single-file',
    fileExtensions: IMAGE_EXTENSIONS,
    profiles: SD_MODEL_CATALOG,
    familyPresets: FAMILY_PRESETS,
    allowCustomImport: true,
    requiredRuntime: 'sd-cli',
    resolve: (installed) =>
      resolveInstalledModel(installed, lastScan?.root ?? path.dirname(installed.filePath)),
  };
}

/** Register the image category + sd-cli runtime with the model-library core. */
export function registerImageCategory(): void {
  registerCategory(buildImageDescriptor());
  registerRuntime({
    id: 'sd-cli',
    kind: 'bundled-binary',
    isAvailable: () => isSdCliInstalled(),
  });
}
