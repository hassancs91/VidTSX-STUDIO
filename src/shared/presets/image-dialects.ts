/**
 * Request-body dialects for cloud image models — the image half of the video
 * pattern (video-models.ts + src/video-engine/dialect-capabilities.ts). A
 * dialect names the API family a model speaks; `IMAGE_DIALECT_DEFAULTS` says
 * which generation parameters that family accepts (`paramSchema`), how it
 * expresses output size, how many reference images its edit route takes and
 * which operations it supports. The per-model params dialog renders exactly
 * `paramSchema.fields`; the provider's request builder sends exactly those.
 *
 * A new model in a known family is a catalog entry naming the family (AI →
 * Providers → Model Catalogs), not new code. W2a's Seedream-on-ModelArk
 * provider drops in as `byteplus-seedream` below.
 */
import type { ImageParamField, ImageParamSchema } from './image-model-params';

export type ImageDialectId =
  | 'fal-flux'
  | 'fal-nano-banana'
  | 'fal-generic'
  | 'cloudflare'
  | 'byteplus-seedream'
  | 'openrouter'
  | 'gemini-cli';

export const IMAGE_DIALECT_IDS: readonly ImageDialectId[] = [
  'fal-flux',
  'fal-nano-banana',
  'fal-generic',
  'cloudflare',
  'byteplus-seedream',
  'openrouter',
  'gemini-cli',
];

/** Short labels for the catalog card's dialect select and row line. */
export const IMAGE_DIALECT_LABELS: Record<ImageDialectId, string> = {
  'fal-flux': 'FLUX (fal)',
  'fal-nano-banana': 'Nano Banana (fal)',
  'fal-generic': 'Generic (fal)',
  cloudflare: 'Workers AI (Cloudflare)',
  'byteplus-seedream': 'Seedream (BytePlus ModelArk)',
  openrouter: 'Chat images (OpenRouter)',
  'gemini-cli': 'Antigravity CLI (Google)',
};

export function isImageDialectId(value: string): value is ImageDialectId {
  return (IMAGE_DIALECT_IDS as readonly string[]).includes(value);
}

/** The dialect a provider's hand-added image entries default to. */
export const DEFAULT_IMAGE_DIALECT: Record<string, ImageDialectId> = {
  fal: 'fal-generic',
  cloudflare: 'cloudflare',
  byteplus: 'byteplus-seedream',
  openrouter: 'openrouter',
  'gemini-cli': 'gemini-cli',
};

/** The dialects a provider's catalog card offers (its own family only). */
export const IMAGE_DIALECTS_BY_PROVIDER: Record<string, readonly ImageDialectId[]> = {
  fal: ['fal-generic', 'fal-flux', 'fal-nano-banana'],
  cloudflare: ['cloudflare'],
  byteplus: ['byteplus-seedream'],
  openrouter: ['openrouter'],
};

export type ImageDialectOperation = 'text-to-image' | 'image-to-image' | 'multi-reference';

export interface ImageDialectDefaults {
  paramSchema: ImageParamSchema;
  /** What the family's routes can do; a provider's known-model table may narrow it per id. */
  supportedOperations: readonly ImageDialectOperation[];
}

const STEPS = (max: number, hint?: string): ImageParamField => ({
  key: 'steps',
  label: 'Steps',
  kind: 'number',
  min: 1,
  max,
  step: 1,
  hint,
});

const GUIDANCE = (max: number, hint?: string): ImageParamField => ({
  key: 'cfgScale',
  label: 'Guidance',
  kind: 'number',
  min: 0,
  max,
  step: 0.5,
  hint,
});

const SEED: ImageParamField = {
  key: 'seed',
  label: 'Seed',
  kind: 'number',
  min: 0,
  step: 1,
  hint: 'Fixed seed for repeatable output; leave empty for random.',
};

const NEGATIVE_PROMPT: ImageParamField = {
  key: 'negativePrompt',
  label: 'Negative prompt',
  kind: 'text',
};

const ALL_OPS: readonly ImageDialectOperation[] = [
  'text-to-image',
  'image-to-image',
  'multi-reference',
];

/**
 * Field sets verified against the provider docs on 2026-09-10:
 * - fal FLUX apps (`fal-ai/flux/dev`, `flux-pro/*`, `flux-2/*`) take
 *   `num_inference_steps`, `guidance_scale`, `seed`, `image_size`.
 * - fal Nano Banana apps take `aspect_ratio` (+ `resolution`), no steps,
 *   guidance or seed; their edit route accepts up to 14 `image_urls`.
 * - fal generic: `seed` + `image_size` is the common denominator (Seedream
 *   v4.5 on fal, most Bytedance/Recraft apps).
 * - Cloudflare Workers AI: `steps` / `num_steps` (the provider maps the key
 *   per model), `guidance`, `seed`, `negative_prompt` (SDXL only);
 *   flux-1-schnell caps steps at 8, flux-2 edit takes 4 input images.
 * - BytePlus ModelArk Seedream (W2a, re-read 2026-09-10): `size` (a tier
 *   or WxH), `image` (one, or 2–14 on 4.x / 5.0 lite, 2–10 on 5.0 pro),
 *   `sequential_image_generation`; the 4.x / 5.x reference lists NO
 *   `guidance_scale` and NO `seed` (Seedream 3.0's API had them). Live on
 *   5.0 pro: `seed` is accepted, `guidance_scale` is REJECTED ("not
 *   supported by the current model") — so Seed is the one field.
 * - OpenRouter chat images and the Antigravity CLI expose only an aspect
 *   ratio: no numeric parameters.
 */
export const IMAGE_DIALECT_DEFAULTS: Record<ImageDialectId, ImageDialectDefaults> = {
  'fal-flux': {
    paramSchema: {
      fields: [STEPS(50), GUIDANCE(20, 'FLUX dev defaults to 3.5; schnell ignores it.'), SEED],
      sizeMode: 'image_size',
      maxReferences: 4,
    },
    supportedOperations: ALL_OPS,
  },
  'fal-nano-banana': {
    paramSchema: { fields: [], sizeMode: 'aspect_ratio', maxReferences: 14 },
    supportedOperations: ALL_OPS,
  },
  'fal-generic': {
    paramSchema: { fields: [SEED], sizeMode: 'image_size', maxReferences: 10 },
    supportedOperations: ALL_OPS,
  },
  cloudflare: {
    paramSchema: {
      fields: [
        STEPS(50, 'flux-1-schnell accepts at most 8.'),
        GUIDANCE(30),
        SEED,
        NEGATIVE_PROMPT,
      ],
      sizeMode: 'image_size',
      maxReferences: 4,
    },
    supportedOperations: ['text-to-image'],
  },
  'byteplus-seedream': {
    paramSchema: {
      fields: [SEED],
      sizeMode: 'image_size',
      maxReferences: 14,
    },
    supportedOperations: ALL_OPS,
  },
  openrouter: {
    paramSchema: { fields: [], sizeMode: 'aspect_ratio', maxReferences: 8 },
    supportedOperations: ALL_OPS,
  },
  'gemini-cli': {
    paramSchema: { fields: [], sizeMode: 'aspect_ratio', maxReferences: 3 },
    supportedOperations: ['text-to-image', 'multi-reference'],
  },
};

export function getImageDialectSchema(dialect: ImageDialectId): ImageParamSchema {
  return IMAGE_DIALECT_DEFAULTS[dialect].paramSchema;
}
