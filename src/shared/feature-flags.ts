// Feature visibility for the renderer. Two kinds of flags:
//
// 1. ENV_GATED — hidden in EVERY build (dev included) unless the matching
//    VITE_FF_* variable is set to 1/true in `.env` (see `.env.example`).
//    Vite bakes these values into the renderer bundle at build time, so
//    release builds must be produced with none of them set.
// 2. FEATURE_FLAGS — plain booleans. `false` entries are dev-previews:
//    force-enabled in dev builds, hidden in production.

const ENV_GATED: Record<string, string | boolean | undefined> = {
  tools: import.meta.env.VITE_FF_TOOLS,
  // One switch covers the Flows nav entry and the editor behind it.
  flows: import.meta.env.VITE_FF_FLOWS,
  'flows-editor': import.meta.env.VITE_FF_FLOWS,
  'video-studio': import.meta.env.VITE_FF_VIDEO_STUDIO,
  // 3D Studio (image → 3D on the AI runtime) — dev-visible via VITE_FF_THREED_STUDIO until Stage 5
  'threed-studio': import.meta.env.VITE_FF_THREED_STUDIO,
  // AI page — local model sub-tabs
  'ai-video-models': import.meta.env.VITE_FF_AI_VIDEO,
  'ai-llm-models': import.meta.env.VITE_FF_AI_LLM,
  'ai-3d-models': import.meta.env.VITE_FF_AI_3D,
  'ai-embedding-models': import.meta.env.VITE_FF_AI_EMBEDDINGS,
  // Sherpa voice-engine section inside the Audio tab
  'audio-engine': import.meta.env.VITE_FF_AI_AUDIO_ENGINE,
  // AI page — System tab rows for runtimes no feature consumes yet
  // (Python panel, PyTorch Runtime row, Embedding Engine card).
  'ai-system-runtimes': import.meta.env.VITE_FF_AI_SYSTEM_RUNTIMES,
  // Custom OpenAI/Anthropic-compatible endpoint form (Phase H5): flagged off
  // so V1 ships exactly one engine path (agent-sdk). The form itself is
  // untouched — only its entry point is gated. Returns un-flagged in V2.
  'custom-provider': import.meta.env.VITE_FF_CUSTOM_PROVIDER,
};

const FEATURE_FLAGS: Record<string, boolean> = {
  // Primary workflow — TSX → Image → Video
  creator: true,
  'image-studio': true,
  transcribe: true,
  // Secondary (visible in production)
  assets: true,
  render: true,
  // Local AI model management screen — also hosts AI provider config and
  // whisper.cpp install (moved here when the Settings screen was retired),
  // so it must stay visible in production.
  'ai-models': true,
  // Studio (AI video editor) nav entry is visible as a teaser; the editor
  // itself is in development — production renders a Coming Soon screen.
  // Plan: docs/studio/PLAN.md.
  studio: true,
  'studio-editor': false,
  // License UI kept dormant — the app is free (BYOK). The license shell stays
  // compiled for possible future reuse; flip this to resurface the section.
  'license-ui': false,
};

export function isFeatureEnabled(id: string): boolean {
  if (id in ENV_GATED) {
    const value = ENV_GATED[id];
    return value === true || value === '1' || value === 'true';
  }
  const flag = FEATURE_FLAGS[id];
  if (flag === undefined) return false;
  return import.meta.env.DEV ? true : flag;
}
