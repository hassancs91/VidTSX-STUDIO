/**
 * The built-in hosted decision providers (DECISION_MODELS_DESIGN.md §4 `presets.ts`, §5.1; E-e). Main registers each preset whose
 * `credentials[preset.credentialId]` exists, the `image-init.ts` way (part (c)). No key lives here. More providers later are new presets.
 */
import type { DecisionProviderPreset } from './types';

export const DECISION_PROVIDER_PRESETS: readonly DecisionProviderPreset[] = [
  {
    id: 'jev',
    name: 'Jev (TypeSafe)',
    type: 'system-one',
    baseURL: 'https://api.typesafe.ai/v1/systemone',
    // Pinned, never `jev-latest`: calibration is earned per model (§15.1).
    model: 'jev-1.14.0',
    credentialId: 'typesafe',
    usdPerMInputTokens: 0.042,
  },
  {
    id: 'openrouter-decisions',
    name: 'Microsoft-Decision-1 (OpenRouter)',
    type: 'system-one',
    baseURL: 'https://openrouter.ai/api/alpha/decisions',
    model: 'microsoft/microsoft-decision-1',
    credentialId: 'openrouter',
    usdPerMInputTokens: 0.042,
  },
];
