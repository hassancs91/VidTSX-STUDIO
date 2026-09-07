import {
  DEFAULT_BYTEPLUS_VIDEO_MODEL,
  DEFAULT_VIDEO_MODEL,
} from '../shared/presets/video-models';
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
  {
    id: 'byteplus',
    name: 'BytePlus ModelArk',
    type: 'byteplus',
    apiKey: '',
    defaultModel: DEFAULT_BYTEPLUS_VIDEO_MODEL,
    enabled: false,
    credentialId: 'byteplus',
  },
];
