import { videoEngine, VIDEO_PROVIDER_PRESETS } from '../../video-engine';
import type { VideoRegisterOptions } from '../../video-engine';
import { LocalSdVideoProvider } from '../../video-engine/providers/local-sd-video-provider';
import { videoLocalEngine } from '../../local-video-engine/video-engine';
import { FalStorageClient } from '../../shared/providers/fal';
import { installVideoContentSafetyGuard } from './content-safety/install';
import { getProviderCredentials } from './settings';
import { getProviderVideoModels } from './provider-models';
import { aiUsageService } from './ai-usage';
import { saveVideoFromUrl, videoEntryFilePath } from './video-studio-save';
import { ensureSdVideoEngine } from './sdvideo-init';
import { applySdVideoPreflight } from './sdvideo-preflight';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('VideoInit');

/** Stable id of the on-device sd-cli video provider (the image engine's `local` twin). */
export const LOCAL_VIDEO_PROVIDER_ID = 'local';
/** How the pickers name it — the same label Image Studio uses for its local provider. */
export const LOCAL_VIDEO_PROVIDER_NAME = 'Local (open source)';

/**
 * (Re-)register the on-device sd-cli bridge (Wan / LTX / LingBot) with the
 * cloud video engine — docs/ai-models-redesign.md §3.5, D3: local video is a
 * provider, so the Videos screen, the Studio agent, the Agents tool and the
 * Flows node reach it like any other. Registered after the cloud providers so
 * it never steals the active slot; it reads the video library live, so a
 * rescan needs no re-registration, and it reports zero models (and is hidden)
 * until sd-cli and one ready model exist. The models-folder scan stays lazy:
 * `ensure` runs it on the first listing, never at startup.
 */
export function registerLocalVideoProvider(): void {
  installVideoContentSafetyGuard();
  if (videoEngine.getProviders().includes(LOCAL_VIDEO_PROVIDER_ID)) return;
  videoEngine.registerInstance(
    new LocalSdVideoProvider(LOCAL_VIDEO_PROVIDER_ID, videoLocalEngine, {
      prepare: applySdVideoPreflight,
      ensure: ensureSdVideoEngine,
    }),
  );
}

/**
 * Providers that can take a job right now: every registered provider with at
 * least one model — the cloud ones with a key, local once a model is ready.
 */
export function usableVideoProviderIds(): string[] {
  return videoEngine.getProviders().filter((id) => videoEngine.getModels(id).length > 0);
}

/**
 * Before any listing or submit: the cloud providers from the saved keys (a
 * key entered since startup, a first call racing the re-init) and the local
 * provider's lazy library scan, so the first answer is the right one.
 */
export async function ensureVideoProvidersReady(): Promise<void> {
  if (videoEngine.getProviders().length === 0) await initVideoEngine();
  await ensureSdVideoEngine().catch((err: unknown) => {
    log.warn('Local video engine init failed (local provider stays empty)', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/** Agent tool gating: true when some provider can take a video job now. */
export async function hasUsableVideoProvider(): Promise<boolean> {
  await ensureVideoProvidersReady();
  return usableVideoProviderIds().length > 0;
}

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
    // Cloud providers need a key; the local bridge does not and is always
    // registered, after them, so a configured cloud provider stays active.
    registerLocalVideoProvider();
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
