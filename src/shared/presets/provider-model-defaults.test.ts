import { describe, expect, it } from 'vitest';
import { getDefaultImageModelPriceUsd, getDefaultProviderModels } from './provider-model-defaults';

describe('getDefaultImageModelPriceUsd', () => {
  it('returns the shipped default price for a priced model', () => {
    expect(getDefaultImageModelPriceUsd('cloudflare', '@cf/black-forest-labs/flux-1-schnell')).toBeCloseTo(0.0006);
    expect(getDefaultImageModelPriceUsd('fal', 'nano-banana-pro')).toBeCloseTo(0.15);
  });

  it('returns 0 for unpriced models, unknown models, and unknown providers', () => {
    expect(getDefaultImageModelPriceUsd('cloudflare', '@cf/leonardo/lucid-origin')).toBe(0);
    expect(getDefaultImageModelPriceUsd('fal', 'some-user-added-model')).toBe(0);
    expect(getDefaultImageModelPriceUsd('local', 'sd-model')).toBe(0);
  });

  it('every default catalog entry keeps id + name (prices are optional extras)', () => {
    for (const providerId of ['fal', 'openrouter', 'cloudflare']) {
      for (const entry of getDefaultProviderModels(providerId, 'image')) {
        expect(entry.id).toBeTruthy();
        expect(entry.name).toBeTruthy();
      }
    }
  });
});
