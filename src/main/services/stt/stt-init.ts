// Registers transcription providers on app start (and again after provider
// key / config changes). Local whisper is always seeded; AssemblyAI,
// ElevenLabs, and OpenRouter register only when their shared credential
// exists.

import {
  transcriptionEngine,
  STT_PROVIDER_PRESETS,
  toSttProviderConfig,
} from '../../../transcription-engine';
import { getProviderCredentials, getSttProviders, saveSttProviders } from '../settings';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('SttInit');

export async function initSttEngine(): Promise<void> {
  try {
    const { providers, activeProvider } = await getSttProviders();
    const credentials = await getProviderCredentials();

    // Seed any preset the saved list lacks (matched by type): local whisper
    // goes first, remote providers append in preset order.
    let configs = providers;
    for (const preset of STT_PROVIDER_PRESETS) {
      if (configs.some((p) => p.type === preset.type)) continue;
      const config = toSttProviderConfig(preset);
      configs = preset.type === 'local-whisper' ? [config, ...configs] : [...configs, config];
    }
    if (configs !== providers) {
      await saveSttProviders(configs, activeProvider);
    }

    // Drop previously-registered remote providers whose key was removed.
    for (const id of transcriptionEngine.getProviders()) {
      transcriptionEngine.unregister(id);
    }

    for (const config of configs) {
      try {
        // Saved configs predate `credentialId`, so resolve it from the preset
        // of the same type.
        const preset = STT_PROVIDER_PRESETS.find((p) => p.type === config.type);
        const sharedKey = preset?.credentialId ? credentials[preset.credentialId] : undefined;
        const effective = { ...config, apiKey: sharedKey || config.apiKey };
        if (config.type !== 'local-whisper' && !effective.apiKey) {
          continue; // no key yet — provider stays unregistered until one is saved
        }
        transcriptionEngine.register(effective);
      } catch (err) {
        log.warn(`Failed to register provider "${config.id}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log.info('Engine initialized', { providers: transcriptionEngine.getProviders() });
  } catch (err) {
    log.warn('Engine initialization failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
