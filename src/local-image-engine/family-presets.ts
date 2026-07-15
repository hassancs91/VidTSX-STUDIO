import type {
  CompanionRequirement,
  SdModelFamily,
  SdModelMeta,
} from './types';

/**
 * Family presets (design §3.2) — the starting point for custom imports and the
 * source of companion requirements / preflight links. Per-model `meta` on a
 * profile always overrides the preset; the Set-up dialog's `allInOne` toggle
 * clears companions and switches FLUX.1 to `-m`.
 */

// ─── Companion requirement definitions ─────────────────────────────────

// FLUX.1 text encoders live in comfyanonymous/flux_text_encoders; the VAE
// (ae.safetensors) ships in the Black Forest Labs FLUX.1 repos.
const FLUX1_CLIP_L: CompanionRequirement = {
  kind: 'clip_l',
  fileNames: ['clip_l.safetensors'],
  sourceUrl: 'https://huggingface.co/comfyanonymous/flux_text_encoders',
  sizeLabel: '246 MB',
};

const FLUX1_T5XXL: CompanionRequirement = {
  kind: 't5xxl',
  fileNames: ['t5xxl_fp16.safetensors', 't5xxl_fp8_e4m3fn.safetensors'],
  sourceUrl: 'https://huggingface.co/comfyanonymous/flux_text_encoders',
  sizeLabel: '9.8 GB (fp16) / 4.9 GB (fp8)',
};

const FLUX1_VAE: CompanionRequirement = {
  kind: 'vae',
  fileNames: ['ae.safetensors'],
  sourceUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-schnell',
  sizeLabel: '335 MB',
};

export const FLUX1_COMPANIONS: CompanionRequirement[] = [
  FLUX1_CLIP_L,
  FLUX1_T5XXL,
  FLUX1_VAE,
];

// FLUX.2 uses a Qwen3 LLM text encoder + its own VAE. Exact public GGUF
// locations for the Qwen encoders are still being verified (FLUX.2 is new) —
// the source links point at the Black Forest Labs FLUX.2 org page for now.
const FLUX2_VAE: CompanionRequirement = {
  kind: 'vae',
  fileNames: ['flux2_ae.safetensors'],
  sourceUrl: 'https://huggingface.co/black-forest-labs',
  sizeLabel: '160 MB',
};

/** FLUX.2 Klein 4B variants: Qwen3-4B encoder. */
export const FLUX2_4B_COMPANIONS: CompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: ['qwen3-4b-q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/black-forest-labs',
    sizeLabel: '2.5 GB',
  },
  FLUX2_VAE,
];

/** FLUX.2 Klein 9B variant: Qwen3-8B encoder. */
export const FLUX2_9B_COMPANIONS: CompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: ['qwen3-8b-q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/black-forest-labs',
    sizeLabel: '4.9 GB',
  },
  FLUX2_VAE,
];

/** Generic FLUX.2 companion set for custom imports (accepts either Qwen size). */
export const FLUX2_COMPANIONS: CompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: ['qwen3-4b-q4_0.gguf', 'qwen3-8b-q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/black-forest-labs',
    sizeLabel: '2.5–4.9 GB',
  },
  FLUX2_VAE,
];

// ─── Family presets ────────────────────────────────────────────────────

export const FAMILY_PRESETS: Record<SdModelFamily, SdModelMeta> = {
  sd15: {
    family: 'sd15',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },
  sdxl: {
    family: 'sdxl',
    defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },
  sd3: {
    family: 'sd3',
    defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },
  flux1: {
    family: 'flux1',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
    useDiffusionModelFlag: true,
    companions: FLUX1_COMPANIONS,
  },
  flux2: {
    family: 'flux2',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
    useDiffusionModelFlag: true,
    companions: FLUX2_COMPANIONS,
  },
};

/** The families a user may pick for a custom import (all of them). */
export const SD_FAMILIES: SdModelFamily[] = ['sd15', 'sdxl', 'sd3', 'flux1', 'flux2'];
