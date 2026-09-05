import type { LlmProviderConfig } from '../ipc/types';
import { PROVIDER_PRESETS } from '../../engine/presets';

/** BYOK providers whose key is a shared credential held by the main process
 *  (every LLM preset with a `credentialId`). llmProvidersGet never sends that
 *  credential to the renderer — it reports them `enabled: true` exactly when
 *  the credential exists, so for these ids `enabled` already means
 *  "configured". */
const SHARED_CREDENTIAL_IDS = new Set(
  PROVIDER_PRESETS.filter((p) => p.credentialId).map((p) => p.id),
);

/**
 * The one definition of "a provider the user can actually generate with",
 * shared by every provider dropdown in the app (Creator, AI chat, thumbnail
 * tester, Studio inspector, Flow nodes):
 *  - enabled in AI > Providers;
 *  - configured: subscription providers are always ready, api-key providers
 *    need a key (or a shared credential the handler vouched for);
 *  - not the Local Models provider — hidden until local LLMs ship for real.
 */
export function filterUsableLlmProviders(providers: LlmProviderConfig[]): LlmProviderConfig[] {
  return providers.filter((p) => {
    if (!p.enabled) return false;
    if (p.type === 'local') return false;
    if (p.authMode === 'subscription') return true;
    if (SHARED_CREDENTIAL_IDS.has(p.id)) return true;
    return Boolean(p.apiKey);
  });
}
