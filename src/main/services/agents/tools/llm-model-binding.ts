// Model binding for a `generate_text` node (flows plan decision 12, §0.1 item
// 10): `required` fixes the provider and refuses when it is unavailable;
// `preferred` falls back to the app default and says so in the run log;
// `default` always uses the app default. The W1 catalog informs the picker;
// resolution here only asks whether the PROVIDER is usable — a model id the
// catalog does not know is the "Custom…" escape hatch and passes through.

import type { FlowModelMode } from '../../../../shared/types/flows';
import { filterUsableLlmProviders } from '../../../../shared/services/llm-provider-filter';
import { getLlmProviders } from '../../settings';

export interface LlmModelBinding {
  providerId?: string;
  model?: string;
  modelMode?: FlowModelMode;
}

export type LlmModelResolution =
  | { ok: true; providerId?: string; model?: string; note?: string }
  | { ok: false; error: string };

export interface LlmModelBindingDeps {
  usableProviderIds(): Promise<string[]>;
}

const defaultDeps: LlmModelBindingDeps = {
  async usableProviderIds() {
    const { providers } = await getLlmProviders();
    return filterUsableLlmProviders(providers).map((p) => p.id);
  },
};

export async function resolveLlmModelBinding(
  binding: LlmModelBinding,
  deps: LlmModelBindingDeps = defaultDeps,
): Promise<LlmModelResolution> {
  const mode = binding.modelMode ?? 'default';
  const providerId = binding.providerId?.trim() || undefined;
  const model = binding.model?.trim() || undefined;
  if (mode === 'default' || !providerId) {
    if (mode === 'required') {
      return { ok: false, error: 'This step requires a fixed model but none is chosen — pick a provider and model in the inspector, or set the model mode to Default.' };
    }
    return { ok: true };
  }

  const usable = await deps.usableProviderIds();
  if (usable.includes(providerId)) {
    return { ok: true, providerId, ...(model ? { model } : {}) };
  }
  const named = model ? `${model} on ${providerId}` : providerId;
  if (mode === 'required') {
    return {
      ok: false,
      error: `This step requires ${named}, which is not configured or is disabled — add it in AI → Providers, or set the model mode to Preferred.`,
    };
  }
  return { ok: true, note: `Preferred model ${named} is unavailable — using the app default.` };
}
