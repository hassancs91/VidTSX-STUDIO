import { describe, expect, it, vi } from 'vitest';

// local-sd-provider pulls in the local engine, which imports `electron` for
// its temp dir; the mapper under test never touches it.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

import { toSdRequest } from './local-sd-provider';

describe('toSdRequest (request ⊕ override → sd-cli request)', () => {
  it('maps every param field onto the sd-cli request shape', () => {
    const sd = toSdRequest(
      {
        operation: 'text-to-image',
        prompt: 'a cat',
        width: 1000,
        height: 520,
        params: {
          steps: 12,
          cfgScale: 3.5,
          sampler: 'euler_a',
          scheduler: 'karras',
          negativePrompt: 'blurry',
          seed: 100,
          strength: 0.6,
        },
      },
      'sd15-x',
      0,
    );
    expect(sd).toMatchObject({
      operation: 'txt2img',
      prompt: 'a cat',
      modelId: 'sd15-x',
      width: 1024, // snapped to a multiple of 64
      height: 512,
      steps: 12,
      cfgScale: 3.5,
      sampler: 'euler_a',
      schedule: 'karras',
      negativePrompt: 'blurry',
      seed: 100,
      strength: 0.6,
      outputFormat: 'png',
    });
  });

  it('leaves unset fields undefined so the runner applies the family defaults', () => {
    const sd = toSdRequest({ operation: 'text-to-image', prompt: 'x' }, 'm', 0);
    expect(sd.steps).toBeUndefined();
    expect(sd.cfgScale).toBeUndefined();
    expect(sd.sampler).toBeUndefined();
    expect(sd.schedule).toBeUndefined();
    expect(sd.width).toBeUndefined();
    expect(typeof sd.seed).toBe('number'); // random per image
  });

  it('a fixed seed advances per image of a multi-image request', () => {
    const base = { operation: 'text-to-image' as const, prompt: 'x', params: { seed: 7 } };
    expect(toSdRequest(base, 'm', 0).seed).toBe(7);
    expect(toSdRequest(base, 'm', 2).seed).toBe(9);
  });

  it('img2img carries the source path', () => {
    const sd = toSdRequest(
      { operation: 'image-to-image', prompt: 'x', sourceImage: 'AAAA' },
      'm',
      0,
      '/tmp/src.png',
    );
    expect(sd.operation).toBe('img2img');
    expect(sd.sourceImagePath).toBe('/tmp/src.png');
  });
});
