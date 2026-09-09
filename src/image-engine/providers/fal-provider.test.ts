import { describe, expect, it } from 'vitest';
import { FalImageProvider } from './fal-provider';

function bodyFor(modelId: string, catalog: Array<{ id: string; name: string; dialect?: string }>) {
  const provider = new FalImageProvider('fal', 'key', modelId, catalog as never);
  const def = provider.getSupportedModels().find((m) => m.id === modelId);
  expect(def).toBeDefined();
  // buildRequestBody takes the internal def; reach it through the same lookup
  // the generate() path uses.
  const internal = (provider as unknown as { models: Array<{ id: string }> }).models.find((m) => m.id === modelId)!;
  return (req: Parameters<FalImageProvider['buildRequestBody']>[1]) =>
    provider.buildRequestBody(internal as never, req);
}

describe('FalImageProvider.buildRequestBody — dialect-declared params only', () => {
  const params = { steps: 20, cfgScale: 4, seed: 123, negativePrompt: 'blurry' };

  it('a fal-flux entry sends num_inference_steps, guidance_scale and seed with image_size', () => {
    const body = bodyFor('fal-ai/flux/dev', [{ id: 'fal-ai/flux/dev', name: 'FLUX dev', dialect: 'fal-flux' }])({
      operation: 'text-to-image',
      prompt: 'a cat',
      width: 1024,
      height: 768,
      params,
    });
    expect(body).toMatchObject({
      prompt: 'a cat',
      num_inference_steps: 20,
      guidance_scale: 4,
      seed: 123,
      image_size: { width: 1024, height: 768 },
    });
    expect(body).not.toHaveProperty('negative_prompt');
    expect(body).not.toHaveProperty('aspect_ratio');
  });

  it('a shipped Nano Banana entry sends aspect_ratio and NONE of the numeric params', () => {
    const body = bodyFor('nano-banana-pro', [{ id: 'nano-banana-pro', name: 'NB', dialect: 'fal-nano-banana' }])({
      operation: 'text-to-image',
      prompt: 'a cat',
      width: 1920,
      height: 1080,
      params,
    });
    expect(body).toMatchObject({ prompt: 'a cat', aspect_ratio: '16:9' });
    expect(body).not.toHaveProperty('num_inference_steps');
    expect(body).not.toHaveProperty('guidance_scale');
    expect(body).not.toHaveProperty('seed');
  });

  it('a generic entry sends seed only', () => {
    const body = bodyFor('some/app', [{ id: 'some/app', name: 'App' }])({
      operation: 'text-to-image',
      prompt: 'a cat',
      params,
    });
    expect(body).toMatchObject({ seed: 123, image_size: { width: 1024, height: 1024 } });
    expect(body).not.toHaveProperty('num_inference_steps');
    expect(body).not.toHaveProperty('guidance_scale');
  });

  it('exposes the dialect schema on the model info', () => {
    const provider = new FalImageProvider('fal', 'key', 'x', [
      { id: 'x', name: 'x', dialect: 'fal-flux' },
      { id: 'nano-banana-2', name: 'nb' },
    ] as never);
    const models = provider.getSupportedModels();
    expect(models.find((m) => m.id === 'x')?.paramSchema?.fields.map((f) => f.key)).toEqual(['steps', 'cfgScale', 'seed']);
    expect(models.find((m) => m.id === 'nano-banana-2')?.paramSchema?.fields).toEqual([]);
  });
});
