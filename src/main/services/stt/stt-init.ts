// Registers transcription providers on app start (and again after provider
// key / config changes). Local whisper is always seeded; AssemblyAI and
// OpenRouter register only when their shared credential exists.

import { transcriptionEngine } from '../../../transcription-engine';
import type { SttProviderConfig } from '../../../shared/ipc/types/stt';
import { getProviderCredentials, getSttProviders, saveSttProviders } from '../settings';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('SttInit');

const BUILTIN_LOCAL_WHISPER: SttProviderConfig = {
  id: 'local-whisper',
  name: 'Local Whisper',
  type: 'local-whisper',
  apiKey: '',
  defaultModel: 'base',
  enabled: true,
};

export async function initSttEngine(): Promise<void> {
  try {
    const { providers, activeProvider } = await getSttProviders();
    const credentials = await getProviderCredentials();

    let configs = providers;
    if (!configs.some((p) => p.type === 'local-whisper')) {
      configs = [BUILTIN_LOCAL_WHISPER, ...configs];
    }
    if (!configs.some((p) => p.type === 'assemblyai')) {
      configs = [
        ...configs,
        { id: 'assemblyai', name: 'AssemblyAI', type: 'assemblyai', apiKey: '', defaultModel: 'universal', enabled: true },
      ];
    }
    if (!configs.some((p) => p.type === 'openrouter')) {
      configs = [
        ...configs,
        { id: 'openrouter', name: 'OpenRouter', type: 'openrouter', apiKey: '', defaultModel: 'openai/whisper-large-v3-turbo', enabled: true },
      ];
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
        const sharedKey =
          config.type === 'assemblyai' ? credentials.assemblyai :
          config.type === 'openrouter' ? credentials.openrouter :
          undefined;
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
