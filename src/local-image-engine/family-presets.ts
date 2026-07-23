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

// FLUX.1 companions — one-click download URLs verified HTTP-200 + exact
// Content-Length against the HuggingFace API (2026-07-22). Text encoders come
// from comfyanonymous/flux_text_encoders (Apache-2.0, ungated — the ecosystem
// standard). The official BFL VAE repo is GATED (login required), so the
// `downloadUrl` points at Comfy-Org's ungated re-host, whose ae.safetensors is
// byte-identical (same SHA-256) to the official file; `sourceUrl` still points
// at the official page for the manual "Get ↗" fallback.
const FLUX1_CLIP_L: CompanionRequirement = {
  kind: 'clip_l',
  fileNames: ['clip_l.safetensors'],
  sourceUrl: 'https://huggingface.co/comfyanonymous/flux_text_encoders',
  sizeLabel: '246 MB',
  downloadUrl: 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors',
  sizeBytes: 246_144_152,
};

// Prefer the fp8 encoder (4.9 GB) over fp16 (9.8 GB) — saner for quantized
// models. fp16 stays an accepted filename so an existing fp16 is still matched.
const FLUX1_T5XXL: CompanionRequirement = {
  kind: 't5xxl',
  fileNames: ['t5xxl_fp8_e4m3fn.safetensors', 't5xxl_fp16.safetensors'],
  sourceUrl: 'https://huggingface.co/comfyanonymous/flux_text_encoders',
  sizeLabel: '4.9 GB (fp8)',
  downloadUrl:
    'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors',
  sizeBytes: 4_893_934_904,
};

const FLUX1_VAE: CompanionRequirement = {
  kind: 'vae',
  fileNames: ['ae.safetensors'],
  sourceUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-schnell',
  sizeLabel: '335 MB',
  downloadUrl:
    'https://huggingface.co/Comfy-Org/Omnigen2_ComfyUI_repackaged/resolve/main/split_files/vae/ae.safetensors',
  sizeBytes: 335_304_388,
};

export const FLUX1_COMPANIONS: CompanionRequirement[] = [
  FLUX1_CLIP_L,
  FLUX1_T5XXL,
  FLUX1_VAE,
];

// FLUX.2 uses a Qwen3 LLM text encoder + its own VAE (locations per the
// stable-diffusion.cpp flux2 docs). The VAE ships as `ae.safetensors` in
// black-forest-labs/FLUX.2-dev (ungated) — rename it to flux2_ae.safetensors
// so it can't collide with the FLUX.1 ae.safetensors; Comfy-Org/flux2-klein
// ships the same file as flux2-vae.safetensors.
const FLUX2_VAE: CompanionRequirement = {
  kind: 'vae',
  fileNames: ['flux2_ae.safetensors', 'flux2-vae.safetensors'],
  sourceUrl: 'https://huggingface.co/black-forest-labs/FLUX.2-dev',
  sizeLabel: '336 MB',
};

/** FLUX.2 Klein 4B variants: Qwen3-4B encoder (GGUF or Comfy-Org safetensors). */
export const FLUX2_4B_COMPANIONS: CompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: ['Qwen3-4B-Q4_0.gguf', 'qwen_3_4b.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF',
    sizeLabel: '2.4 GB',
  },
  FLUX2_VAE,
];

/** FLUX.2 Klein 9B variant: Qwen3-8B encoder (no Q4_0 published; Q4_K_M is the small quant). */
export const FLUX2_9B_COMPANIONS: CompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: ['Qwen3-8B-Q4_K_M.gguf', 'qwen_3_8b.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/Qwen3-8B-GGUF',
    sizeLabel: '5.0 GB',
  },
  FLUX2_VAE,
];

/** Generic FLUX.2 companion set for custom imports (accepts either Qwen size). */
export const FLUX2_COMPANIONS: CompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: [
      'Qwen3-4B-Q4_0.gguf',
      'Qwen3-8B-Q4_K_M.gguf',
      'qwen_3_4b.safetensors',
      'qwen_3_8b.safetensors',
    ],
    sourceUrl: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF',
    sizeLabel: '2.4–5.0 GB',
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

// ─── Per-family hardware floors (VRAM/RAM preflight) ───────────────────

/**
 * Realistic per-family memory floors used by the VRAM/RAM preflight
 * (see {@link evaluateFit}). These are *floors* — the actual estimate is
 * `max(minVramGB, modelFileSize + activation overhead)`, so a big quantization
 * is driven by its file size while a small one can't dip below the family floor.
 *
 * The floor captures memory the file size alone understates: SD3/FLUX keep large
 * T5/Qwen text encoders resident alongside the transformer, so even a small quant
 * needs more VRAM than its file implies. Custom imports without a per-model
 * requirement inherit their family's floor.
 */
export const FAMILY_REQUIREMENTS: Record<SdModelFamily, { minVramGB: number; minRamGB: number }> = {
  sd15: { minVramGB: 2, minRamGB: 4 },
  sdxl: { minVramGB: 4, minRamGB: 8 },
  // SD3.x bundles a large T5 text encoder in the all-in-one checkpoint.
  sd3: { minVramGB: 6, minRamGB: 16 },
  // FLUX.1 loads clip_l + t5xxl companions in addition to the transformer.
  flux1: { minVramGB: 6, minRamGB: 16 },
  // FLUX.2 loads a Qwen3 LLM text encoder + VAE alongside the transformer.
  flux2: { minVramGB: 5, minRamGB: 12 },
};
