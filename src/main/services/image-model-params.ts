/**
 * Per-model image parameter overrides (docs/v1-completion-plan.md §2.2 W2c).
 * One settings key, `imageModelParamOverrides`, holds `provider/model` →
 * ImageModelParams. The cloud image engine reads it through its param
 * resolver (installed by image-init) so every caller gets `request ⊕
 * override`; the direct sd-cli IPC applies it here for the same reason.
 * Values are sanitised on save AND on read — a hand-edited or stale row can
 * never reach a request builder.
 */
import type { SdGenerationRequest } from '../../local-image-engine';
import {
  IMAGE_MODEL_PARAM_OVERRIDES_KEY,
  hasAnyImageParams,
  imageParamKey,
  sanitizeImageModelParams,
  type ImageModelParamOverrides,
  type ImageModelParams,
} from '../../shared/presets/image-model-params';
import { getValue, setValue } from './settings-db';

function readAll(): ImageModelParamOverrides {
  const raw = getValue<Record<string, unknown>>(IMAGE_MODEL_PARAM_OVERRIDES_KEY);
  if (!raw || typeof raw !== 'object') return {};
  const clean: ImageModelParamOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    const params = sanitizeImageModelParams(value);
    if (hasAnyImageParams(params)) clean[key] = params;
  }
  return clean;
}

/** Every stored override, keyed `provider/model`. */
export function getImageModelParamOverrides(): ImageModelParamOverrides {
  return readAll();
}

/** The stored override for one model, or undefined. Synchronous (settings db). */
export function resolveImageModelParams(
  providerId: string,
  modelId: string,
): ImageModelParams | undefined {
  return readAll()[imageParamKey(providerId, modelId)];
}

/**
 * Store one model's override. Empty / null params remove the row ("Reset to
 * defaults"). Returns the full map after the write.
 */
export function saveImageModelParams(
  providerId: string,
  modelId: string,
  params: ImageModelParams | null,
): ImageModelParamOverrides {
  const all = readAll();
  const key = imageParamKey(providerId, modelId);
  const clean = sanitizeImageModelParams(params);
  if (hasAnyImageParams(clean)) all[key] = clean;
  else delete all[key];
  setValue(IMAGE_MODEL_PARAM_OVERRIDES_KEY, Object.keys(all).length ? all : undefined);
  return all;
}

/**
 * The direct sd-cli path (Tools → Image AI tester) bypasses the cloud engine,
 * so it applies the local model's override here: fields the request names
 * win, the override fills the rest, the family defaults cover what is left
 * (in the runner's buildArgs).
 */
export function applySdParamOverride(
  request: SdGenerationRequest,
  providerId: string,
  modelId: string | null | undefined,
): SdGenerationRequest {
  if (!modelId) return request;
  const o = resolveImageModelParams(providerId, modelId);
  if (!o) return request;
  return {
    ...request,
    width: request.width ?? o.width,
    height: request.height ?? o.height,
    steps: request.steps ?? o.steps,
    cfgScale: request.cfgScale ?? o.cfgScale,
    sampler: request.sampler ?? o.sampler,
    schedule: request.schedule ?? o.scheduler,
    negativePrompt: request.negativePrompt ?? o.negativePrompt,
    seed: request.seed ?? o.seed,
    strength: request.strength ?? o.strength,
  };
}
