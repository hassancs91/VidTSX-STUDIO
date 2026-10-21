// Which providers can run a tool loop (agents plan §1.2 step 1, §1.8).
//
// Same rule the Studio agent applies, written once more here rather than
// imported: plan decision 6 keeps `src/main/services/studio/` untouched, and
// the Studio copy is the pattern this one follows, never a dependency it
// changes. If they ever need to differ, they can.

import { getLlmProviders } from '../settings';
import { llmEngine, PROVIDER_PRESETS } from '../../../engine';
import type { ProviderConfig } from '../../../engine/types';
import { imageEngine } from '../../../image-engine';
import { hasUsableVideoProvider } from '../video-init';
import { audioGenerationEngine } from '../../../audio-engine/generation';
import { ensureAudioGenerationEngine } from '../audio-generation-init';
import type { ToolCapabilities } from './tools/registry';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentToolSupport');

/** What the app knows about a provider id, without its key. */
export interface ResolvedProviderInfo {
  id: string;
  /** Absent when the id is neither saved nor a preset. */
  type?: ProviderConfig['type'];
  /** The login or a key; the builder's cost estimate reads it (P5 part 3). */
  authMode?: ProviderConfig['authMode'];
  baseURL?: string;
  defaultModel?: string;
}

/**
 * The provider an id names: the saved config first, else the preset of that
 * id (the engine registers some presets with no saved config: `local`, and
 * the shared-credential ones, llm-init.ts). With no id given: the saved
 * active provider, else the engine's; null when there is none at all.
 * Throws when settings cannot be read.
 */
export async function resolveProviderInfo(providerId?: string): Promise<ResolvedProviderInfo | null> {
  const { providers, activeProvider } = await getLlmProviders();
  const id = providerId || activeProvider || llmEngine.getActiveProvider();
  if (!id) return null;
  const known = providers.find((p) => p.id === id) ?? PROVIDER_PRESETS.find((p) => p.id === id);
  return {
    id,
    ...(known?.type ? { type: known.type } : {}),
    ...(known?.authMode ? { authMode: known.authMode } : {}),
    ...(known?.baseURL ? { baseURL: known.baseURL } : {}),
    ...(known?.defaultModel ? { defaultModel: known.defaultModel } : {}),
  };
}

/**
 * Typed tools ride the Agent SDK; other provider types get chat only.
 *
 * An id that is neither saved nor a preset is treated as capable: the presets
 * are predominantly `agent-sdk`, and the worst case is that the model simply
 * never sees a tool call succeed.
 */
export async function resolveToolSupport(providerId?: string): Promise<boolean> {
  try {
    const type = (await resolveProviderInfo(providerId))?.type;
    return type ? type === 'agent-sdk' : true;
  } catch (err) {
    log.warn('Could not read providers — assuming tools work', {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/** Which `needs:` gates are satisfied right now (§1.8). Async because the
 *  audio engine registers on first use (W2b) rather than at app start. */
export async function resolveToolCapabilities(): Promise<ToolCapabilities> {
  await ensureAudioGenerationEngine();
  return {
    imageProvider: Boolean(imageEngine.getActiveProvider()),
    // Cloud keys or a ready local model — a registered provider with no models
    // (local before a download) does not count.
    videoProvider: await hasUsableVideoProvider(),
    audioProvider: Boolean(audioGenerationEngine.getActiveProvider()),
    // W8 Stage 4: `run_agent` needs a tool-capable LLM provider (the active one).
    agentProvider: await resolveToolSupport(),
  };
}
