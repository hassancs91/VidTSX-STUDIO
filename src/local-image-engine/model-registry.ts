import type { ModelProfileEnvelope } from '@shared/model-library/types';
import type { SdModelMeta } from './types';
import {
  FLUX1_COMPANIONS,
  FLUX2_4B_COMPANIONS,
  FLUX2_9B_COMPANIONS,
} from './family-presets';

/**
 * Curated catalog of SD/Flux model profiles (design §3.1). A profile is
 * metadata + links, NOT a download instruction — there is no owner
 * infrastructure. `downloadUrl` is present only for stable, public,
 * unauthenticated hosts (D1 hybrid); everything else is link-only via
 * `sourceUrl` and dropped into the models folder by the user. New models and
 * link fixes ship via app updates (this catalog is compiled in).
 *
 * `matchFileNames` (old `modelFileName`) auto-matches canonically-named files in
 * the models folder to a profile, preserving the profile's tuned defaults and,
 * critically, its family (which drives sd-cli flags + companion requirements).
 */
export type SdModelProfile = ModelProfileEnvelope<SdModelMeta>;

export const SD_MODEL_CATALOG: SdModelProfile[] = [
  // ═══════════════════════════════════════════════════════════════════
  // Tiny / Test models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'bk-sdm-tiny-q4_0',
    category: 'image',
    name: 'BK-SDM-Tiny Q4 (fastest)',
    sizeBytes: 686_000_000,
    sizeLabel: '654 MB',
    matchFileNames: ['model_q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/Sashkanik13/bk-sdm-tiny-text2img-gguf',
    downloadUrl: 'https://huggingface.co/Sashkanik13/bk-sdm-tiny-text2img-gguf/resolve/main/model_q4_0.gguf',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 4, cfgScale: 7.0, sampler: 'lcm' },
      capabilities: { txt2img: true, img2img: false, reference: false },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SD 1.5 models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'sd15-base-q4',
    category: 'image',
    name: 'SD 1.5 Base Q4 (GGUF)',
    sizeBytes: 1_747_190_784,
    sizeLabel: '1.7 GB',
    matchFileNames: ['stable-diffusion-v1-5-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v1-5-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-Q4_0.gguf',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: true },
    },
  },

  {
    id: 'sd15-base-q8',
    category: 'image',
    name: 'SD 1.5 Base Q8 (GGUF)',
    sizeBytes: 1_881_241_504,
    sizeLabel: '1.9 GB',
    matchFileNames: ['stable-diffusion-v1-5-Q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v1-5-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-Q8_0.gguf',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: true },
    },
  },

  {
    id: 'sd15-dreamshaper-8',
    category: 'image',
    name: 'DreamShaper 8 (SD 1.5)',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    matchFileNames: ['dreamshaper-8.safetensors', 'DreamShaper_8_pruned.safetensors'],
    sourceUrl: 'https://civitai.com/models/4384/dreamshaper',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sd15-realistic-vision-v6',
    category: 'image',
    name: 'Realistic Vision V6.0 (SD 1.5)',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    matchFileNames: ['Realistic_Vision_V6.0_NV_B1_fp16.safetensors'],
    sourceUrl: 'https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE',
    downloadUrl: 'https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE/resolve/main/Realistic_Vision_V6.0_NV_B1_fp16.safetensors',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 25, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: true },
    },
  },

  {
    id: 'sd15-deliberate-v3',
    category: 'image',
    name: 'Deliberate V3 (SD 1.5)',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    matchFileNames: ['deliberate-v3.safetensors', 'Deliberate_v3.safetensors'],
    sourceUrl: 'https://huggingface.co/XpucT/Deliberate',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: true },
    },
  },

  {
    id: 'sd15-anything-v5',
    category: 'image',
    name: 'Anything V5 (SD 1.5, Anime)',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    matchFileNames: ['anything-v5.safetensors', 'AnythingV5_v5PrtRE.safetensors'],
    sourceUrl: 'https://civitai.com/models/9409/anything-v5ink',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: true },
    },
  },

  {
    id: 'sd15-epicrealism',
    category: 'image',
    name: 'epiCRealism Natural Sin (SD 1.5)',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    matchFileNames: ['epicrealism.safetensors', 'epicrealism_naturalSinRC1VAE.safetensors'],
    sourceUrl: 'https://civitai.com/models/25694/epicrealism',
    meta: {
      family: 'sd15',
      defaults: { width: 512, height: 512, steps: 25, cfgScale: 7.0, sampler: 'euler_a' },
      capabilities: { txt2img: true, img2img: true, reference: true },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SDXL models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'sdxl-base-q4',
    category: 'image',
    name: 'SDXL Base 1.0 Q4 (GGUF)',
    sizeBytes: 3_940_010_720,
    sizeLabel: '3.9 GB',
    matchFileNames: ['stable-diffusion-xl-base-1.0-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-xl-base-1.0-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-xl-base-1.0-GGUF/resolve/main/stable-diffusion-xl-base-1.0-Q4_0.gguf',
    meta: {
      family: 'sdxl',
      defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sdxl-turbo-q8',
    category: 'image',
    name: 'SDXL Turbo Q8 (GGUF, 1-step)',
    sizeBytes: 5_040_957_760,
    sizeLabel: '5.0 GB',
    matchFileNames: ['stable-diffusion-xl-1.0-turbo-Q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-xl-1.0-turbo-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-xl-1.0-turbo-GGUF/resolve/main/stable-diffusion-xl-1.0-turbo-Q8_0.gguf',
    meta: {
      family: 'sdxl',
      defaults: { width: 512, height: 512, steps: 1, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sdxl-lightning',
    category: 'image',
    name: 'SDXL Lightning (GGUF, 4-step)',
    sizeBytes: 3_670_000_000,
    sizeLabel: '3.5 GB',
    matchFileNames: ['sdxl-lightning-4step-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/OlegSkutte/SDXL-Lightning-GGUF',
    downloadUrl: 'https://huggingface.co/OlegSkutte/SDXL-Lightning-GGUF/resolve/main/sdxl-lightning-4step-Q4_0.gguf',
    meta: {
      family: 'sdxl',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'lcm' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sdxl-juggernaut-xl',
    category: 'image',
    name: 'Juggernaut XL (SDXL)',
    sizeBytes: 6_940_000_000,
    sizeLabel: '6.9 GB',
    matchFileNames: ['juggernaut-xl.safetensors', 'juggernautXL_juggXILByRundiffusion.safetensors'],
    sourceUrl: 'https://civitai.com/models/133005/juggernaut-xl',
    meta: {
      family: 'sdxl',
      defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sdxl-realvisxl-v5',
    category: 'image',
    name: 'RealVisXL V5.0 (SDXL)',
    sizeBytes: 6_800_000_000,
    sizeLabel: '6.5 GB',
    matchFileNames: ['realvisxl-v5.safetensors', 'RealVisXL_V5.0_fp16.safetensors'],
    sourceUrl: 'https://huggingface.co/SG161222/RealVisXL_V5.0',
    meta: {
      family: 'sdxl',
      defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sdxl-dreamshaper-xl',
    category: 'image',
    name: 'DreamShaper XL (SDXL)',
    sizeBytes: 6_500_000_000,
    sizeLabel: '6.2 GB',
    matchFileNames: ['dreamshaper-xl.safetensors', 'DreamShaperXL_Turbo_v2_1.safetensors'],
    sourceUrl: 'https://civitai.com/models/112902/dreamshaper-xl',
    meta: {
      family: 'sdxl',
      defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sdxl-epicrealism-xl',
    category: 'image',
    name: 'epiCRealism XL (SDXL)',
    sizeBytes: 6_500_000_000,
    sizeLabel: '6.2 GB',
    matchFileNames: ['epicrealism-xl.safetensors', 'epicrealismXL_vxviLastfameRealism.safetensors'],
    sourceUrl: 'https://civitai.com/models/277058/epicrealism-xl',
    meta: {
      family: 'sdxl',
      defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SD 3.5 models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'sd35-medium-q4',
    category: 'image',
    name: 'SD 3.5 Medium Q4 (GGUF)',
    sizeBytes: 8_915_187_392,
    sizeLabel: '8.9 GB',
    matchFileNames: ['stable-diffusion-v3-5-medium-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-medium-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-medium-GGUF/resolve/main/stable-diffusion-v3-5-medium-Q4_0.gguf',
    meta: {
      family: 'sd3',
      defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sd35-medium-q8',
    category: 'image',
    name: 'SD 3.5 Medium Q8 (GGUF)',
    sizeBytes: 10_026_419_712,
    sizeLabel: '10.0 GB',
    matchFileNames: ['stable-diffusion-v3-5-medium-Q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-medium-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-medium-GGUF/resolve/main/stable-diffusion-v3-5-medium-Q8_0.gguf',
    meta: {
      family: 'sd3',
      defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sd35-large-q4',
    category: 'image',
    name: 'SD 3.5 Large Q4 (GGUF)',
    sizeBytes: 11_942_648_448,
    sizeLabel: '11.9 GB',
    matchFileNames: ['stable-diffusion-v3-5-large-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-GGUF/resolve/main/stable-diffusion-v3-5-large-Q4_0.gguf',
    meta: {
      family: 'sd3',
      defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sd35-large-q8',
    category: 'image',
    name: 'SD 3.5 Large Q8 (GGUF)',
    sizeBytes: 15_949_811_072,
    sizeLabel: '15.9 GB',
    matchFileNames: ['stable-diffusion-v3-5-large-Q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-GGUF/resolve/main/stable-diffusion-v3-5-large-Q8_0.gguf',
    meta: {
      family: 'sd3',
      defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  {
    id: 'sd35-large-turbo-q4',
    category: 'image',
    name: 'SD 3.5 Large Turbo Q4 (GGUF, 4-step)',
    sizeBytes: 11_942_648_448,
    sizeLabel: '11.9 GB',
    matchFileNames: ['stable-diffusion-v3-5-large-turbo-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-turbo-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-turbo-GGUF/resolve/main/stable-diffusion-v3-5-large-turbo-Q4_0.gguf',
    meta: {
      family: 'sd3',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // FLUX.2 Klein (needs --diffusion-model + --llm Qwen encoder + VAE)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'flux2-klein-4b-q4',
    category: 'image',
    name: 'Flux.2 Klein 4B Q4 (GGUF, 4-step)',
    sizeBytes: 2_400_000_000,
    sizeLabel: '2.3 GB',
    matchFileNames: ['flux-2-klein-4b-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/black-forest-labs',
    meta: {
      family: 'flux2',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX2_4B_COMPANIONS,
    },
  },

  {
    id: 'flux2-klein-4b-q8',
    category: 'image',
    name: 'Flux.2 Klein 4B Q8 (GGUF, 4-step)',
    sizeBytes: 4_190_000_000,
    sizeLabel: '4.0 GB',
    matchFileNames: ['flux-2-klein-4b-Q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/black-forest-labs',
    meta: {
      family: 'flux2',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX2_4B_COMPANIONS,
    },
  },

  {
    id: 'flux2-klein-9b-q4',
    category: 'image',
    name: 'Flux.2 Klein 9B Q4 (GGUF, 4-step)',
    sizeBytes: 5_480_000_000,
    sizeLabel: '5.2 GB',
    matchFileNames: ['flux-2-klein-9b-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/black-forest-labs',
    meta: {
      family: 'flux2',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX2_9B_COMPANIONS,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // FLUX.1 — diffusion-model-only GGUFs (need clip_l + t5xxl + ae.safetensors)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'flux-schnell-q2k',
    category: 'image',
    name: 'Flux.1 Schnell Q2_K (GGUF, 4-step)',
    sizeBytes: 4_110_000_000,
    sizeLabel: '3.8 GB',
    matchFileNames: ['flux1-schnell-q2_k.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q2_k.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: false, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-dev-q2k',
    category: 'image',
    name: 'Flux.1 Dev Q2_K (GGUF)',
    sizeBytes: 4_160_000_000,
    sizeLabel: '3.9 GB',
    matchFileNames: ['flux1-dev-q2_k.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q2_k.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-schnell-q3k',
    category: 'image',
    name: 'Flux.1 Schnell Q3_K (GGUF, 4-step)',
    sizeBytes: 5_240_000_000,
    sizeLabel: '5.0 GB',
    matchFileNames: ['flux1-schnell-q3_k.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q3_k.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: false, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-dev-q3k',
    category: 'image',
    name: 'Flux.1 Dev Q3_K (GGUF)',
    sizeBytes: 5_290_000_000,
    sizeLabel: '5.0 GB',
    matchFileNames: ['flux1-dev-q3_k.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q3_k.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-mini-q4',
    category: 'image',
    name: 'Flux.1 Mini Q4 (GGUF, 3.2B)',
    sizeBytes: 5_220_000_000,
    sizeLabel: '5.0 GB',
    matchFileNames: ['FLUX.1-mini-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/TencentARC/flux-mini',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: false, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-schnell-q4',
    category: 'image',
    name: 'Flux.1 Schnell Q4 (GGUF, 4-step)',
    sizeBytes: 7_210_000_000,
    sizeLabel: '6.9 GB',
    matchFileNames: ['flux1-schnell-q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q4_0.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: false, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-schnell-q8',
    category: 'image',
    name: 'Flux.1 Schnell Q8 (GGUF, 4-step)',
    sizeBytes: 13_420_000_000,
    sizeLabel: '12.8 GB',
    matchFileNames: ['flux1-schnell-q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q8_0.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: false, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-schnell',
    category: 'image',
    name: 'Flux Schnell (Full Precision)',
    sizeBytes: 12_000_000_000,
    sizeLabel: '12 GB',
    // Full-precision flux1-schnell is diffusion-model-only (transformer without
    // bundled encoders) → needs the FLUX.1 companion set. Verify against a real
    // sd-cli whether any packaging is all-in-one (would toggle allInOne + -m).
    matchFileNames: ['flux-schnell.safetensors', 'flux1-schnell.safetensors'],
    sourceUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-schnell',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: false, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-dev-q4',
    category: 'image',
    name: 'Flux.1 Dev Q4 (GGUF)',
    sizeBytes: 7_260_000_000,
    sizeLabel: '6.9 GB',
    matchFileNames: ['flux1-dev-q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q4_0.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-dev-q8',
    category: 'image',
    name: 'Flux.1 Dev Q8 (GGUF)',
    sizeBytes: 13_420_000_000,
    sizeLabel: '12.8 GB',
    matchFileNames: ['flux1-dev-q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf',
    downloadUrl: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q8_0.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },

  {
    id: 'flux-fill-dev-q4',
    category: 'image',
    name: 'Flux.1 Fill Dev Q4 (GGUF, Inpaint)',
    sizeBytes: 7_260_000_000,
    sizeLabel: '6.9 GB',
    matchFileNames: ['FLUX.1-Fill-dev-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/gpustack/FLUX.1-Fill-dev-GGUF',
    downloadUrl: 'https://huggingface.co/gpustack/FLUX.1-Fill-dev-GGUF/resolve/main/FLUX.1-Fill-dev-Q4_0.gguf',
    meta: {
      family: 'flux1',
      defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { txt2img: true, img2img: true, reference: false },
      useDiffusionModelFlag: true,
      companions: FLUX1_COMPANIONS,
    },
  },
];
