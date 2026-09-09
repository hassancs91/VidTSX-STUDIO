import { audioGenerationEngine, AUDIO_GENERATION_PRESETS } from '../../audio-engine/generation';
import { getProviderCredentials } from './settings';
import { aiUsageService } from './ai-usage';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AudioGenerationInit');

let usageInstalled = false;
let initialised = false;

/**
 * The engine's usage sink: one `audio` row per generation, priced at the
 * provider's published per-second rate × the audio length (the W2b §5 q2
 * answer — SFX $0.12/min, music $0.15/min on the API pricing page).
 * `durationMs` is the provider call's wall time, as on every other row.
 */
function installUsage(): void {
  if (usageInstalled) return;
  usageInstalled = true;
  audioGenerationEngine.setUsageLogger((usage) => {
    aiUsageService
      .appendEntry({
        timestamp: new Date().toISOString(),
        provider: usage.providerId,
        model: usage.model,
        featureSource: usage.featureSource,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        costUsd: usage.costUsd,
        durationMs: usage.elapsedMs,
        requestType: 'audio',
        ...(usage.agentId ? { agentId: usage.agentId } : {}),
      })
      .catch(() => {});
  });
}

/**
 * (Re-)register the cloud audio providers from the shared BYOK credentials.
 * Safe to call repeatedly — key saves call it so a new key takes effect at
 * once, and a removed key unregisters its provider (the video-init pattern).
 */
export async function initAudioGenerationEngine(): Promise<void> {
  installUsage();
  initialised = true;
  try {
    const credentials = await getProviderCredentials();
    for (const preset of AUDIO_GENERATION_PRESETS) {
      const apiKey = credentials[preset.credentialId];
      if (!apiKey) {
        audioGenerationEngine.unregister(preset.id);
        continue;
      }
      try {
        audioGenerationEngine.register({ ...preset, apiKey, enabled: true });
      } catch (err) {
        log.warn(`Failed to register provider "${preset.id}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    log.info('Engine initialized', {
      providerCount: audioGenerationEngine.getProviders().length,
      active: audioGenerationEngine.getActiveProvider() ?? 'none',
    });
  } catch (err) {
    log.warn('Engine initialization failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * First-use init: the engine registers lazily rather than at app start, so
 * every caller (IPC, the Studio tools, the Agents tool, the capability check)
 * goes through here. A key saved later re-inits through the key-save handler.
 */
export async function ensureAudioGenerationEngine(): Promise<void> {
  if (!initialised) await initAudioGenerationEngine();
}
