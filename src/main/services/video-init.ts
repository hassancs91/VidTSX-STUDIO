import { videoEngine, VIDEO_PROVIDER_PRESETS } from '../../video-engine';
import type { VideoRegisterOptions } from '../../video-engine';
import { FalStorageClient } from '../../shared/providers/fal';
import { installVideoContentSafetyGuard } from './content-safety/install';
import { getProviderCredentials } from './settings';
import { getProviderVideoModels } from './provider-models';
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
        // BytePlus bills video by tokens and reports them on the finished
        // task; fal reports none, so the row stays at 0 there.
        outputTokens: usage.outputTokens ?? 0,
        cacheReadInputTokens: 0,
        costUsd: usage.costUsd,
        durationMs: usage.durationMs,
        requestType: 'video',
        ...(usage.agentId ? { agentId: usage.agentId } : {}),
      })
      .catch(() => {});
  });
}

/**
 * (Re-)register cloud video providers from the shared BYOK credentials. Safe
 * to call repeatedly — key saves call it so a new key takes effect at once,
 * and a removed key unregisters its provider. Model lists come from the
 * editable provider catalogs (AI page → Providers → Model Catalogs), so a
 * catalog save re-registers with the new list.
 */
export async function initVideoEngine(): Promise<void> {
  installVideoContentSafetyGuard();
  installFinishing();
  try {
    const credentials = await getProviderCredentials();
    // ModelArk takes reference videos only as URLs, so a fal key doubles as
    // the host that makes them usable there (plan §2.2). Without one, the
    // BytePlus models report zero reference videos and the input is hidden.
    const falKey = credentials.fal;
    const options: VideoRegisterOptions = falKey
      ? { mediaUploader: new FalStorageClient({ apiKey: falKey }) }
      : {};

    for (const preset of VIDEO_PROVIDER_PRESETS) {
      const apiKey = credentials[preset.credentialId];
      if (!apiKey) {
        videoEngine.unregister(preset.id);
        continue;
      }
      try {
        videoEngine.register(
          { ...preset, apiKey, enabled: true, models: await getProviderVideoModels(preset.id) },
          options,
        );
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
