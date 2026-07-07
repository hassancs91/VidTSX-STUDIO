import type { ImageProviderConfig } from './types';

export const IMAGE_PROVIDER_PRESETS: ImageProviderConfig[] = [
  {
    id: 'fal',
    name: 'Fal.ai',
    type: 'fal',
    apiKey: '',
    defaultModel: 'nano-banana-pro',
    enabled: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    apiKey: '',
    defaultModel: 'black-forest-labs/flux.2-pro',
    enabled: false,
  },
];
