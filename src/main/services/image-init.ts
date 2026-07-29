import { imageEngine } from '../../image-engine';
import { LocalSdImageProvider } from '../../image-engine/providers/local-sd-provider';
import { loadSettings, getProviderCredentials } from './settings';
import { applySdGenerationPreflight } from './sdimage-preflight';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ImageInit');

/** Stable id of the on-device sd-cli provider. */
export const LOCAL_IMAGE_PROVIDER_ID = 'local';

/**
 * (Re-)register the local sd-cli bridge with the cloud image engine. Safe to
 * call repeatedly — settings saves rebuild the provider registry, so this runs
 * again after each rebuild. Registered even when sd-cli/models are missing:
 * the provider then reports zero models and the UI hides it.
 */
export function registerLocalImageProvider(): void {
  if (imageEngine.getProviders().includes(LOCAL_IMAGE_PROVIDER_ID)) return;
  imageEngine.registerInstance(
    new LocalSdImageProvider(LOCAL_IMAGE_PROVIDER_ID, {
      prepare: async (request) => (await applySdGenerationPreflight(request)).request,
    }),
  );
}

export async function initImageEngine(): Promise<void> {
  try {
    const settings = await loadSettings();
    const credentials = await getProviderCredentials();

    if (settings.imageProviders && settings.imageProviders.length > 0) {
      for (const config of settings.imageProviders) {
        try {
          // Shared BYOK credential wins; per-provider key is a legacy fallback.
          const sharedKey =
            config.type === 'fal' ? credentials.fal :
            config.type === 'openrouter' ? credentials.openrouter :
            undefined;
          imageEngine.register({ ...config, apiKey: sharedKey || config.apiKey });
        } catch (err) {
          log.warn(`Failed to register provider "${config.id}"`, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    // Cloud providers require an API key; the local sd-cli bridge does not and
    // is always registered (after the cloud ones, so it never steals "active"
    // from a configured cloud provider).
    registerLocalImageProvider();

    // Restore last active provider
    if (settings.imageActiveProvider) {
      try {
        imageEngine.switchProvider(settings.imageActiveProvider);
      } catch {
        // Provider not registered — engine keeps its own default
      }
    }

    const providers = imageEngine.getProviders();
    const active = imageEngine.getActiveProvider();
    log.info('Engine initialized', { providerCount: providers.length, active: active ?? 'none' });
  } catch (err) {
    log.warn('Engine initialization failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
  }
}
