import type { AudioProviderPreset } from './types';

/** Built-in cloud audio (SFX + music) providers; the shared BYOK key unlocks each one. */
export const AUDIO_GENERATION_PRESETS: AudioProviderPreset[] = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    type: 'elevenlabs',
    apiKey: '',
    enabled: false,
    credentialId: 'elevenlabs',
  },
];
