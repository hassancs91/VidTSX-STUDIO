import { describe, expect, it } from 'vitest';
import { hydrateImageEntry, imageEntryParamSchema, resolveImageDialect } from './dialect-capabilities';
import { IMAGE_DIALECT_DEFAULTS, IMAGE_DIALECT_IDS } from '../shared/presets/image-dialects';
import { isVideoCatalogEntry, PROVIDER_MODEL_DEFAULTS } from '../shared/presets/provider-model-defaults';

describe('image dialects', () => {
  it('every dialect declares a schema, a size mode and a reference cap', () => {
    for (const id of IMAGE_DIALECT_IDS) {
      const d = IMAGE_DIALECT_DEFAULTS[id];
      expect(Array.isArray(d.paramSchema.fields)).toBe(true);
      expect(['image_size', 'aspect_ratio', 'none']).toContain(d.paramSchema.sizeMode);
      expect(d.paramSchema.maxReferences).toBeGreaterThanOrEqual(0);
      expect(d.supportedOperations.length).toBeGreaterThan(0);
    }
  });

  it('a cloud model shows only the fields its dialect declares', () => {
    const keys = (dialect: keyof typeof IMAGE_DIALECT_DEFAULTS) =>
      IMAGE_DIALECT_DEFAULTS[dialect].paramSchema.fields.map((f) => f.key);
    expect(keys('fal-flux')).toEqual(['steps', 'cfgScale', 'seed']);
    expect(keys('fal-nano-banana')).toEqual([]);
    expect(keys('fal-generic')).toEqual(['seed']);
    expect(keys('cloudflare')).toEqual(['steps', 'cfgScale', 'seed', 'negativePrompt']);
    expect(keys('byteplus-seedream')).toEqual(['seed']);
    expect(keys('openrouter')).toEqual([]);
    expect(keys('gemini-cli')).toEqual([]);
  });

  it('every shipped image entry names a dialect and is NOT mistaken for a video entry', () => {
    for (const [providerId, byCategory] of Object.entries(PROVIDER_MODEL_DEFAULTS)) {
      for (const entry of byCategory.image ?? []) {
        expect(isVideoCatalogEntry(entry)).toBe(false);
        expect(resolveImageDialect(providerId, entry as { id: string })).toBe(
          (entry as { dialect?: string }).dialect,
        );
      }
      for (const entry of byCategory.video ?? []) {
        expect(isVideoCatalogEntry(entry)).toBe(true);
      }
    }
  });
});

describe('hydrateImageEntry', () => {
  it('a stored row without a dialect (pre-W2c) takes the shipped entry dialect', () => {
    expect(hydrateImageEntry('fal', { id: 'nano-banana-pro', name: 'My NB' })).toEqual({
      id: 'nano-banana-pro',
      name: 'My NB',
      dialect: 'fal-nano-banana',
    });
  });

  it('an unknown id takes the provider default, and a named valid dialect is kept', () => {
    expect(hydrateImageEntry('fal', { id: 'fal-ai/flux/dev' }).dialect).toBe('fal-generic');
    expect(hydrateImageEntry('fal', { id: 'fal-ai/flux/dev', dialect: 'fal-flux' }).dialect).toBe('fal-flux');
    expect(hydrateImageEntry('cloudflare', { id: '@cf/x/y', dialect: 'fal-flux' }).dialect).toBe('fal-flux');
    expect(hydrateImageEntry('openrouter', { id: 'x/y', dialect: 'not-a-dialect' }).dialect).toBe('openrouter');
    expect(hydrateImageEntry('byteplus', { id: 'seedream-4-5' }).dialect).toBe('byteplus-seedream');
  });

  it('a video dialect on an image row is rejected in favour of the provider default', () => {
    expect(hydrateImageEntry('fal', { id: 'x', dialect: 'fal-seedance-2' }).dialect).toBe('fal-generic');
  });

  it('imageEntryParamSchema follows the resolved dialect', () => {
    expect(imageEntryParamSchema('fal', { id: 'flux', dialect: 'fal-flux' }).fields.map((f) => f.key)).toEqual([
      'steps',
      'cfgScale',
      'seed',
    ]);
    expect(imageEntryParamSchema('openrouter', { id: 'anything' }).fields).toEqual([]);
  });
});
