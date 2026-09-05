/**
 * The '3d' model-library category (plan §5 step 1), backed by the Python model
 * catalogue instead of a scanned folder: profiles are the catalogue's '3d' entries,
 * installed models are the ones whose files are all on disk, and the required runtime
 * is the downloadable Python runtime ('pytorch'). Registering it lets the generic
 * MODELS_* channels answer for '3d' and ties the category to the runtime registry;
 * the 3D tab itself reads the richer PYMODEL_STATUS projection.
 */
import type { InstalledModel, ModelCategoryDescriptor, ModelProfileEnvelope } from '@shared/model-library/types';
import { registerCategory } from '../model-library';
import { PYTHON_MODEL_CATALOG, formatModelBytes, pythonModelOwnBytes, type PythonModelProfile } from './registry';
import { pythonModelFilePath } from './status';

export interface ThreedModelMeta {
  pipeline: PythonModelProfile['pipeline'];
  vramMb: number | null;
  cpuOk: boolean;
  toolId: string;
}

export interface ResolvedThreedModel {
  modelId: string;
  pipeline: PythonModelProfile['pipeline'];
}

export function threedProfiles(): ModelProfileEnvelope<ThreedModelMeta>[] {
  return PYTHON_MODEL_CATALOG.filter((p) => p.category === '3d').map((p) => ({
    id: p.id,
    category: '3d',
    name: p.name,
    sizeBytes: pythonModelOwnBytes(p),
    sizeLabel: formatModelBytes(pythonModelOwnBytes(p)),
    sourceUrl: p.sourceUrl,
    downloadUrl: p.files[0]?.url,
    directoryUnit: { dirName: p.files[0]?.dest.split('/')[0] ?? p.id, files: p.files.map((f) => f.dest.split('/').slice(1).join('/')) },
    requirements: p.vramMb ? { minVramGB: p.vramMb / 1024 } : undefined,
    meta: { pipeline: p.pipeline, vramMb: p.vramMb, cpuOk: p.cpuOk, toolId: p.capability.toolId },
  }));
}

export const THREED_CATEGORY: ModelCategoryDescriptor<ThreedModelMeta, ResolvedThreedModel> = {
  category: '3d',
  dirName: 'python',
  installKind: 'directory',
  fileExtensions: [],
  profiles: threedProfiles(),
  allowCustomImport: false,
  requiredRuntime: 'pytorch',
  resolve(installed: InstalledModel<ThreedModelMeta>): ResolvedThreedModel {
    return { modelId: installed.id, pipeline: installed.meta.pipeline };
  },
};

export function registerThreedCategory(): void {
  registerCategory(THREED_CATEGORY);
}

/** Absolute path of a 3D profile's primary file (for InstalledModel.filePath). */
export function threedModelPrimaryPath(profileId: string): string | null {
  const p = PYTHON_MODEL_CATALOG.find((x) => x.id === profileId);
  return p?.files[0] ? pythonModelFilePath(p.files[0]) : null;
}
