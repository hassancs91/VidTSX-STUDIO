/**
 * Companion-file resolution for the image library (design §5).
 *
 * Flux models need companion files (text encoders, VAE) resolved to absolute
 * paths at generation time. They are looked up next to the model file first,
 * then in the models-folder root (which gives free sharing — one
 * `t5xxl_fp16.safetensors` serves every FLUX.1 model in the folder).
 */
import { existsSync } from 'fs';
import path from 'path';
import type { ModelIssue } from '@shared/model-library/types';
import type { CompanionRequirement, ResolvedSdModel, SdModelMeta } from '../../local-image-engine/types';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import { FAMILY_PRESETS } from '../../local-image-engine/family-presets';

export type CompanionKind = CompanionRequirement['kind'];

/** Companion filenames that a scanned file might be, mapped to their kind. */
export function buildCompanionFileKinds(): Record<string, string> {
  const map: Record<string, string> = {};

  const addRequirement = (req: CompanionRequirement): void => {
    for (const name of req.fileNames) {
      map[name.toLowerCase()] = req.kind;
    }
  };

  for (const profile of SD_MODEL_CATALOG) {
    for (const req of profile.meta.companions ?? []) {
      addRequirement(req);
    }
  }
  for (const preset of Object.values(FAMILY_PRESETS)) {
    for (const req of preset.companions ?? []) {
      addRequirement(req);
    }
  }

  return map;
}

const KIND_TO_PATH_KEY: Record<CompanionKind, keyof ResolvedSdModel['companionPaths']> = {
  vae: 'vae',
  llm: 'llm',
  clip_l: 'clipL',
  t5xxl: 't5xxl',
};

/** Distinct search directories: the model's own dir, then the models root. */
function searchDirsFor(modelDir: string, modelsRoot: string): string[] {
  return modelDir === modelsRoot ? [modelDir] : [modelDir, modelsRoot];
}

function findCompanionFile(fileNames: string[], searchDirs: string[]): string | undefined {
  for (const dir of searchDirs) {
    for (const fileName of fileNames) {
      const candidate = path.join(dir, fileName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export interface CompanionResolution {
  companionPaths: ResolvedSdModel['companionPaths'];
  issues: Extract<ModelIssue, { code: 'missing-companion' }>[];
}

/**
 * Resolve every required companion for a model. All-in-one checkpoints and
 * models with no declared companions resolve to `{}` with no issues.
 */
export function resolveCompanions(
  meta: SdModelMeta,
  modelDir: string,
  modelsRoot: string,
): CompanionResolution {
  const companionPaths: ResolvedSdModel['companionPaths'] = {};
  const issues: Extract<ModelIssue, { code: 'missing-companion' }>[] = [];

  if (meta.allInOne || !meta.companions || meta.companions.length === 0) {
    return { companionPaths, issues };
  }

  const searchDirs = searchDirsFor(modelDir, modelsRoot);

  for (const req of meta.companions) {
    const found = findCompanionFile(req.fileNames, searchDirs);
    if (found) {
      companionPaths[KIND_TO_PATH_KEY[req.kind]] = found;
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

/**
 * Companions of a model that are not yet on disk (searched in the models-folder
 * root, where companions are shared across every model in the folder). All-in-one
 * checkpoints declare none. Drives the one-click download — it fetches only what
 * is missing, so a shared `t5xxl` is downloaded once and reused by every Flux model.
 */
export function missingCompanionsFor(
  meta: SdModelMeta,
  modelsRoot: string,
): CompanionRequirement[] {
  if (meta.allInOne || !meta.companions || meta.companions.length === 0) return [];
  return meta.companions.filter((req) => !findCompanionFile(req.fileNames, [modelsRoot]));
}
