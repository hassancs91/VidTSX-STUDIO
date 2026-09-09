// Which providers can run a tool loop (agents plan §1.2 step 1, §1.8).
//
// Same rule the Studio agent applies, written once more here rather than
// imported: plan decision 6 keeps `src/main/services/studio/` untouched, and
// the Studio copy is the pattern this one follows, never a dependency it
// changes. If they ever need to differ, they can.

import { getLlmProviders } from '../settings';
import { imageEngine } from '../../../image-engine';
import { videoEngine } from '../../../video-engine';
import { audioGenerationEngine } from '../../../audio-engine/generation';
import { ensureAudioGenerationEngine } from '../audio-generation-init';
import type { ToolCapabilities } from './tools/registry';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentToolSupport');

/**
 * Typed tools ride the Agent SDK; other provider types get chat only.
 *
 * An unknown config (a fresh subscription default, say) is treated as
 * capable: the presets are predominantly `agent-sdk`, and the worst case is
 * that the model simply never sees a tool call succeed.
 */
export async function resolveToolSupport(providerId?: string): Promise<boolean> {
  try {
    const { providers, activeProvider } = await getLlmProviders();
    const id = providerId || activeProvider;
    const config = providers.find((p) => p.id === id);
    return config ? config.type === 'agent-sdk' : true;
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
    videoProvider: Boolean(videoEngine.getActiveProvider()),
    audioProvider: Boolean(audioGenerationEngine.getActiveProvider()),
  };
}
