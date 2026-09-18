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
  // AI page — local model sub-tabs (Video moved to FEATURE_FLAGS 2026-09-16)
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
  // Home (V1 completion plan §2.6) — the default screen; ships on (§4).
  home: true,
  // Primary workflow — TSX → Image → Video
  creator: true,
  'image-studio': true,
  transcribe: true,
  // Videos — the cloud video generation tool (panel + gallery). Unhidden for
  // V1 by D1 of docs/video-providers-plan.md, once the five stages landed:
  // the engine, both providers, the panel, and this node's narrowed fields.
  // Nothing generates without the user's own key.
  'video-studio': true,
  // Flows (docs/flows-plan.md) — frozen recipes people run and agents call.
  // Moved from ENV_GATED (VITE_FF_FLOWS) to on with W8 Stage 6 (2026-09-10),
  // once all seven stages landed: the five built-ins ship in the installer
  // through `resources/flows` and declare `minAppVersion: 1.1.0`, so — like
  // `agents` below — this flag is COUPLED to an app version of at least
  // 1.1.0, or the Built-in group lists nothing. One switch covers the nav
  // entry and the editor behind it. Nothing runs without the user's own
  // providers; a flow with no LLM or agent node needs none.
  flows: true,
  'flows-editor': true,
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
  // Local video models (docs/ai-models-redesign.md §3.5, Hasan 2026-09-16): the
  // AI page Video section with a short recommended list, on the same sd-cli
  // runtime as images. Nothing downloads or runs until the user clicks.
  'ai-video-models': true,
  // Studio (AI video editor): the nav entry and the editor behind it. The
  // editor flipped on 2026-09-10 (V1 completion plan §3 step 5, "Studio
  // flip") after its testing pass on the raw-footage clips; `false` here
  // would put the Coming Soon screen back in production builds only (dev
  // builds force every plain flag on). Plan: docs/studio/PLAN.md.
  studio: true,
  'studio-editor': true,
  // Text-based editing (docs/NEXT_FEATURES_DESIGN.md Q5a, build-order row 8): the
  // Transcript tab of the editor's left pane — click a word to seek, select words
  // and delete them, restore deleted text. A dev-preview: on in dev builds, hidden
  // in production until it has had its testing pass on real footage.
  'studio-text-edit': false,
  // Agents (docs/agents-plan.md) — installable declarative agents on their own
  // page. Unhidden for 1.1.0 once all seven stages landed (§9 "Stage 6
  // outcome"): two built-in agents ship in the installer, and this flag is
  // COUPLED to the version bump that went with it — both built-ins declare
  // `minAppVersion: 1.1.0`, and a manifest is validated against the running app
  // version, so shipping this flag on an app below 1.1.0 would show an empty
  // gallery. Nothing runs without the user's own provider.
  agents: true,
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
