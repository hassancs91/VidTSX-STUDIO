import { describe, expect, it } from 'vitest';
import {
  hasAnyImageParams,
  imageParamKey,
  mergeImageParams,
  sanitizeImageModelParams,
  splitImageParamKey,
  type ImageParamSchema,
} from './image-model-params';

const STEPS_SEED_ONLY: ImageParamSchema = {
  fields: [
    { key: 'steps', label: 'Steps', kind: 'number' },
    { key: 'seed', label: 'Seed', kind: 'number' },
  ],
  sizeMode: 'image_size',
  maxReferences: 0,
};

describe('imageParamKey', () => {
  it('joins provider and model and splits on the FIRST slash (OpenRouter ids carry slashes)', () => {
    const key = imageParamKey('openrouter', 'black-forest-labs/flux.2-pro');
    expect(key).toBe('openrouter/black-forest-labs/flux.2-pro');
    expect(splitImageParamKey(key)).toEqual({
      providerId: 'openrouter',
      modelId: 'black-forest-labs/flux.2-pro',
    });
    expect(splitImageParamKey('nope')).toBeNull();
    expect(splitImageParamKey('/x')).toBeNull();
  });
});

describe('sanitizeImageModelParams', () => {
  it('keeps finite numbers and trimmed strings, drops empties and unknown keys', () => {
    expect(
      sanitizeImageModelParams({
        steps: '12',
        cfgScale: 3.5,
        seed: 'abc',
        sampler: '  euler_a ',
        negativePrompt: '',
        scheduler: null,
        bogus: 1,
      }),
    ).toEqual({ steps: 12, cfgScale: 3.5, sampler: 'euler_a' });
  });

  it('drops fields the schema does not declare', () => {
    expect(
      sanitizeImageModelParams({ steps: 4, cfgScale: 2, negativePrompt: 'blurry', seed: 7 }, STEPS_SEED_ONLY),
    ).toEqual({ steps: 4, seed: 7 });
  });

  it('returns an empty object for junk', () => {
    expect(sanitizeImageModelParams(null)).toEqual({});
    expect(sanitizeImageModelParams('x')).toEqual({});
    expect(hasAnyImageParams(sanitizeImageModelParams({}))).toBe(false);
  });
});

describe('mergeImageParams', () => {
  it('request ⊕ override: a named request field wins, the override fills the rest', () => {
    expect(
      mergeImageParams({ steps: 30, seed: undefined }, { steps: 12, seed: 7, sampler: 'lcm' }),
    ).toEqual({ steps: 30, seed: 7, sampler: 'lcm' });
  });

  it('tolerates either side missing', () => {
    expect(mergeImageParams(undefined, { steps: 12 })).toEqual({ steps: 12 });
    expect(mergeImageParams({ steps: 3 }, undefined)).toEqual({ steps: 3 });
    expect(mergeImageParams(undefined, undefined)).toEqual({});
  });
});
