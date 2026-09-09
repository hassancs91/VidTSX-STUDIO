/**
 * Per-model image generation parameters (docs/v1-completion-plan.md §2.2
 * W2c). One value shape serves every image provider: the local sd-cli
 * runtime reads all of it, the cloud dialects read the subset their API has
 * (`ImageParamSchema` says which). Users store overrides per model in the
 * settings key `imageModelParamOverrides`, keyed `provider/model`; a request
 * that names a field wins over the override, and the override wins over the
 * model's own defaults (`request ⊕ override ⊕ default`).
 */

/** The parameter surface. `cfgScale` is "guidance" on the cloud APIs. */
export interface ImageModelParams {
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  scheduler?: string;
  negativePrompt?: string;
  seed?: number;
  /** img2img denoising strength 0–1. */
  strength?: number;
}

export type ImageParamKey = keyof ImageModelParams;

export const IMAGE_PARAM_KEYS: readonly ImageParamKey[] = [
  'width',
  'height',
  'steps',
  'cfgScale',
  'sampler',
  'scheduler',
  'negativePrompt',
  'seed',
  'strength',
];

const NUMERIC_KEYS: ReadonlySet<ImageParamKey> = new Set([
  'width',
  'height',
  'steps',
  'cfgScale',
  'seed',
  'strength',
]);

/** One form field. The dialog and the advanced panel render exactly these. */
export interface ImageParamField {
  key: ImageParamKey;
  label: string;
  kind: 'number' | 'select' | 'text';
  min?: number;
  max?: number;
  step?: number;
  /** For `select`. */
  options?: readonly string[];
  /** One line under the field, when the API's meaning is not obvious. */
  hint?: string;
}

/**
 * What a model family / API dialect accepts. `sizeMode` is how the request
 * expresses output size (`none` = the API picks); `maxReferences` is the
 * reference-image cap of its edit route (0 = no reference input).
 */
export interface ImageParamSchema {
  fields: readonly ImageParamField[];
  sizeMode: 'image_size' | 'aspect_ratio' | 'none';
  maxReferences: number;
}

/** Stored overrides: `provider/model` → the fields the user set. */
export type ImageModelParamOverrides = Record<string, ImageModelParams>;

/** Settings key the overrides live under. */
export const IMAGE_MODEL_PARAM_OVERRIDES_KEY = 'imageModelParamOverrides';

/** `provider/model` — model ids may themselves contain slashes (OpenRouter). */
export function imageParamKey(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

export function splitImageParamKey(key: string): { providerId: string; modelId: string } | null {
  const slash = key.indexOf('/');
  if (slash <= 0 || slash === key.length - 1) return null;
  return { providerId: key.slice(0, slash), modelId: key.slice(slash + 1) };
}

export function schemaHasField(schema: ImageParamSchema | undefined, key: ImageParamKey): boolean {
  return schema?.fields.some((f) => f.key === key) ?? false;
}

/**
 * Keep only well-formed values: finite numbers for the numeric keys, trimmed
 * non-empty strings for the rest; unknown keys dropped. With a schema, keys
 * the schema does not declare are dropped too (a saved override can never
 * carry a field its model has no use for).
 */
export function sanitizeImageModelParams(
  raw: unknown,
  schema?: ImageParamSchema,
): ImageModelParams {
  const out: ImageModelParams = {};
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  for (const key of IMAGE_PARAM_KEYS) {
    if (schema && !schemaHasField(schema, key)) continue;
    const value = source[key];
    if (value === undefined || value === null || value === '') continue;
    if (NUMERIC_KEYS.has(key)) {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) continue;
      (out as Record<string, number>)[key] = n;
    } else if (typeof value === 'string') {
      const s = value.trim();
      if (s) (out as Record<string, string>)[key] = s;
    }
  }
  return out;
}

/**
 * `request ⊕ override`: a field the request names (not undefined) wins; the
 * override fills the rest. Undefined-valued keys on the request are treated
 * as absent, so `{ steps: undefined }` still takes the override's steps.
 */
export function mergeImageParams(
  request: ImageModelParams | undefined,
  override: ImageModelParams | undefined,
): ImageModelParams {
  const out: ImageModelParams = { ...(override ?? {}) };
  for (const key of IMAGE_PARAM_KEYS) {
    const value = request?.[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function hasAnyImageParams(params: ImageModelParams | undefined): boolean {
  return Boolean(params) && IMAGE_PARAM_KEYS.some((k) => params![k] !== undefined);
}
