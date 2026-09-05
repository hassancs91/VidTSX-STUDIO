import type { ImageProviderPreset } from './types';

export const IMAGE_PROVIDER_PRESETS: ImageProviderPreset[] = [
  {
    id: 'fal',
    name: 'Fal.ai',
    type: 'fal',
    apiKey: '',
    defaultModel: 'nano-banana-pro',
    enabled: false,
    credentialId: 'fal',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    apiKey: '',
    defaultModel: 'black-forest-labs/flux.2-pro',
    enabled: false,
    credentialId: 'openrouter',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    type: 'cloudflare',
    apiKey: '',
    defaultModel: '@cf/black-forest-labs/flux-1-schnell',
    enabled: false,
    credentialId: 'cloudflare',
  },
];
