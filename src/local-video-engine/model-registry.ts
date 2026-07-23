import type { ModelProfileEnvelope } from '@shared/model-library/types';
import type { VideoCompanionRequirement, VideoModelMeta } from './types';

/**
 * Curated catalog of local video model profiles (Wan via stable-diffusion.cpp).
 * Same rules as the image catalog: metadata + links, `downloadUrl` only for
 * stable, public, unauthenticated hosts (D1). All filenames, sizes, and URLs
 * below were verified against the HuggingFace API on 2026-07-16 (HTTP 200 +
 * exact Content-Length).
 *
 * Coverage: everything single-file that stable-diffusion.cpp's vid_gen mode
 * supports (docs/wan.md, docs/ltx2.md, docs/lingbot_video.md in the sd.cpp
 * repo) — Wan 2.1 T2V 1.3B/14B, Wan 2.1 I2V 14B, Wan 2.2 TI2V 5B,
 * LingBot-Video Dense 1.3B, and LTX-2.3 22B (dev + distilled). The fit badges
 * (VRAM preflight) warn when a model is too big for the detected GPU.
 * Wan 2.2 A14B T2V/I2V are NOT listed: they are two-file MoE models
 * (--high-noise-diffusion-model + low-noise) and need multi-file profile
 * support first. There is no smaller LTX: sd.cpp does not support the old
 * LTX-Video 0.9.x 2B — LTX-2.3 22B is the only LTX architecture it runs, so
 * the distilled Q3_K_S below is the smallest/fastest LTX possible.
 */
export type VideoModelProfile = ModelProfileEnvelope<VideoModelMeta>;

// ─── Wan 2.1 companions ─────────────────────────────────────────────────
// sd-cli invokes Wan with --diffusion-model <gguf> --t5xxl <umt5> --vae <vae>.
// Companions are shared: one umt5 encoder + one VAE serve every Wan model in
// the folder (same free-sharing rule as Flux text encoders).

const WAN21_T5XXL: VideoCompanionRequirement = {
  kind: 't5xxl',
  fileNames: [
    'umt5-xxl-encoder-Q3_K_S.gguf',
    'umt5-xxl-encoder-Q4_K_M.gguf',
    'umt5-xxl-encoder-Q4_K_S.gguf',
    'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
  ],
  sourceUrl: 'https://huggingface.co/city96/umt5-xxl-encoder-gguf',
  sizeLabel: '2.9 GB (Q3_K_S)',
  downloadUrl: 'https://huggingface.co/city96/umt5-xxl-encoder-gguf/resolve/main/umt5-xxl-encoder-Q3_K_S.gguf',
  sizeBytes: 2_858_489_696,
};

const WAN21_VAE: VideoCompanionRequirement = {
  kind: 'vae',
  fileNames: ['wan_2.1_vae.safetensors'],
  sourceUrl: 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged',
  sizeLabel: '254 MB',
  downloadUrl:
    'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors',
  sizeBytes: 253_815_318,
};

export const WAN21_COMPANIONS: VideoCompanionRequirement[] = [WAN21_T5XXL, WAN21_VAE];

// Wan 2.1 I2V additionally needs the CLIP vision encoder for the input image.
const WAN21_CLIP_VISION: VideoCompanionRequirement = {
  kind: 'clip_vision',
  fileNames: ['clip_vision_h.safetensors'],
  sourceUrl: 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged',
  sizeLabel: '1.3 GB',
  downloadUrl:
    'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors',
  sizeBytes: 1_264_219_396,
};

export const WAN21_I2V_COMPANIONS: VideoCompanionRequirement[] = [
  WAN21_T5XXL,
  WAN21_VAE,
  WAN21_CLIP_VISION,
];

// Wan 2.2 TI2V 5B uses its own VAE (every other Wan model uses the 2.1 VAE).
const WAN22_VAE: VideoCompanionRequirement = {
  kind: 'vae',
  fileNames: ['wan2.2_vae.safetensors'],
  sourceUrl: 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged',
  sizeLabel: '1.4 GB',
  downloadUrl:
    'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors',
  sizeBytes: 1_409_400_960,
};

export const WAN22_5B_COMPANIONS: VideoCompanionRequirement[] = [WAN21_T5XXL, WAN22_VAE];

// ─── LTX-2.3 companions ─────────────────────────────────────────────────
// sd-cli invokes LTX-2.3 with --diffusion-model <gguf> --llm <gemma>
// --embeddings-connectors <connectors> --vae <video vae> --audio-vae <audio vae>.

// The gemma LLM encoder is shared by the dev and distilled LTX variants.
const LTX23_GEMMA: VideoCompanionRequirement = {
  kind: 'llm',
  fileNames: ['gemma-3-12b-it-qat-UD-Q4_K_XL.gguf', 'gemma-3-12b-it-UD-Q4_K_XL.gguf'],
  sourceUrl: 'https://huggingface.co/unsloth/gemma-3-12b-it-qat-GGUF',
  sizeLabel: '7.4 GB (Q4_K_XL)',
  downloadUrl:
    'https://huggingface.co/unsloth/gemma-3-12b-it-qat-GGUF/resolve/main/gemma-3-12b-it-qat-UD-Q4_K_XL.gguf',
  sizeBytes: 7_432_229_248,
};

export const LTX23_DEV_COMPANIONS: VideoCompanionRequirement[] = [
  LTX23_GEMMA,
  {
    kind: 'embeddings',
    fileNames: ['ltx-2.3-22b-dev_embeddings_connectors.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    sizeLabel: '2.3 GB',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/text_encoders/ltx-2.3-22b-dev_embeddings_connectors.safetensors',
    sizeBytes: 2_312_144_712,
  },
  {
    kind: 'vae',
    fileNames: ['ltx-2.3-22b-dev_video_vae.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    sizeLabel: '1.5 GB',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/vae/ltx-2.3-22b-dev_video_vae.safetensors',
    sizeBytes: 1_452_256_522,
  },
  {
    kind: 'audio_vae',
    fileNames: ['ltx-2.3-22b-dev_audio_vae.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    sizeLabel: '365 MB',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/vae/ltx-2.3-22b-dev_audio_vae.safetensors',
    sizeBytes: 364_853_140,
  },
];

// The distilled variant ships its own connectors + VAEs (same gemma encoder).
export const LTX23_DISTILLED_COMPANIONS: VideoCompanionRequirement[] = [
  LTX23_GEMMA,
  {
    kind: 'embeddings',
    fileNames: ['ltx-2.3-22b-distilled_embeddings_connectors.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    sizeLabel: '2.3 GB',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/text_encoders/ltx-2.3-22b-distilled_embeddings_connectors.safetensors',
    sizeBytes: 2_312_144_712,
  },
  {
    kind: 'vae',
    fileNames: ['ltx-2.3-22b-distilled_video_vae.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    sizeLabel: '1.5 GB',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/vae/ltx-2.3-22b-distilled_video_vae.safetensors',
    sizeBytes: 1_452_256_522,
  },
  {
    kind: 'audio_vae',
    fileNames: ['ltx-2.3-22b-distilled_audio_vae.safetensors'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    sizeLabel: '365 MB',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/vae/ltx-2.3-22b-distilled_audio_vae.safetensors',
    sizeBytes: 364_853_140,
  },
];

// ─── LingBot-Video companions ───────────────────────────────────────────
// LingBot uses the Wan 2.1 VAE + Qwen3-VL 4B as the LLM text encoder
// (sd.cpp docs/lingbot_video.md).

export const LINGBOT_COMPANIONS: VideoCompanionRequirement[] = [
  {
    kind: 'llm',
    fileNames: ['Qwen3VL-4B-Instruct-Q4_K_M.gguf', 'Qwen3-VL-4B-Instruct-Q4_K_M.gguf'],
    sourceUrl: 'https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF',
    sizeLabel: '2.5 GB (Q4_K_M)',
    downloadUrl:
      'https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3VL-4B-Instruct-Q4_K_M.gguf',
    sizeBytes: 2_497_281_664,
  },
  WAN21_VAE,
];

// ─── Catalog ────────────────────────────────────────────────────────────

const WAN21_1_3B_DEFAULTS = {
  width: 832,
  height: 480,
  frames: 33, // ~2 s @ 16 fps; Wan requires 4n+1 frames
  fps: 16,
  steps: 20,
  cfgScale: 6.0,
  sampler: 'euler',
};

export const VIDEO_MODEL_CATALOG: VideoModelProfile[] = [
  {
    id: 'wan21-t2v-1.3b-q4',
    category: 'video',
    name: 'Wan 2.1 T2V 1.3B Q4 (smallest)',
    sizeBytes: 865_581_280,
    sizeLabel: '866 MB (+3.1 GB shared companions)',
    matchFileNames: ['Wan2.1-T2V-1.3B-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/samuelchristlie/Wan2.1-T2V-1.3B-GGUF',
    downloadUrl:
      'https://huggingface.co/samuelchristlie/Wan2.1-T2V-1.3B-GGUF/resolve/main/Wan2.1-T2V-1.3B-Q4_0.gguf',
    requirements: { minVramGB: 6, minRamGB: 16 },
    meta: {
      family: 'wan21',
      defaults: WAN21_1_3B_DEFAULTS,
      capabilities: { t2v: true, i2v: false },
      useDiffusionModelFlag: true,
      companions: WAN21_COMPANIONS,
    },
  },

  {
    id: 'wan21-t2v-1.3b-q8',
    category: 'video',
    name: 'Wan 2.1 T2V 1.3B Q8 (better quality)',
    sizeBytes: 1_535_768_800,
    sizeLabel: '1.5 GB (+3.1 GB shared companions)',
    matchFileNames: ['Wan2.1-T2V-1.3B-Q8_0.gguf'],
    sourceUrl: 'https://huggingface.co/samuelchristlie/Wan2.1-T2V-1.3B-GGUF',
    downloadUrl:
      'https://huggingface.co/samuelchristlie/Wan2.1-T2V-1.3B-GGUF/resolve/main/Wan2.1-T2V-1.3B-Q8_0.gguf',
    requirements: { minVramGB: 6, minRamGB: 16 },
    meta: {
      family: 'wan21',
      defaults: WAN21_1_3B_DEFAULTS,
      capabilities: { t2v: true, i2v: false },
      useDiffusionModelFlag: true,
      companions: WAN21_COMPANIONS,
    },
  },

  {
    id: 'lingbot-dense-1.3b',
    category: 'video',
    name: 'LingBot-Video Dense 1.3B (small, t2v+i2v)',
    sizeBytes: 2_791_967_328,
    sizeLabel: '2.8 GB (+2.8 GB companions)',
    // The repo file is a generic `diffusion_pytorch_model.safetensors` — it is
    // saved under this canonical name on download (matchFileNames[0]).
    matchFileNames: ['lingbot-video-dense-1.3b.safetensors'],
    sourceUrl: 'https://huggingface.co/robbyant/lingbot-video-dense-1.3b',
    downloadUrl:
      'https://huggingface.co/robbyant/lingbot-video-dense-1.3b/resolve/main/transformer/diffusion_pytorch_model.safetensors',
    requirements: { minVramGB: 6, minRamGB: 16 },
    meta: {
      family: 'lingbot',
      // LingBot aligns to Wan-style temporal compression: 33/49/81 frames.
      defaults: { width: 832, height: 480, frames: 33, fps: 16, steps: 20, cfgScale: 3.0, sampler: 'euler' },
      capabilities: { t2v: true, i2v: true },
      useDiffusionModelFlag: true,
      companions: LINGBOT_COMPANIONS,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // Larger Wan models (14B / Wan 2.2 5B)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'wan22-ti2v-5b-q4',
    category: 'video',
    name: 'Wan 2.2 TI2V 5B Q4 (text + image to video)',
    sizeBytes: 3_029_086_560,
    sizeLabel: '3.0 GB (+4.3 GB shared companions)',
    matchFileNames: ['Wan2.2-TI2V-5B-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF',
    downloadUrl:
      'https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q4_0.gguf',
    requirements: { minVramGB: 8, minRamGB: 24 },
    meta: {
      family: 'wan22',
      // Wan 2.2 TI2V 5B is a native 720p/24fps model
      defaults: { width: 1280, height: 704, frames: 33, fps: 24, steps: 20, cfgScale: 5.0, sampler: 'euler' },
      capabilities: { t2v: true, i2v: true },
      useDiffusionModelFlag: true,
      companions: WAN22_5B_COMPANIONS,
    },
  },

  {
    id: 'wan21-t2v-14b-q4',
    category: 'video',
    name: 'Wan 2.1 T2V 14B Q4 (high quality)',
    sizeBytes: 9_030_949_504,
    sizeLabel: '9.0 GB (+3.1 GB shared companions)',
    matchFileNames: ['wan2.1-t2v-14b-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/city96/Wan2.1-T2V-14B-gguf',
    downloadUrl:
      'https://huggingface.co/city96/Wan2.1-T2V-14B-gguf/resolve/main/wan2.1-t2v-14b-Q4_0.gguf',
    requirements: { minVramGB: 12, minRamGB: 32 },
    meta: {
      family: 'wan21',
      defaults: WAN21_1_3B_DEFAULTS,
      capabilities: { t2v: true, i2v: false },
      useDiffusionModelFlag: true,
      companions: WAN21_COMPANIONS,
    },
  },

  {
    id: 'wan21-i2v-14b-480p-q4',
    category: 'video',
    name: 'Wan 2.1 I2V 14B 480p Q4 (image to video)',
    sizeBytes: 10_247_552_384,
    sizeLabel: '10.2 GB (+4.4 GB shared companions)',
    matchFileNames: ['wan2.1-i2v-14b-480p-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/city96/Wan2.1-I2V-14B-480P-gguf',
    downloadUrl:
      'https://huggingface.co/city96/Wan2.1-I2V-14B-480P-gguf/resolve/main/wan2.1-i2v-14b-480p-Q4_0.gguf',
    requirements: { minVramGB: 12, minRamGB: 32 },
    meta: {
      family: 'wan21',
      defaults: WAN21_1_3B_DEFAULTS,
      capabilities: { t2v: false, i2v: true },
      useDiffusionModelFlag: true,
      companions: WAN21_I2V_COMPANIONS,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // LTX-2.3 (Lightricks, 22B — audio + video)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'ltx23-dev-22b-q4',
    category: 'video',
    name: 'LTX-2.3 Dev 22B Q4 (720p, audio+video)',
    sizeBytes: 12_716_211_232,
    sizeLabel: '12.7 GB (+11.5 GB companions)',
    matchFileNames: ['ltx-2.3-22b-dev-Q4_0.gguf'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/ltx-2.3-22b-dev-Q4_0.gguf',
    requirements: { minVramGB: 16, minRamGB: 48 },
    meta: {
      family: 'ltx',
      defaults: { width: 1280, height: 720, frames: 33, fps: 24, steps: 20, cfgScale: 6.0, sampler: 'euler' },
      capabilities: { t2v: true, i2v: true },
      useDiffusionModelFlag: true,
      companions: LTX23_DEV_COMPANIONS,
    },
  },

  {
    id: 'ltx23-distilled-22b-q3ks',
    category: 'video',
    name: 'LTX-2.3 Distilled 22B Q3 (smallest LTX, faster)',
    sizeBytes: 9_946_936_352,
    sizeLabel: '9.9 GB (+11.5 GB companions)',
    matchFileNames: ['ltx-2.3-22b-distilled-Q3_K_S.gguf'],
    sourceUrl: 'https://huggingface.co/unsloth/LTX-2.3-GGUF',
    downloadUrl:
      'https://huggingface.co/unsloth/LTX-2.3-GGUF/resolve/main/distilled/ltx-2.3-22b-distilled-Q3_K_S.gguf',
    requirements: { minVramGB: 12, minRamGB: 40 },
    meta: {
      family: 'ltx',
      // Distilled: few-step sampling, no CFG.
      defaults: { width: 1280, height: 720, frames: 33, fps: 24, steps: 8, cfgScale: 1.0, sampler: 'euler' },
      capabilities: { t2v: true, i2v: true },
      useDiffusionModelFlag: true,
      companions: LTX23_DISTILLED_COMPANIONS,
    },
  },
];
