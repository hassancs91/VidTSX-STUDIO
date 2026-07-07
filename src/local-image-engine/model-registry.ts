import type { SdModelDefinition } from './types';

/**
 * Base URL for SD model downloads. All model downloadPath values are
 * appended to this URL.
 */
export const SD_MODELS_BASE_URL = 'https://learnwithhasan.com/api/vidtsx/models/image';

/**
 * Hardcoded catalog of available SD models.
 * New models are added via app updates.
 */
export const SD_MODEL_CATALOG: SdModelDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════
  // Tiny / Test models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'bk-sdm-tiny-q4_0',
    name: 'BK-SDM-Tiny Q4 (fastest)',
    family: 'sd15',
    sizeBytes: 686_000_000,
    sizeLabel: '654 MB',
    downloadPath: 'https://huggingface.co/Sashkanik13/bk-sdm-tiny-text2img-gguf/resolve/main/model_q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'bk-sdm-tiny-q4_0',
    modelFileName: 'model_q4_0.gguf',
    defaults: { width: 512, height: 512, steps: 4, cfgScale: 7.0, sampler: 'lcm' },
    capabilities: { txt2img: true, img2img: false, reference: false },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SD 1.5 models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'sd15-base-q4',
    name: 'SD 1.5 Base Q4 (GGUF)',
    family: 'sd15',
    sizeBytes: 1_050_000_000,
    sizeLabel: '1.0 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd15-base-q4',
    modelFileName: 'stable-diffusion-v1-5-Q4_0.gguf',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },

  {
    id: 'sd15-base-q8',
    name: 'SD 1.5 Base Q8 (GGUF)',
    family: 'sd15',
    sizeBytes: 1_780_000_000,
    sizeLabel: '1.7 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-Q8_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd15-base-q8',
    modelFileName: 'stable-diffusion-v1-5-Q8_0.gguf',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },

  {
    id: 'sd15-dreamshaper-8',
    name: 'DreamShaper 8 (SD 1.5)',
    family: 'sd15',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    downloadPath: 'sd15/dreamshaper-8.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'dreamshaper-8',
    modelFileName: 'dreamshaper-8.safetensors',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sd15-realistic-vision-v6',
    name: 'Realistic Vision V6.0 (SD 1.5)',
    family: 'sd15',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    downloadPath: 'https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE/resolve/main/Realistic_Vision_V6.0_NV_B1_fp16.safetensors',
    archiveFormat: 'none',
    extractedName: 'realistic-vision-v6',
    modelFileName: 'Realistic_Vision_V6.0_NV_B1_fp16.safetensors',
    defaults: { width: 512, height: 512, steps: 25, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },

  {
    id: 'sd15-deliberate-v3',
    name: 'Deliberate V3 (SD 1.5)',
    family: 'sd15',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    downloadPath: 'sd15/deliberate-v3.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'deliberate-v3',
    modelFileName: 'deliberate-v3.safetensors',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },

  {
    id: 'sd15-anything-v5',
    name: 'Anything V5 (SD 1.5, Anime)',
    family: 'sd15',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    downloadPath: 'sd15/anything-v5.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'anything-v5',
    modelFileName: 'anything-v5.safetensors',
    defaults: { width: 512, height: 512, steps: 20, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },

  {
    id: 'sd15-epicrealism',
    name: 'epiCRealism Natural Sin (SD 1.5)',
    family: 'sd15',
    sizeBytes: 2_130_000_000,
    sizeLabel: '2.1 GB',
    downloadPath: 'sd15/epicrealism.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'epicrealism',
    modelFileName: 'epicrealism.safetensors',
    defaults: { width: 512, height: 512, steps: 25, cfgScale: 7.0, sampler: 'euler_a' },
    capabilities: { txt2img: true, img2img: true, reference: true },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SDXL models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'sdxl-base-q4',
    name: 'SDXL Base 1.0 Q4 (GGUF)',
    family: 'sdxl',
    sizeBytes: 3_670_000_000,
    sizeLabel: '3.5 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-xl-base-1.0-GGUF/resolve/main/stable-diffusion-xl-base-1.0-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sdxl-base-q4',
    modelFileName: 'stable-diffusion-xl-base-1.0-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sdxl-turbo-q8',
    name: 'SDXL Turbo Q8 (GGUF, 1-step)',
    family: 'sdxl',
    sizeBytes: 4_300_000_000,
    sizeLabel: '4.1 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-xl-1.0-turbo-GGUF/resolve/main/sd_xl_turbo_1.0_fp16-Q8_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sdxl-turbo-q8',
    modelFileName: 'sd_xl_turbo_1.0_fp16-Q8_0.gguf',
    defaults: { width: 512, height: 512, steps: 1, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sdxl-lightning',
    name: 'SDXL Lightning (GGUF, 4-step)',
    family: 'sdxl',
    sizeBytes: 3_670_000_000,
    sizeLabel: '3.5 GB',
    downloadPath: 'https://huggingface.co/OlegSkutte/SDXL-Lightning-GGUF/resolve/main/sdxl-lightning-4step-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sdxl-lightning',
    modelFileName: 'sdxl-lightning-4step-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'lcm' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sdxl-juggernaut-xl',
    name: 'Juggernaut XL (SDXL)',
    family: 'sdxl',
    sizeBytes: 6_940_000_000,
    sizeLabel: '6.9 GB',
    downloadPath: 'sdxl/juggernaut-xl.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'juggernaut-xl',
    modelFileName: 'juggernaut-xl.safetensors',
    defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sdxl-realvisxl-v5',
    name: 'RealVisXL V5.0 (SDXL)',
    family: 'sdxl',
    sizeBytes: 6_800_000_000,
    sizeLabel: '6.5 GB',
    downloadPath: 'sdxl/realvisxl-v5.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'realvisxl-v5',
    modelFileName: 'realvisxl-v5.safetensors',
    defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sdxl-dreamshaper-xl',
    name: 'DreamShaper XL (SDXL)',
    family: 'sdxl',
    sizeBytes: 6_500_000_000,
    sizeLabel: '6.2 GB',
    downloadPath: 'sdxl/dreamshaper-xl.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'dreamshaper-xl',
    modelFileName: 'dreamshaper-xl.safetensors',
    defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sdxl-epicrealism-xl',
    name: 'epiCRealism XL (SDXL)',
    family: 'sdxl',
    sizeBytes: 6_500_000_000,
    sizeLabel: '6.2 GB',
    downloadPath: 'sdxl/epicrealism-xl.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'epicrealism-xl',
    modelFileName: 'epicrealism-xl.safetensors',
    defaults: { width: 1024, height: 1024, steps: 25, cfgScale: 5.0, sampler: 'dpmpp_2m' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SD 3.5 models
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'sd35-medium-q4',
    name: 'SD 3.5 Medium Q4 (GGUF)',
    family: 'sd3',
    sizeBytes: 1_820_000_000,
    sizeLabel: '1.7 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-medium-GGUF/resolve/main/stable-diffusion-v3-5-medium-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd35-medium-q4',
    modelFileName: 'stable-diffusion-v3-5-medium-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sd35-medium-q8',
    name: 'SD 3.5 Medium Q8 (GGUF)',
    family: 'sd3',
    sizeBytes: 3_000_000_000,
    sizeLabel: '2.9 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-medium-GGUF/resolve/main/stable-diffusion-v3-5-medium-Q8_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd35-medium-q8',
    modelFileName: 'stable-diffusion-v3-5-medium-Q8_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sd35-large-q4',
    name: 'SD 3.5 Large Q4 (GGUF)',
    family: 'sd3',
    sizeBytes: 5_340_000_000,
    sizeLabel: '5.1 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-GGUF/resolve/main/stable-diffusion-v3-5-large-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd35-large-q4',
    modelFileName: 'stable-diffusion-v3-5-large-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sd35-large-q8',
    name: 'SD 3.5 Large Q8 (GGUF)',
    family: 'sd3',
    sizeBytes: 9_550_000_000,
    sizeLabel: '9.1 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-GGUF/resolve/main/stable-diffusion-v3-5-large-Q8_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd35-large-q8',
    modelFileName: 'stable-diffusion-v3-5-large-Q8_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 28, cfgScale: 4.5, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'sd35-large-turbo-q4',
    name: 'SD 3.5 Large Turbo Q4 (GGUF, 4-step)',
    family: 'sd3',
    sizeBytes: 5_340_000_000,
    sizeLabel: '5.1 GB',
    downloadPath: 'https://huggingface.co/gpustack/stable-diffusion-v3-5-large-turbo-GGUF/resolve/main/stable-diffusion-v3-5-large-turbo-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'sd35-large-turbo-q4',
    modelFileName: 'stable-diffusion-v3-5-large-turbo-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  // ═══════════════════════════════════════════════════════════════════
  // Flux models — FLUX.2 Klein (smallest, needs --llm + VAE)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'flux2-klein-4b-q4',
    name: 'Flux.2 Klein 4B Q4 (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 2_400_000_000,
    sizeLabel: '2.3 GB',
    downloadPath: 'flux/flux2-klein-4b-q4.zip',
    archiveFormat: 'zip',
    extractedName: 'flux2-klein-4b-q4',
    modelFileName: 'flux-2-klein-4b-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
    useDiffusionModelFlag: true,
    llmEncoderFileName: 'qwen3-4b-q4_0.gguf',
    vaeFileName: 'flux2_ae.safetensors',
  },

  {
    id: 'flux2-klein-4b-q8',
    name: 'Flux.2 Klein 4B Q8 (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 4_190_000_000,
    sizeLabel: '4.0 GB',
    downloadPath: 'flux/flux2-klein-4b-q8.zip',
    archiveFormat: 'zip',
    extractedName: 'flux2-klein-4b-q8',
    modelFileName: 'flux-2-klein-4b-Q8_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
    useDiffusionModelFlag: true,
    llmEncoderFileName: 'qwen3-4b-q4_0.gguf',
    vaeFileName: 'flux2_ae.safetensors',
  },

  {
    id: 'flux2-klein-9b-q4',
    name: 'Flux.2 Klein 9B Q4 (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 5_480_000_000,
    sizeLabel: '5.2 GB',
    downloadPath: 'flux/flux2-klein-9b-q4.zip',
    archiveFormat: 'zip',
    extractedName: 'flux2-klein-9b-q4',
    modelFileName: 'flux-2-klein-9b-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
    useDiffusionModelFlag: true,
    llmEncoderFileName: 'qwen3-8b-q4_0.gguf',
    vaeFileName: 'flux2_ae.safetensors',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Flux models — FLUX.1 smaller quantizations (single-file, drop-in)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'flux-schnell-q2k',
    name: 'Flux.1 Schnell Q2_K (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 4_110_000_000,
    sizeLabel: '3.8 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q2_k.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-schnell-q2k',
    modelFileName: 'flux1-schnell-q2_k.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
  },

  {
    id: 'flux-dev-q2k',
    name: 'Flux.1 Dev Q2_K (GGUF)',
    family: 'flux',
    sizeBytes: 4_160_000_000,
    sizeLabel: '3.9 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q2_k.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-dev-q2k',
    modelFileName: 'flux1-dev-q2_k.gguf',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'flux-schnell-q3k',
    name: 'Flux.1 Schnell Q3_K (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 5_240_000_000,
    sizeLabel: '5.0 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q3_k.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-schnell-q3k',
    modelFileName: 'flux1-schnell-q3_k.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
  },

  {
    id: 'flux-dev-q3k',
    name: 'Flux.1 Dev Q3_K (GGUF)',
    family: 'flux',
    sizeBytes: 5_290_000_000,
    sizeLabel: '5.0 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q3_k.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-dev-q3k',
    modelFileName: 'flux1-dev-q3_k.gguf',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'flux-mini-q4',
    name: 'Flux.1 Mini Q4 (GGUF, 3.2B)',
    family: 'flux',
    sizeBytes: 5_220_000_000,
    sizeLabel: '5.0 GB',
    downloadPath: 'flux/flux1-mini-q4.zip',
    archiveFormat: 'zip',
    extractedName: 'flux-mini-q4',
    modelFileName: 'FLUX.1-mini-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
    useDiffusionModelFlag: true,
    clipLFileName: 'clip_l.safetensors',
    t5xxlFileName: 't5xxl_fp16.safetensors',
    vaeFileName: 'ae.safetensors',
  },

  // ═══════════════════════════════════════════════════════════════════
  // Flux models — FLUX.1 standard quantizations
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'flux-schnell-q4',
    name: 'Flux.1 Schnell Q4 (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 7_210_000_000,
    sizeLabel: '6.9 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-schnell-q4',
    modelFileName: 'flux1-schnell-q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
  },

  {
    id: 'flux-schnell-q8',
    name: 'Flux.1 Schnell Q8 (GGUF, 4-step)',
    family: 'flux',
    sizeBytes: 13_420_000_000,
    sizeLabel: '12.8 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-q8_0.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-schnell-q8',
    modelFileName: 'flux1-schnell-q8_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
  },

  {
    id: 'flux-schnell',
    name: 'Flux Schnell (Full Precision)',
    family: 'flux',
    sizeBytes: 12_000_000_000,
    sizeLabel: '12 GB',
    downloadPath: 'flux/flux-schnell.safetensors.zip',
    archiveFormat: 'zip',
    extractedName: 'flux-schnell',
    modelFileName: 'flux-schnell.safetensors',
    defaults: { width: 1024, height: 1024, steps: 4, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: false, reference: false },
  },

  {
    id: 'flux-dev-q4',
    name: 'Flux.1 Dev Q4 (GGUF)',
    family: 'flux',
    sizeBytes: 7_260_000_000,
    sizeLabel: '6.9 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-dev-q4',
    modelFileName: 'flux1-dev-q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'flux-dev-q8',
    name: 'Flux.1 Dev Q8 (GGUF)',
    family: 'flux',
    sizeBytes: 13_420_000_000,
    sizeLabel: '12.8 GB',
    downloadPath: 'https://huggingface.co/leejet/FLUX.1-dev-gguf/resolve/main/flux1-dev-q8_0.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-dev-q8',
    modelFileName: 'flux1-dev-q8_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },

  {
    id: 'flux-fill-dev-q4',
    name: 'Flux.1 Fill Dev Q4 (GGUF, Inpaint)',
    family: 'flux',
    sizeBytes: 7_260_000_000,
    sizeLabel: '6.9 GB',
    downloadPath: 'https://huggingface.co/gpustack/FLUX.1-Fill-dev-GGUF/resolve/main/FLUX.1-Fill-dev-Q4_0.gguf',
    archiveFormat: 'none',
    extractedName: 'flux-fill-dev-q4',
    modelFileName: 'FLUX.1-Fill-dev-Q4_0.gguf',
    defaults: { width: 1024, height: 1024, steps: 20, cfgScale: 1.0, sampler: 'euler' },
    capabilities: { txt2img: true, img2img: true, reference: false },
  },
];
