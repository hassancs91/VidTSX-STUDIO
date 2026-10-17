// Dev-entry helpers (builder-spike.ts). `enginesProbe` is free: it reports
// which engine every provider this profile knows would get, and why.
// `registerProviderFromEnv` lets a throwaway profile with no saved keys test a
// BYOK preset: the key comes from `<ID>_API_KEY` in the app's environment and
// lives in the engine for this app run only — never saved, never logged.

import { getLlmProviders } from '../settings';
import { llmEngine, PROVIDER_PRESETS } from '../../../engine';
import { chooseTsxEngine } from './generate-tsx';

export async function enginesProbe(): Promise<Record<string, unknown>> {
  const { providers, activeProvider } = await getLlmProviders();
  const registered = llmEngine.getProviders();
  const ids = [...new Set([...providers.map((p) => p.id), ...PROVIDER_PRESETS.map((p) => p.id), ...registered])];
  const rows = [];
  for (const id of ids) {
    const saved = providers.find((p) => p.id === id);
    rows.push({
      id,
      type: saved?.type ?? PROVIDER_PRESETS.find((p) => p.id === id)?.type ?? 'unknown',
      saved: Boolean(saved),
      registered: registered.includes(id),
      ...(await chooseTsxEngine({ providerId: id })),
    });
  }
  return {
    mode: 'engines',
    activeSaved: activeProvider ?? null,
    activeEngine: llmEngine.getActiveProvider(),
    noProviderId: await chooseTsxEngine({}),
    providers: rows,
  };
}

/** True when it registered the preset; false when it was already there or no key is set. */
export function registerProviderFromEnv(providerId: string): boolean {
  if (llmEngine.getProviders().includes(providerId)) return false;
  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
  const apiKey = process.env[`${providerId.toUpperCase()}_API_KEY`]?.trim();
  if (!preset || preset.authMode !== 'api-key' || !apiKey) return false;
  const { credentialId: _credentialId, ...config } = preset;
  llmEngine.register({ ...config, apiKey, enabled: true });
  return true;
}
