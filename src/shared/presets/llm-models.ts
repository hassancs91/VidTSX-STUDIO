/**
 * LLM model catalog per provider PRESET (`src/engine/presets.ts` ids) — the
 * seed list every "pick a model" surface reads: the Studio agent's planning
 * and shot slots, Agents sessions, the TSX panel, and the Model Catalogs card
 * on the AI page (where the user edits it; overrides persist as
 * `providerModels[<preset>].llm`, the image/video shape).
 *
 * Every id below was VERIFIED with a real call by the session that landed it
 * (docs/v1-completion-plan.md, W1 outcome) — a stale id is worse than a short
 * list. Presets whose key was unavailable for verification carry only the
 * preset's own `defaultModel`, which the app already runs on.
 *
 * User edits are sanitised to `{ id, name }`, so `tier`, `supportsThinking`
 * and `note` are read from THIS file by id at use time (see
 * `findDefaultLlmModel`) — the same rule as image prices.
 */

export type LlmModelTier = 'fast' | 'balanced' | 'deep';

export interface LlmModelCatalogEntry {
  id: string;
  name: string;
  /** Speed/depth hint for pickers. */
  tier?: LlmModelTier;
  /**
   * Whether the thinking dial applies. `false` hides the dial; absent means
   * unknown (the dial stays, and the engine drops unsupported fields).
   */
  supportsThinking?: boolean;
  note?: string;
}

// Fable 5.1 / Opus 5.5 / Sonnet 5.5 need the SDK's bundled Claude Code ≥ 2.1.280
// (older builds answer "does not support this model"); the SDK was bumped to
// 0.3.286 (Claude Code 2.1.286) on 2026-10-01 for them. ALL EIGHT ids below
// answered a real turn on the subscription route through that SDK the same day
// (`.vidtsx-temp/sdk-model-check.mjs`, `apiKeySource: none`); the five older
// ids were first verified 2026-09-09 on 0.2.119. The Agent SDK ignores a
// system-installed `claude`, so `claude update` alone never fixes a "does not
// support this model" error; the dependency has to move.
const CLAUDE_MODELS: readonly LlmModelCatalogEntry[] = [
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', tier: 'deep', supportsThinking: true },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', tier: 'deep', supportsThinking: true },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', tier: 'balanced', supportsThinking: true },
  { id: 'claude-opus-5', name: 'Claude Opus 5', tier: 'deep', supportsThinking: true },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', tier: 'balanced', supportsThinking: true },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', tier: 'deep', supportsThinking: true },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tier: 'balanced', supportsThinking: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'fast', supportsThinking: false },
];

/**
 * preset id → shipped entries. Order is display order.
 *
 * Thinking flags: the engine only sends thinking/effort to Claude ids
 * (claude-capabilities.ts), so every other id is `supportsThinking: false`
 * and the dial hides — the model still reasons on its own if it wants to.
 */
export const LLM_MODEL_CATALOG: Record<string, readonly LlmModelCatalogEntry[]> = {
  'claude-subscription': CLAUDE_MODELS,
  'claude-api': CLAUDE_MODELS,
  // Verified 2026-09-09 against api.minimax.io/anthropic.
  minimax: [
    { id: 'MiniMax-M3', name: 'MiniMax M3', tier: 'deep', supportsThinking: false },
    { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', tier: 'balanced', supportsThinking: false },
    { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', tier: 'fast', supportsThinking: false },
  ],
  // Verified 2026-09-09 against openrouter.ai/api (Anthropic-compatible
  // route). OpenRouter's canonical Claude ids use dots.
  openrouter: [
    { id: 'anthropic/claude-fable-5.1', name: 'Claude Fable 5.1', tier: 'deep', supportsThinking: true },
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', tier: 'deep', supportsThinking: true },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', tier: 'balanced', supportsThinking: true },
    { id: 'anthropic/claude-opus-4.8', name: 'Claude Opus 4.8', tier: 'deep', supportsThinking: true },
    { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', tier: 'balanced', supportsThinking: true },
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', tier: 'fast', supportsThinking: false },
    { id: 'openai/gpt-5.5', name: 'GPT-5.5', tier: 'deep', supportsThinking: false },
    { id: 'openai/gpt-5.4', name: 'GPT-5.4', tier: 'balanced', supportsThinking: false },
    { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', tier: 'fast', supportsThinking: false },
    { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tier: 'deep', supportsThinking: false },
    { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', tier: 'fast', supportsThinking: false },
    { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', tier: 'deep', supportsThinking: false },
    { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', tier: 'fast', supportsThinking: false },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', tier: 'balanced', supportsThinking: false },
    { id: 'moonshotai/kimi-k3', name: 'Kimi K3', tier: 'balanced', supportsThinking: false },
    { id: 'z-ai/glm-5.3', name: 'GLM 5.3', tier: 'balanced', supportsThinking: false },
    { id: 'minimax/minimax-m3', name: 'MiniMax M3', tier: 'deep', supportsThinking: false },
  ],
  // Verified 2026-09-09 against api.moonshot.ai/anthropic.
  kimi: [
    { id: 'kimi-k3', name: 'Kimi K3', tier: 'balanced', supportsThinking: false },
    { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', tier: 'balanced', supportsThinking: false },
    { id: 'kimi-k2.6', name: 'Kimi K2.6', tier: 'fast', supportsThinking: false },
  ],
  // No key was available on 2026-09-09 for the three presets below (all are
  // hidden in V1 — llm-handlers V1_HIDDEN_PRESET_IDS), so each carries only
  // the default the preset already runs on. Extend once a key can verify it.
  openai: [{ id: 'gpt-4o', name: 'GPT-4o', tier: 'balanced', supportsThinking: false }],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'fast', supportsThinking: false },
  ],
  zai: [{ id: 'glm-5.2', name: 'GLM 5.2', tier: 'balanced', supportsThinking: false }],
};

export const LLM_TIER_LABELS: Record<LlmModelTier, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  deep: 'Deep',
};

export function getDefaultLlmModels(providerId: string): LlmModelCatalogEntry[] {
  return [...(LLM_MODEL_CATALOG[providerId] ?? [])];
}

/** The shipped entry for an id, for the fields user edits cannot carry. */
export function findDefaultLlmModel(
  providerId: string,
  modelId: string,
): LlmModelCatalogEntry | undefined {
  return LLM_MODEL_CATALOG[providerId]?.find((m) => m.id === modelId);
}

/**
 * Whether a model's thinking dial should show. Only a known `false` hides it:
 * a custom id is unknown, and the engine already drops thinking fields on
 * models that cannot take them (claude-capabilities.ts).
 */
export function llmModelSupportsThinking(providerId: string, modelId: string | undefined): boolean {
  if (!modelId) return true;
  return findDefaultLlmModel(providerId, modelId)?.supportsThinking !== false;
}

/** Short display name for a model id: the catalog name, else the id itself. */
export function llmModelDisplayName(providerId: string, modelId: string | undefined): string {
  if (!modelId) return 'Default';
  return findDefaultLlmModel(providerId, modelId)?.name ?? modelId;
}
