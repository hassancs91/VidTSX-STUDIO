import type { LlmProviderPreset, ProviderConfig } from '../../engine/types';

/**
 * Preset default models that shipped before the current ones, per provider id.
 * A saved config still carrying one of these was never chosen by the user: the
 * app copied it from the preset on first save. Anything else is left alone.
 */
const LEGACY_DEFAULT_MODELS: Readonly<Record<string, readonly string[]>> = {
  'claude-subscription': ['claude-sonnet-4-6'],
  'claude-api': ['claude-sonnet-4-6'],
};

/** Move saved configs from a retired preset default to the current one. Returns true if any changed. */
export function migrateLegacyDefaultModels(
  saved: ProviderConfig[],
  presets: readonly LlmProviderPreset[],
): boolean {
  let changed = false;
  for (const config of saved) {
    const legacy = LEGACY_DEFAULT_MODELS[config.id];
    const preset = presets.find((p) => p.id === config.id);
    if (!legacy || !preset || !legacy.includes(config.defaultModel)) continue;
    if (preset.defaultModel === config.defaultModel) continue;
    config.defaultModel = preset.defaultModel;
    changed = true;
  }
  return changed;
}
