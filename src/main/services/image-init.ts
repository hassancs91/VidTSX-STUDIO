import { imageEngine, IMAGE_PROVIDER_PRESETS } from '../../image-engine';
import { loadSettings, getProviderCredentials } from './settings';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ImageInit');

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
    // No default registration — image providers always require an API key

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
