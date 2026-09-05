import { llmEngine, PROVIDER_PRESETS } from '../../engine';
import type { ProviderConfig } from '../../engine/types';
import type { ProviderCredentials } from '../../shared/providers/registry';
import { loadSettings, saveLlmProviders, getProviderCredentials } from './settings';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('LLMInit');

export async function initLLMEngine(): Promise<void> {
  try {
    const settings = await loadSettings();

    if (settings.llmProviders && settings.llmProviders.length > 0) {
      // Sync preset fields (type, baseURL) into saved configs
      // This ensures preset changes (e.g. switching provider type) propagate to existing installs
      let migrated = false;
      for (const saved of settings.llmProviders) {
        const preset = PROVIDER_PRESETS.find((p) => p.id === saved.id);
        if (preset) {
          if (saved.type !== preset.type || saved.baseURL !== preset.baseURL) {
            log.info(`Migrating provider "${saved.id}"`, { fromType: saved.type, toType: preset.type });
            saved.type = preset.type;
            saved.baseURL = preset.baseURL;
            migrated = true;
          }
        }
      }
      if (migrated) {
        await saveLlmProviders(settings.llmProviders, settings.llmActiveProvider ?? '');
      }

      const credentials = await getProviderCredentials();
      const savedIds = new Set(settings.llmProviders.map((p) => p.id));
      for (const config of settings.llmProviders) {
        try {
          // Shared-credential providers use the key from their Providers-page
          // row when the per-provider key is empty. Those rows have no enable
          // toggle, so a saved `enabled: false` is an artifact of the
          // wholesale provider save, not a user choice — the shared key
          // existing IS the enablement (Phase C rule, generic since Stage 1
          // of the video-providers plan; it used to apply to OpenRouter only).
          let effective = config;
          const sharedKey = sharedCredentialFor(config.id, credentials);
          if (sharedKey && !config.apiKey) {
            effective = { ...config, apiKey: sharedKey, enabled: true };
          }
          llmEngine.register(effective);
        } catch (err) {
          log.warn(`Failed to register provider "${config.id}"`, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Presets that work without a saved config (unless the user has saved a
      // config for them, which then wins — including a disable): local is
      // keyless; shared-credential presets activate once their key exists.
      for (const preset of PROVIDER_PRESETS) {
        if (savedIds.has(preset.id)) continue;
        try {
          const sharedKey = preset.credentialId ? credentials[preset.credentialId] : undefined;
          if (preset.id === 'local') {
            llmEngine.register({ ...preset, enabled: true });
          } else if (sharedKey) {
            llmEngine.register({ ...preset, apiKey: sharedKey, enabled: true });
          }
        } catch (err) {
          log.warn(`Failed to register preset provider "${preset.id}"`, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    } else {
      // No saved configs — register defaults
      const defaultConfigs = buildDefaultConfigs();
      for (const config of defaultConfigs) {
        try {
          llmEngine.register(config);
        } catch (err) {
          log.warn(`Failed to register default provider "${config.id}"`, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // Restore last active provider
    if (settings.llmActiveProvider) {
      try {
        llmEngine.switchProvider(settings.llmActiveProvider);
      } catch {
        // Provider not registered — engine keeps its own default
      }
    }

    const providers = llmEngine.getProviders();
    const active = llmEngine.getActiveProvider();
    log.info('Engine initialized', { providerCount: providers.length, active: active ?? 'none' });
  } catch (err) {
    log.warn('Engine initialization failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
  }
}

/** The shared BYOK key a saved config's preset names, if any. */
function sharedCredentialFor(id: string, credentials: ProviderCredentials): string | undefined {
  const preset = PROVIDER_PRESETS.find((p) => p.id === id);
  return preset?.credentialId ? credentials[preset.credentialId] : undefined;
}

function buildDefaultConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  for (const preset of PROVIDER_PRESETS) {
    if (preset.id === 'claude-subscription' || preset.id === 'local') {
      // Keyless providers are always enabled
      configs.push({ ...preset, enabled: true });
    }
    // Skip api-key providers when no key is configured
    // Users will configure these later via settings UI
  }

  return configs;
}
