/**
 * Which LLM provider PRESETS this version offers — one rule, read by every
 * surface that lists presets: `handleLlmProvidersGet` (the add-provider menu,
 * the Providers page rows, every model picker) and `getProviderModelCatalogs`
 * (the Model catalogs on the AI page).
 *
 * The H2 rule (V1_RELEASE_PLAN Phase H): filter PRESETS only, NEVER saved
 * provider configs — a saved config for a hidden preset keeps working
 * (grandfathered); only the row that lets a new user pick it disappears.
 *
 * History: `openai` + `gemini` hidden with H1 (no tool-translation layer yet);
 * `zai` joined 2026-08-17; `minimax` + `kimi` joined 2026-09-16 with the AI
 * Models redesign (docs/ai-models-redesign.md §3.2 — V1 ships Claude ×2 +
 * OpenRouter, the rest return after feedback). OpenRouter's own model list
 * still carries Kimi / MiniMax rows: those are OpenRouter models.
 */
export const V1_HIDDEN_PRESET_IDS: ReadonlySet<string> = new Set([
  'openai',
  'gemini',
  'zai',
  'minimax',
  'kimi',
]);

function envOn(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/**
 * H4 dev override: VITE_FF_ALL_PROVIDERS=1 restores the hidden presets. The
 * shared VITE_ prefix reaches main-process import.meta.env under electron-vite
 * (same mechanism as crash-reporting's VITE_SENTRY_DSN); a release build has
 * an empty env, so the override can never leak into an installer.
 */
export function allPresetsEnabled(): boolean {
  return envOn(import.meta.env?.VITE_FF_ALL_PROVIDERS);
}

/**
 * The `local` preset (GGUF models through node-llama-cpp) rides the AI page's
 * LLMs tab: both are dev-only until local LLMs ship, so the preset follows the
 * tab's flag. Availability of the runtime is a separate, second gate applied
 * by the handler — this one only says whether the version offers it at all.
 */
export function localPresetAllowed(): boolean {
  return envOn(import.meta.env?.VITE_FF_AI_LLM);
}

/** True when this version does not offer the preset (saved configs unaffected). */
export function isPresetHidden(presetId: string): boolean {
  if (presetId === 'local') return !localPresetAllowed();
  return !allPresetsEnabled() && V1_HIDDEN_PRESET_IDS.has(presetId);
}
