import type { LlmModelCatalogEntry } from '../presets/llm-models';
import { LLM_TIER_LABELS } from '../presets/llm-models';

/** The select value that switches the picker into free-text mode. */
export const CUSTOM_MODEL_OPTION = '__custom__';

export interface LlmModelOption {
  value: string;
  label: string;
}

/**
 * Options for a model select: the provider default first (value ''), the
 * catalog entries, then "Custom…". A selected id that is not in the catalog
 * (typed by the user, or a catalog entry since removed) is appended as its own
 * row so the select never renders blank while the project keeps sending it —
 * the H2 stranding rule the provider select already follows.
 */
export function buildLlmModelOptions(
  models: readonly LlmModelCatalogEntry[],
  defaultModel: string | undefined,
  selected: string | undefined,
): LlmModelOption[] {
  const options: LlmModelOption[] = [
    { value: '', label: defaultModel ? `Provider default (${defaultModel})` : 'Provider default' },
    ...models.map((m) => ({
      value: m.id,
      label: m.tier ? `${m.name} · ${LLM_TIER_LABELS[m.tier]}` : m.name,
    })),
  ];
  if (selected && !models.some((m) => m.id === selected)) {
    options.push({ value: selected, label: `${selected} (custom)` });
  }
  options.push({ value: CUSTOM_MODEL_OPTION, label: 'Custom…' });
  return options;
}

/** True when the picker should show the free-text box for `selected`. */
export function isCustomLlmModel(
  models: readonly LlmModelCatalogEntry[],
  selected: string | undefined,
): boolean {
  return Boolean(selected) && !models.some((m) => m.id === selected);
}
