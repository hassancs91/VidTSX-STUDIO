import type { SttProviderConfig } from '../shared/ipc/types/stt';
import type { ProviderKeyId } from '../shared/providers/registry';

/**
 * A built-in transcription provider. Remote presets name the shared BYOK
 * credential that unlocks them; local whisper needs none.
 */
export interface SttProviderPreset extends SttProviderConfig {
  credentialId?: ProviderKeyId;
}

/** Seeded into the saved STT provider list on first run, in this order. */
export const STT_PROVIDER_PRESETS: SttProviderPreset[] = [
  {
    id: 'local-whisper',
    name: 'Local Whisper',
    type: 'local-whisper',
    apiKey: '',
    defaultModel: 'base',
    enabled: true,
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    type: 'assemblyai',
    apiKey: '',
    defaultModel: 'universal',
    enabled: true,
    credentialId: 'assemblyai',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    type: 'elevenlabs',
    apiKey: '',
    defaultModel: 'scribe_v2',
    enabled: true,
    credentialId: 'elevenlabs',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    apiKey: '',
    defaultModel: 'openai/whisper-large-v3-turbo',
    enabled: true,
    credentialId: 'openrouter',
  },
];

/** The persisted shape of a preset — `credentialId` stays out of settings. */
export function toSttProviderConfig(preset: SttProviderPreset): SttProviderConfig {
  const { id, name, type, apiKey, defaultModel, enabled } = preset;
  return { id, name, type, apiKey, defaultModel, enabled };
}
