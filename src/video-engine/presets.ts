import { DEFAULT_VIDEO_MODEL } from '../shared/presets/video-models';
import type { VideoProviderPreset } from './types';

/** Built-in cloud video providers; the shared BYOK key unlocks each one. */
export const VIDEO_PROVIDER_PRESETS: VideoProviderPreset[] = [
  {
    id: 'fal',
    name: 'Fal.ai',
    type: 'fal',
    apiKey: '',
    defaultModel: DEFAULT_VIDEO_MODEL,
    enabled: false,
    credentialId: 'fal',
  },
];
