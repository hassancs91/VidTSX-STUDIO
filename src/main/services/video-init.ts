import { videoEngine, VIDEO_PROVIDER_PRESETS } from '../../video-engine';
import { installVideoContentSafetyGuard } from './content-safety/install';
import { getProviderCredentials } from './settings';
import { aiUsageService } from './ai-usage';
import { saveVideoFromUrl, videoEntryFilePath } from './video-studio-save';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('VideoInit');

/**
 * The engine's finishing step and usage sink. The store is the same Video
 * Studio save path the IPC uses (download → sampled-frame Gate B → SQLite),
 * so a completed job only ever surfaces as a gated local entry.
 */
function installFinishing(): void {
  videoEngine.setClipStore({
    store: async (input) => {
      const entry = await saveVideoFromUrl({
        url: input.url,
        prompt: input.prompt,
        model: input.model,
        aspectRatio: input.aspectRatio,
        durationSeconds: input.durationSeconds,
        hasAudio: input.hasAudio,
        folderId: input.folderId ?? null,
        signal: input.signal,
      });
      return { entry, filePath: videoEntryFilePath(entry) };
    },
  });
  videoEngine.setUsageLogger((usage) => {
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
        durationMs: usage.durationMs,
        requestType: 'video',
      })
      .catch(() => {});
  });
}

/**
 * (Re-)register cloud video providers from the shared BYOK credentials. Safe
 * to call repeatedly — key saves call it so a new key takes effect at once,
 * and a removed key unregisters its provider.
 */
export async function initVideoEngine(): Promise<void> {
  installVideoContentSafetyGuard();
  installFinishing();
  try {
    const credentials = await getProviderCredentials();
    for (const preset of VIDEO_PROVIDER_PRESETS) {
      const apiKey = credentials[preset.credentialId];
      if (!apiKey) {
        videoEngine.unregister(preset.id);
        continue;
      }
      try {
        videoEngine.register({ ...preset, apiKey, enabled: true });
      } catch (err) {
        log.warn(`Failed to register provider "${preset.id}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const providers = videoEngine.getProviders();
    log.info('Engine initialized', {
      providerCount: providers.length,
      active: videoEngine.getActiveProvider() ?? 'none',
    });
  } catch (err) {
    log.warn('Engine initialization failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
