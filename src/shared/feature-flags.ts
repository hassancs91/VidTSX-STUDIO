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
  // AI page — local model sub-tabs
  'ai-video-models': import.meta.env.VITE_FF_AI_VIDEO,
  'ai-llm-models': import.meta.env.VITE_FF_AI_LLM,
  'ai-embedding-models': import.meta.env.VITE_FF_AI_EMBEDDINGS,
  // Sherpa voice-engine section inside the Audio tab
  'audio-engine': import.meta.env.VITE_FF_AI_AUDIO_ENGINE,
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
  // Videos — the cloud video generation tool (panel + gallery). Unhidden for
  // V1 by D1 of docs/video-providers-plan.md, once the five stages landed:
  // the engine, both providers, the panel, and this node's narrowed fields.
  // Flows stays env-gated. Nothing generates without the user's own key.
  'video-studio': true,
  // Secondary (visible in production)
  assets: true,
  render: true,
  // Local AI model management screen — also hosts AI provider config and
  // whisper.cpp install (moved here when the Settings screen was retired),
  // so it must stay visible in production.
  'ai-models': true,
  // AI runtime (docs/ai-runtime-implementation-plan.md, Stage 5 release wiring 2026-09-05):
  // the System-tab "AI Runtime" row, the AI page 3D tab and the 3D Studio screen ship in
  // V1. All three are optional downloads behind the row; nothing loads at startup.
  'ai-system-runtimes': true,
  'ai-3d-models': true,
  'threed-studio': true,
  // Studio (AI video editor) nav entry is visible as a teaser; the editor
  // itself is in development — production renders a Coming Soon screen.
  // Plan: docs/studio/PLAN.md.
  studio: true,
  'studio-editor': false,
  // Agents (docs/agents-plan.md) — installable declarative agents on their own
  // page. Dev-preview: force-enabled in dev, hidden in production until the
  // stages after this one (interactions, the built-in Motion Post agent) land.
  agents: false,
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
